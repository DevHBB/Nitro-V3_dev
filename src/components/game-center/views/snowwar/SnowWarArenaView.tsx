import { FC, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GetSessionDataManager, LocalizeText } from '../../../../api';
import {
    SNOWWAR_STATE_INVINCIBLE,
    SNOWWAR_STATE_STUNNED,
    THROW_RANGE_LONG,
    THROW_RANGE_NORMAL,
    TILE_SIZE_WORLD,
    tileToWorld,
} from '../../../../api/snowwar';
import { LayoutFurniImageView } from '../../../../common';
import { useSnowWar } from '../../../../hooks';
import { SnowWarAvatarView } from './SnowWarAvatarView';

const localizeWithFallback = (key: string, fallback: string) =>
{
    const text = LocalizeText(key);
    return text && text !== key ? text : fallback;
};

const TILE_HALF_W = 12;
const TILE_HALF_H = 6;

const TEAM_COLORS = ['#e64545', '#4577e6', '#3fb550', '#e6c245'];

// Fixed "normal" zoom - the middle of the old 0/1/2 levels. The selectable
// zoom was removed; the arena always renders at this scale, in game and edit.
const ZOOM = 2;

// Vertical screen offset (px) of a snowball above its tile. The ball leaves the
// avatar's hand at SNOWWAR_THROW_HAND_RISE; above that sits the visible arc =
// how far the sim height rises ABOVE that trajectory's own baseline. A quick
// throw (traj 0) has sim baseline 4000, the lob/long throws 3000, so measuring
// each against its own baseline keeps a flat quick throw pinned at hand level
// instead of floating over the avatar's head. A long/curved throw (traj 2) arcs
// twice as high in the sim, so it renders at half scale - it lands near the
// ground rather than "hitting" in the air. Used for both the ball sprite and
// its splash so the two never drift apart.
// How long (ms) an avatar holds the SnowWarThrow arm-out pose after throwing.
const SNOWWAR_THROW_POSE_MS = 450;
const SNOWWAR_THROW_HAND_RISE = 34;
const snowballRise = (height: number, trajectory: number): number =>
{
    const baseline = trajectory === 0 ? 4000 : 3000;
    const arc = Math.min(120, Math.max(0, height - baseline) / 60);
    return SNOWWAR_THROW_HAND_RISE + (trajectory === 2 ? 0.5 : 1) * arc;
};

// Screen-space nudge (px) leading the ball along its travel direction, so it
// appears to leave the avatar's extended hand toward the target for any facing.
// dH/dV are the ball's per-step world velocity; converted to the iso screen
// direction and scaled to a fixed reach.
const SNOWWAR_HAND_REACH = 9;
const travelOffset = (dH: number, dV: number): { x: number; y: number } =>
{
    const sdx = (dH - dV) * TILE_HALF_W;
    const sdy = (dH + dV) * TILE_HALF_H;
    const len = Math.hypot(sdx, sdy);
    if (!len) return { x: 0, y: 0 };
    return { x: (sdx / len) * SNOWWAR_HAND_REACH, y: (sdy / len) * SNOWWAR_HAND_REACH };
};

// Snowball-pile layout: each ball's top-left offset (px) from the machine tile
// anchor, plus stacking order (front/lower balls drawn on top). Rendered as
// real elements so every ball gets the same shaded, rimmed 3D snowball look.
const SNOWWAR_PILE: { left: number; top: number; z: number }[] = [
    { left: -14, top: 3, z: 3 }, { left: -5, top: 3, z: 3 }, { left: 4, top: 3, z: 3 },
    { left: -10, top: -2, z: 2 }, { left: 0, top: -2, z: 2 },
    { left: -5, top: -6, z: 1 },
];

// Design base: the arena is authored for a 1920x1080 stage. Larger screens
// centre this stage; smaller screens cap the viewport to the screen and follow
// the player.
const DESIGN_W = 1920;
const DESIGN_H = 1080;

// Camera dead zone: the avatar roams the central (1 - 2*DEADZONE) of the
// viewport with the camera held still; only when it pushes into the outer
// DEADZONE band near an edge does the camera ease back to re-centre it. This
// keeps the background static most of the time (no per-step scroll, so jitter
// stays invisible) and only follows when the avatar is about to leave the view.
const CAMERA_DEADZONE = 0.2;
const CAMERA_EASE = 0.15;

interface EditItem { name: string; x: number; y: number; rotation: number; imageUrl: string; offsetZ: number; width?: number; length?: number }

// Placeable classnames for the in-arena editor, mirroring the server's
// SnowWarItemProperties registry. 'spawn' is the special player-spawn marker.
const EDITOR_PALETTE = [
    'sw_tree1', 'sw_tree2', 'sw_tree3', 'sw_tree4',
    'block_basic', 'block_basic2', 'block_basic3', 'block_small',
    'block_ice', 'block_ice2', 'obst_duck', 'obst_snowman',
    'sw_fence', 'snowball_machine',
];

/** Server rule: normal throws reach 5 tiles, long throws 15. */
const isThrowInRange = (fromX: number, fromY: number, toX: number, toY: number, trajectory: number) =>
{
    const maxRange = (trajectory === 2) ? THROW_RANGE_LONG : THROW_RANGE_NORMAL;
    const dx = toX - fromX;
    const dy = toY - fromY;
    return ((dx * dx) + (dy * dy)) <= (maxRange * maxRange);
};

/** Classic SnowWar props drawn as canvas shapes; everything else is furni. */
const isClassicItem = (name: string) =>
    name.startsWith('sw_') || name.startsWith('block_') || name.startsWith('obst_') || name.startsWith('snowball_machine');

export const SnowWarArenaView: FC = () =>
{
    const {
        phase,
        levelData,
        secondsLeft,
        preparingSeconds,
        chatMessages,
        simulation,
        editing,
        walkTo,
        throwAtLocation,
        throwAtPlayer,
        exitGame,
        startEditing,
        saveArena,
        stopEditing,
        sendChat,
        requestFullStatus,
    } = useSnowWar();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    // Dead-zone follow camera: persisted translate + per-axis "recentring"
    // latch. Advanced at most once per animation frame (see the camera block).
    const cameraRef = useRef({ x: 0, y: 0, frame: -1, recenterX: false, recenterY: false, initialized: false });
    // Wall-clock of the last animation frame; doubles as the re-render tick.
    const [frameNow, setFrameNow] = useState(0);
    const [chatInput, setChatInput] = useState('');
    const zoom = ZOOM;
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    // Bumped a few seconds after level load: remounts the furni images so
    // any that rendered the "still downloading" placeholder retry against
    // the now-cached assets.
    const [furniRetryTick, setFurniRetryTick] = useState(0);
    // Set when a throw is blocked for being out of range; shows a short hint.
    const [rangeWarningAt, setRangeWarningAt] = useState(0);
    const ownUserId = GetSessionDataManager()?.userId ?? 0;

    // Snow-burst splashes: a short CSS animation spawned wherever a snowball
    // vanishes (server-authoritative removal = a hit on furni/another player,
    // or the ball landing). ballScreenRef holds last frame's on-screen ball
    // positions so we can diff against this frame and splash the ones that went.
    const [splashes, setSplashes] = useState<{ id: number; x: number; y: number }[]>([]);
    const ballScreenRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const splashIdRef = useRef(0);
    // avatar objectId -> frameNow timestamp until which that avatar holds the
    // SnowWarThrow pose. Set when a new snowball appears (that ball's thrower).
    const throwPoseUntilRef = useRef<Map<number, number>>(new Map());

    // In-arena editor state (only meaningful while `editing`).
    const [editItems, setEditItems] = useState<EditItem[]>([]);
    const [editSpawns, setEditSpawns] = useState<{ x: number; y: number }[]>([]);
    const [editHeightmap, setEditHeightmap] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    // Palette selection: a classname to place, 'spawn' for a spawn marker,
    // 'floor' to paint tiles, or null for select/move mode.
    const [paletteSel, setPaletteSel] = useState<string | null>(null);
    const [furniSearch, setFurniSearch] = useState('');
    const [savedAt, setSavedAt] = useState(0);

    // Hotel furni matching the current search - lets the editor place any
    // real furniture (like decorating a room), not just the classic SnowWar
    // props. Floor furni only; capped so the list stays usable.
    const furniMatches = useMemo(() =>
    {
        const term = furniSearch.trim().toLowerCase();
        if (term.length < 2) return [];
        const all = GetSessionDataManager()?.getAllFurnitureData?.() ?? [];
        return all
            .filter(furni => furni.type === 'S' && (
                furni.className?.toLowerCase().includes(term) || furni.name?.toLowerCase().includes(term)))
            .slice(0, 40);
    }, [furniSearch]);

    // Seed the working copy from the current level snapshot when the editor
    // opens; the game furni become editable items.
    useEffect(() =>
    {
        if (!editing) return;
        setEditItems((levelData?.items ?? []).map(item => ({
            name: item.name, x: item.x, y: item.y, rotation: item.rotation, imageUrl: item.imageUrl, offsetZ: item.offsetZ ?? 0,
            width: item.width, length: item.length,
        })));
        setEditSpawns([]);
        setEditHeightmap([...(levelData?.heightmapRows ?? [])]);
        setSelectedIndex(-1);
        setPaletteSel(null);
        setFurniSearch('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    // The arena renders the editor's working copy while editing, the live
    // level items otherwise. Both references are stable across renders.
    const displayItems = editing ? editItems : (levelData?.items ?? []);

    const mapRows = editing ? editHeightmap : (levelData?.heightmapRows ?? []);
    const mapHeight = mapRows.length;
    const mapWidth = mapHeight > 0 ? mapRows[0].length : 0;

    const originX = mapHeight * TILE_HALF_W;
    const canvasWidth = (mapWidth + mapHeight) * TILE_HALF_W;
    const canvasHeight = (mapWidth + mapHeight) * TILE_HALF_H + 40;

    const toScreen = useCallback((tileX: number, tileY: number) => ({
        x: originX + (tileX - tileY) * TILE_HALF_W,
        y: (tileX + tileY) * TILE_HALF_H,
    }), [originX]);

    const worldToScreen = useCallback((worldX: number, worldY: number) =>
    {
        const tx = worldX / TILE_SIZE_WORLD;
        const ty = worldY / TILE_SIZE_WORLD;
        return {
            x: originX + (tx - ty) * TILE_HALF_W,
            y: (tx + ty) * TILE_HALF_H,
        };
    }, [originX]);

    // Static floor: tiles + obstacles drawn once per level.
    useEffect(() =>
    {
        const canvas = canvasRef.current;
        if (!canvas || !mapHeight) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < mapHeight; y++)
        {
            for (let x = 0; x < mapWidth; x++)
            {
                const char = mapRows[y]?.charAt(x);
                if (char !== '0') continue;

                const { x: sx, y: sy } = toScreen(x, y);
                context.beginPath();
                context.moveTo(sx, sy);
                context.lineTo(sx + TILE_HALF_W, sy + TILE_HALF_H);
                context.lineTo(sx, sy + TILE_HALF_H * 2);
                context.lineTo(sx - TILE_HALF_W, sy + TILE_HALF_H);
                context.closePath();
                context.fillStyle = ((x + y) % 2) ? '#eef5fb' : '#e4eef7';
                context.fill();
                context.strokeStyle = '#c8d8e6';
                context.lineWidth = 1;
                context.stroke();
            }
        }

        for (const item of displayItems)
        {
            // Hotel furniture saved by the arena editor is rendered as its
            // real furni image in the DOM layer below - only the classic
            // SnowWar props are drawn as canvas shapes.
            if (!isClassicItem(item.name)) continue;

            const { x: sx, y: sy } = toScreen(item.x, item.y);
            const centerY = sy + TILE_HALF_H;

            if (item.name.startsWith('sw_tree'))
            {
                context.fillStyle = '#7a5230';
                context.fillRect(sx - 2, centerY - 8, 4, 8);
                context.beginPath();
                context.moveTo(sx, centerY - 34);
                context.lineTo(sx + 12, centerY - 8);
                context.lineTo(sx - 12, centerY - 8);
                context.closePath();
                context.fillStyle = '#2f7a43';
                context.fill();
                context.strokeStyle = '#215a30';
                context.stroke();
            }
            else if (item.name.startsWith('obst_snowman'))
            {
                context.fillStyle = '#ffffff';
                context.strokeStyle = '#b9c9d6';
                context.beginPath();
                context.arc(sx, centerY - 6, 8, 0, Math.PI * 2);
                context.fill();
                context.stroke();
                context.beginPath();
                context.arc(sx, centerY - 18, 6, 0, Math.PI * 2);
                context.fill();
                context.stroke();
            }
            else
            {
                // Generic block / fence / obstacle: raised cube.
                const height = item.name.includes('3') ? 26 : item.name.includes('2') ? 18 : 10;
                const isIce = item.name.includes('ice');
                context.beginPath();
                context.moveTo(sx, centerY - height - TILE_HALF_H);
                context.lineTo(sx + TILE_HALF_W, centerY - height);
                context.lineTo(sx + TILE_HALF_W, centerY);
                context.lineTo(sx, centerY + TILE_HALF_H);
                context.lineTo(sx - TILE_HALF_W, centerY);
                context.lineTo(sx - TILE_HALF_W, centerY - height);
                context.closePath();
                context.fillStyle = isIce ? '#bfe3f5' : '#cfd6dd';
                context.fill();
                context.strokeStyle = isIce ? '#8fc3de' : '#9aa5b0';
                context.stroke();
            }
        }
    }, [displayItems, mapHeight, mapWidth, mapRows, toScreen]);

    // Drive the simulation clock + re-render at display rate.
    useEffect(() =>
    {
        let running = true;
        let rafId = 0;

        const loop = (now: number) =>
        {
            if (!running) return;
            simulation.update(now);
            setFrameNow(Date.now());
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () =>
        {
            running = false;
            cancelAnimationFrame(rafId);
        };
    }, [simulation]);

    // Track the viewport size; the camera transform is computed from it.
    useEffect(() =>
    {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
        update();

        const observer = new ResizeObserver(update);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [levelData]);

    // Furni image retry passes (see furniRetryTick).
    useEffect(() =>
    {
        if (!levelData) return;
        setFurniRetryTick(0);
        const timers = [
            setTimeout(() => setFurniRetryTick(1), 4000),
            setTimeout(() => setFurniRetryTick(2), 10000),
        ];
        return () => timers.forEach(timer => clearTimeout(timer));
    }, [levelData]);

    // Periodic authoritative resync.
    useEffect(() =>
    {
        if (phase !== 'playing') return;
        const interval = setInterval(() => requestFullStatus(), 10000);
        return () => clearInterval(interval);
    }, [phase, requestFullStatus]);

    const screenToTile = useCallback((event: MouseEvent<HTMLDivElement>) =>
    {
        // Measure the floor canvas itself, NOT the viewport: the world is
        // centered inside a scrollable viewport, so the viewport rect is
        // offset from the isometric origin and clicks landed on the wrong
        // tile (or outside the map) whenever the arena didn't exactly fill it.
        const canvas = canvasRef.current;
        if (!canvas) return { tileX: -1, tileY: -1 };

        const bounds = canvas.getBoundingClientRect();
        const scaleX = bounds.width > 0 ? canvasWidth / bounds.width : 1;
        const px = (event.clientX - bounds.left) * scaleX - originX;
        const py = (event.clientY - bounds.top) * scaleX;

        const tileX = Math.floor(((px / TILE_HALF_W) + (py / TILE_HALF_H)) / 2);
        const tileY = Math.floor(((py / TILE_HALF_H) - (px / TILE_HALF_W)) / 2);
        return { tileX, tileY };
    }, [canvasWidth, originX]);

    const applyEditClick = useCallback((tileX: number, tileY: number) =>
    {
        if (paletteSel === 'floor')
        {
            // Toggle the tile between walkable ('0') and void ('x').
            setEditHeightmap(rows => rows.map((row, ry) =>
            {
                if (ry !== tileY || tileX >= row.length) return row;
                const cell = row.charAt(tileX);
                const next = (cell === 'x' || cell === 'X') ? '0' : 'x';
                return row.substring(0, tileX) + next + row.substring(tileX + 1);
            }));
            return;
        }

        if (paletteSel === 'spawn')
        {
            setEditSpawns(spawns =>
            {
                const index = spawns.findIndex(spawn => spawn.x === tileX && spawn.y === tileY);
                return index >= 0 ? spawns.filter((_, i) => i !== index) : [...spawns, { x: tileX, y: tileY }];
            });
            return;
        }

        if (paletteSel)
        {
            setEditItems(items => [...items, { name: paletteSel, x: tileX, y: tileY, rotation: 0, imageUrl: '', offsetZ: 0 }]);
            return;
        }

        // Select/move mode: click an item to select it, click an empty tile
        // with something selected to move it there.
        let hitIndex = -1;
        for (let i = editItems.length - 1; i >= 0; i--)
        {
            if (editItems[i].x === tileX && editItems[i].y === tileY) { hitIndex = i; break; }
        }

        if (hitIndex >= 0) { setSelectedIndex(hitIndex); return; }

        if (selectedIndex >= 0)
        {
            setEditItems(items => items.map((item, i) => (i === selectedIndex ? { ...item, x: tileX, y: tileY } : item)));
            return;
        }

        setSelectedIndex(-1);
    }, [paletteSel, editItems, selectedIndex]);

    const onArenaClick = useCallback((event: MouseEvent<HTMLDivElement>) =>
    {
        const { tileX, tileY } = screenToTile(event);
        if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) return;

        if (editing)
        {
            event.preventDefault();
            applyEditClick(tileX, tileY);
            return;
        }

        if (event.shiftKey || event.type === 'contextmenu')
        {
            event.preventDefault();
            // Plain right-click = straight throw (trajectory 0, max 10 tiles);
            // hold Shift = curved lob that flies over obstacles (trajectory 2,
            // max 20 tiles). Range is a circle around the thrower (isThrowInRange).
            const trajectory = event.shiftKey ? 2 : 0;
            const own = simulation.getAvatarByUserId(ownUserId);
            if (own && !isThrowInRange(own.tileX, own.tileY, tileX, tileY, trajectory))
            {
                setRangeWarningAt(Date.now());
                return;
            }
            throwAtLocation(tileToWorld(tileX), tileToWorld(tileY), trajectory);
            return;
        }

        walkTo(tileToWorld(tileX), tileToWorld(tileY));
    }, [editing, applyEditClick, mapHeight, mapWidth, screenToTile, simulation, ownUserId, throwAtLocation, walkTo]);

    const rotateSelected = useCallback(() =>
        setEditItems(items => items.map((item, i) => (i === selectedIndex ? { ...item, rotation: (item.rotation + 2) % 8 } : item))),
    [selectedIndex]);

    const deleteSelected = useCallback(() =>
    {
        setEditItems(items => items.filter((_, i) => i !== selectedIndex));
        setSelectedIndex(-1);
    }, [selectedIndex]);

    // The arena backdrop is a single always-full-screen ad image, edited via
    // the dedicated background control rather than by selecting a tile.
    const setBackdropUrl = useCallback((url: string) =>
        setEditItems(items =>
        {
            const trimmed = url;
            const index = items.findIndex(item => item.imageUrl);
            if (!trimmed) return items.filter(item => !item.imageUrl);
            if (index >= 0) return items.map((item, i) => (i === index ? { ...item, imageUrl: trimmed } : item));
            return [...items, { name: 'ads_background', x: 0, y: 0, rotation: 0, imageUrl: trimmed, offsetZ: 0 }];
        }), []);

    const setBackdropOffsetZ = useCallback((offsetZ: number) =>
        setEditItems(items => items.map(item => (item.imageUrl ? { ...item, offsetZ } : item))), []);

    const clearAllItems = useCallback(() =>
    {
        setEditItems([]);
        setSelectedIndex(-1);
    }, []);

    const saveEditor = useCallback(() =>
    {
        if (!levelData) return;
        saveArena(levelData.mapId, editItems, editSpawns, editHeightmap);
        setSavedAt(Date.now());
    }, [levelData, editItems, editSpawns, editHeightmap, saveArena]);

    const ownAvatar = simulation.getAvatarByUserId(ownUserId);
    const alpha = simulation.interpolationAlpha;

    // Detect snowballs that disappeared since the last frame and spawn a splash
    // at their last on-screen spot. Runs every animation frame (frameNow tick).
    // A bulk vanish (round end / arena reset) is ignored so we don't spray the
    // whole map with splashes.
    useEffect(() =>
    {
        const prev = ballScreenRef.current;
        const next = new Map<number, { x: number; y: number }>();
        for (const ball of simulation.snowballs.values())
        {
            const lx = ball.prevLocH + (ball.locH - ball.prevLocH) * alpha;
            const ly = ball.prevLocV + (ball.locV - ball.prevLocV) * alpha;
            const lh = Math.max(0, ball.prevHeight + (ball.height - ball.prevHeight) * alpha);
            const { x, y } = worldToScreen(lx, ly);
            // Splash marks the actual hit spot: use the ball's true position
            // (only lifted by the arc), WITHOUT the travel-lead offset. That
            // offset makes the ball leave the hand, but on a hit it would push
            // the burst a few px past the avatar/furni it struck.
            const rise = snowballRise(lh, ball.trajectory);
            next.set(ball.objectId, { x, y: y - rise });

            // A newly-appeared ball means its thrower just threw - flash that
            // avatar into the SnowWarThrow pose for a short window.
            if (!prev.has(ball.objectId) && ball.throwerObjectId)
            {
                throwPoseUntilRef.current.set(ball.throwerObjectId, frameNow + SNOWWAR_THROW_POSE_MS);
            }
        }

        const gone: { id: number; x: number; y: number }[] = [];
        prev.forEach((pos, id) =>
        {
            if (!next.has(id)) gone.push({ id: ++splashIdRef.current, x: pos.x, y: pos.y });
        });
        ballScreenRef.current = next;

        if (gone.length > 0 && gone.length <= 3)
        {
            setSplashes(list => [...list, ...gone]);
        }
    }, [frameNow, alpha, worldToScreen, simulation]);

    // First room-ad furni's image is the arena backdrop. offsetZ doubles as an
    // overlay flag: 0 = drawn behind the arena (full-screen), 1 = overlaid on
    // top of the floor tiles (hiding them, but they stay walkable) while still
    // sitting under the furni and avatars. Edit-aware so it previews live.
    const arenaBackdrop = displayItems.find(item => item.imageUrl) ?? null;
    const backdropOverlay = !!(arenaBackdrop && (arenaBackdrop.offsetZ ?? 0) > 0);
    const selectedItem = (editing && selectedIndex >= 0 && editItems[selectedIndex]) ? editItems[selectedIndex] : null;
    const placingFurni = (editing && paletteSel && paletteSel !== 'spawn' && paletteSel !== 'floor')
        ? GetSessionDataManager()?.getFloorItemDataByName?.(paletteSel) : null;
    const selectedFurni = selectedItem ? GetSessionDataManager()?.getFloorItemDataByName?.(selectedItem.name) : null;
    const backdropItem = editing ? (editItems.find(item => item.imageUrl) ?? null) : null;

    // Fixed 1920x1080 design stage: the background fills it and the floor sits
    // centred on it. On screens >= the stage the whole stage is centred in the
    // viewport; on smaller screens the viewport is capped to the screen and the
    // camera follows the own avatar (like a normal room), so background + tiles
    // pan together. The stage grows past the base only if a map is larger.
    const floorW = canvasWidth * zoom;
    const floorH = canvasHeight * zoom;
    const stageW = Math.max(DESIGN_W, floorW);
    const stageH = Math.max(DESIGN_H, floorH);
    const floorOffsetX = (stageW - floorW) / 2;
    const floorOffsetY = (stageH - floorH) / 2;

    // Camera as a GPU translate on the stage. Instead of hard-locking the
    // avatar to centre (which scrolls the background on every step and makes
    // the smallest jitter obvious), the camera holds still while the avatar
    // roams a central dead zone and only eases back to centre once the avatar
    // pushes into the outer CAMERA_DEADZONE band near a screen edge.
    let cameraX = (viewportSize.width - stageW) / 2;
    let cameraY = (viewportSize.height - stageH) / 2;

    if (ownAvatar && viewportSize.width > 0)
    {
        const followX = ownAvatar.prevWorldX + (ownAvatar.worldX - ownAvatar.prevWorldX) * alpha;
        const followY = ownAvatar.prevWorldY + (ownAvatar.worldY - ownAvatar.prevWorldY) * alpha;
        const { x, y } = worldToScreen(followX, followY);
        const avatarStageX = floorOffsetX + (x * zoom);
        const avatarStageY = floorOffsetY + (y * zoom);

        const followsX = stageW > viewportSize.width;
        const followsY = stageH > viewportSize.height;
        const centeredX = Math.min(0, Math.max(viewportSize.width - stageW, (viewportSize.width / 2) - avatarStageX));
        const centeredY = Math.min(0, Math.max(viewportSize.height - stageH, (viewportSize.height / 2) - avatarStageY));

        const cam = cameraRef.current;
        if (!cam.initialized)
        {
            cam.x = followsX ? centeredX : cameraX;
            cam.y = followsY ? centeredY : cameraY;
            cam.initialized = true;
        }

        // Advance the dead-zone camera at most once per animation frame; the
        // frame gate also makes a Strict-Mode double render idempotent.
        if (cam.frame !== frameNow)
        {
            cam.frame = frameNow;

            if (followsX)
            {
                const screenX = avatarStageX + cam.x;
                if (!cam.recenterX && (screenX < viewportSize.width * CAMERA_DEADZONE || screenX > viewportSize.width * (1 - CAMERA_DEADZONE)))
                    cam.recenterX = true;
                if (cam.recenterX)
                {
                    cam.x += (centeredX - cam.x) * CAMERA_EASE;
                    if (Math.abs(centeredX - cam.x) < 0.5) { cam.x = centeredX; cam.recenterX = false; }
                }
                cam.x = Math.min(0, Math.max(viewportSize.width - stageW, cam.x));
            }
            else cam.x = cameraX;

            if (followsY)
            {
                const screenY = avatarStageY + cam.y;
                if (!cam.recenterY && (screenY < viewportSize.height * CAMERA_DEADZONE || screenY > viewportSize.height * (1 - CAMERA_DEADZONE)))
                    cam.recenterY = true;
                if (cam.recenterY)
                {
                    cam.y += (centeredY - cam.y) * CAMERA_EASE;
                    if (Math.abs(centeredY - cam.y) < 0.5) { cam.y = centeredY; cam.recenterY = false; }
                }
                cam.y = Math.min(0, Math.max(viewportSize.height - stageH, cam.y));
            }
            else cam.y = cameraY;
        }

        cameraX = cam.x;
        cameraY = cam.y;
    }
    else
    {
        cameraRef.current.initialized = false;
    }

    const teamScores = useMemo(() =>
    {
        const scores = new Map<number, number>();
        for (const avatar of simulation.avatars.values())
        {
            scores.set(avatar.teamId, (scores.get(avatar.teamId) ?? 0) + avatar.score);
        }
        return [...scores.entries()].sort((a, b) => a[0] - b[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simulation, simulation.subturnCount]);

    const formatClock = (totalSeconds: number) =>
    {
        const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
        const seconds = Math.max(0, totalSeconds) % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!levelData)
    {
        return (
            <div className="snowwar-arena snowwar-arena--loading">
                <div className="snowwar-banner">{localizeWithFallback('snowwar.loading', 'Loading arena...')}</div>
            </div>
        );
    }

    return (
        <div className="snowwar-arena">
            <div className="snowwar-hud">
                <div className="snowwar-hud__clock">{formatClock(secondsLeft)}</div>
                <div className="snowwar-hud__teams">
                    {teamScores.map(([teamId, score]) => (
                        <div key={teamId} className="snowwar-hud__team" style={{ borderColor: TEAM_COLORS[teamId % TEAM_COLORS.length] }}>
                            <span className="snowwar-hud__team-dot" style={{ background: TEAM_COLORS[teamId % TEAM_COLORS.length] }} />
                            {score}
                        </div>
                    ))}
                </div>
                {ownAvatar && (
                    <div className="snowwar-hud__self">
                        <span title={localizeWithFallback('snowwar.hud.health', 'Health')}>
                            {'❤'.repeat(Math.max(0, ownAvatar.health))}
                            <span className="snowwar-hud__hearts-empty">{'❤'.repeat(Math.max(0, 4 - ownAvatar.health))}</span>
                        </span>
                        <span title={localizeWithFallback('snowwar.hud.snowballs', 'Snowballs')}>
                            {'⚪'.repeat(Math.max(0, ownAvatar.snowballCount))}
                        </span>
                        <span>{localizeWithFallback('snowwar.hud.score', 'Score')}: {ownAvatar.score}</span>
                    </div>
                )}
                <div className="snowwar-hud__actions">
                    {editing ? (
                        <>
                            <button type="button" className="snowwar-button" onClick={() => saveEditor()}>
                                {localizeWithFallback('snowwar.editor.save', 'Save arena')}
                            </button>
                            <button type="button" className="snowwar-button snowwar-button--danger" onClick={() => stopEditing()}>
                                {localizeWithFallback('snowwar.editor.exit', 'Exit editor')}
                            </button>
                        </>
                    ) : (
                        <>
                            {levelData.canEditRoom && (
                                <button type="button" className="snowwar-button" onClick={() => startEditing()}>
                                    {localizeWithFallback('snowwar.edit_room', 'Edit Room')}
                                </button>
                            )}
                            <button type="button" className="snowwar-button snowwar-button--danger" onClick={() => exitGame()}>
                                {localizeWithFallback('snowwar.leave', 'Leave game')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {editing && (
                <div className="snowwar-editor">
                    <div className="snowwar-editor__hint">
                        {localizeWithFallback('snowwar.editor.hint', 'Pick a piece (or search furniture) then click a tile to place it. Floor tile paints/erases the arena floor. Select/Move: click a piece then an empty tile to move it.')}
                    </div>
                    <div className="snowwar-editor__tools">
                        <button type="button" className="snowwar-button snowwar-button--danger" onClick={() => clearAllItems()}>
                            {localizeWithFallback('snowwar.editor.clear', 'Clear all furni')}
                        </button>
                    </div>
                    <div className="snowwar-editor__palette">
                        <button
                            type="button"
                            className={'snowwar-editor__chip' + (paletteSel === null ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => setPaletteSel(null)}
                        >
                            {localizeWithFallback('snowwar.editor.select', 'Select / Move')}
                        </button>
                        {EDITOR_PALETTE.map(name => (
                            <button
                                key={name}
                                type="button"
                                className={'snowwar-editor__chip' + (paletteSel === name ? ' snowwar-editor__chip--active' : '')}
                                onClick={() => { setPaletteSel(name); setSelectedIndex(-1); }}
                            >
                                {name.replace('block_', '').replace('obst_', '').replace('sw_', '')}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={'snowwar-editor__chip snowwar-editor__chip--spawn' + (paletteSel === 'spawn' ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => { setPaletteSel('spawn'); setSelectedIndex(-1); }}
                        >
                            {localizeWithFallback('snowwar.editor.spawn', 'Spawn tile')}
                        </button>
                        <button
                            type="button"
                            className={'snowwar-editor__chip snowwar-editor__chip--floor' + (paletteSel === 'floor' ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => { setPaletteSel('floor'); setSelectedIndex(-1); }}
                        >
                            {localizeWithFallback('snowwar.editor.floor', 'Floor tile')}
                        </button>
                    </div>
                    <input
                        type="text"
                        className="snowwar-editor__search"
                        value={furniSearch}
                        placeholder={localizeWithFallback('snowwar.editor.furni_search', 'Search furniture to place...')}
                        onChange={event => setFurniSearch(event.target.value)}
                    />
                    {furniMatches.length > 0 && (
                        <div className="snowwar-editor__palette snowwar-editor__palette--furni">
                            {furniMatches.map(furni => (
                                <button
                                    key={furni.id}
                                    type="button"
                                    title={furni.className}
                                    className={'snowwar-editor__chip' + (paletteSel === furni.className ? ' snowwar-editor__chip--active' : '')}
                                    onClick={() => { setPaletteSel(furni.className); setSelectedIndex(-1); }}
                                >
                                    {(furni.name && furni.name.trim()) || furni.className}
                                </button>
                            ))}
                        </div>
                    )}
                    {placingFurni && (
                        <div className="snowwar-editor__preview">
                            <span className="snowwar-editor__preview-label">{localizeWithFallback('snowwar.editor.placing', 'Placing')}:</span>
                            <LayoutFurniImageView direction={2} productClassId={placingFurni.id} productType="s" style={{ transform: 'scale(0.5)' }} />
                            <span>{(placingFurni.name && placingFurni.name.trim()) || paletteSel}</span>
                        </div>
                    )}
                    {selectedItem && (
                        <div className="snowwar-editor__selected">
                            <div className="snowwar-editor__preview">
                                {selectedFurni
                                    ? <LayoutFurniImageView direction={selectedItem.rotation} productClassId={selectedFurni.id} productType="s" style={{ transform: 'scale(0.5)' }} />
                                    : <div className="snowwar-furni__fallback" />}
                                <span>{(selectedFurni?.name && selectedFurni.name.trim()) || selectedItem.name}</span>
                            </div>
                            <div className="snowwar-editor__tools">
                                <button type="button" className="snowwar-button" onClick={() => rotateSelected()}>
                                    {localizeWithFallback('snowwar.editor.rotate', 'Rotate')}
                                </button>
                                <button type="button" className="snowwar-button snowwar-button--danger" onClick={() => deleteSelected()}>
                                    {localizeWithFallback('snowwar.editor.delete', 'Delete')}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="snowwar-editor__selected">
                        <div className="snowwar-editor__field snowwar-editor__field--stack">
                            <span>{localizeWithFallback('snowwar.editor.bg', 'Arena background (ads_bg)')}</span>
                            <input
                                type="text"
                                className="snowwar-editor__search"
                                value={backdropItem?.imageUrl ?? ''}
                                placeholder={localizeWithFallback('snowwar.editor.bg_url', 'Full-screen background image URL...')}
                                onChange={event => setBackdropUrl(event.target.value)}
                            />
                        </div>
                        {backdropItem && (
                            <label className="snowwar-editor__field">
                                {localizeWithFallback('snowwar.editor.overlay', 'Overlay floor tiles (hide tiles behind image)')}
                                <input
                                    type="checkbox"
                                    checked={(backdropItem.offsetZ ?? 0) > 0}
                                    onChange={event => setBackdropOffsetZ(event.target.checked ? 1 : 0)}
                                />
                            </label>
                        )}
                    </div>
                </div>
            )}
            {(frameNow - savedAt) < 2500 && savedAt > 0 && (
                <div className="snowwar-banner snowwar-banner--saved">
                    {localizeWithFallback('snowwar.editor.saved', 'Arena saved! The next game uses the new layout.')}
                </div>
            )}

            {phase === 'preparing' && !editing && (
                <div className="snowwar-banner snowwar-banner--countdown">
                    {localizeWithFallback('snowwar.get_ready', 'Get ready!')} {preparingSeconds > 0 ? preparingSeconds : ''}
                </div>
            )}
            {(frameNow - rangeWarningAt) < 2000 && rangeWarningAt > 0 && (
                <div className="snowwar-banner snowwar-banner--warning">
                    {localizeWithFallback('snowwar.throw.too_far', 'Too far away! Use a long throw or move closer.')}
                </div>
            )}
            {phase === 'ending' && (
                <div className="snowwar-banner snowwar-banner--countdown">
                    {localizeWithFallback('snowwar.time_up', 'Time is up!')}
                </div>
            )}

            <div className="snowwar-viewport-wrap">
            <div
                ref={viewportRef}
                className="snowwar-viewport"
                onClick={onArenaClick}
                onContextMenu={onArenaClick}
            >
                <div
                    className="snowwar-world"
                    // Snap the camera translate to whole pixels. The easing keeps
                    // running in floats (cam.x/cam.y), but a fractional translate here
                    // makes the browser rasterise the whole arena subtree at a sub-pixel
                    // offset, so every scaled sprite (furni at 0.375, avatars) samples
                    // between pixels and looks blurry / shimmers while the camera moves.
                    style={{ width: stageW, height: stageH, transform: `translate(${Math.round(cameraX)}px, ${Math.round(cameraY)}px)`, transformOrigin: '0 0' }}
                >
                    {arenaBackdrop && !backdropOverlay && (
                        <img
                            alt=""
                            className="snowwar-arena-bg"
                            draggable={false}
                            src={arenaBackdrop.imageUrl}
                        />
                    )}
                    <div
                        className="snowwar-floor-layer"
                        style={{ left: floorOffsetX, top: floorOffsetY, width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
                    >
                        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="snowwar-floor" />

                    {arenaBackdrop && backdropOverlay && (
                        <img
                            alt=""
                            className="snowwar-arena-bg-overlay"
                            draggable={false}
                            src={arenaBackdrop.imageUrl}
                            style={{ width: canvasWidth, height: canvasHeight }}
                        />
                    )}

                    {displayItems.filter(item => !isClassicItem(item.name) && !item.imageUrl).map((item, index) =>
                    {
                        // A multi-tile furni occupies width x length tiles from its
                        // origin (+x/+y, swapped for the 90/270 rotations) - the same
                        // footprint the server blocks. Draw the sprite over the
                        // footprint CENTRE (a 1x1 prop is unchanged) and depth-sort by
                        // the FRONT (nearest-camera) tile, so a 3x3 prop sits on and
                        // occludes its whole footprint instead of drawing over an
                        // avatar standing beside or in front of it.
                        const swap = item.rotation === 2 || item.rotation === 6;
                        const effW = Math.max(1, (swap ? item.length : item.width) ?? 1);
                        const effL = Math.max(1, (swap ? item.width : item.length) ?? 1);
                        // Ground the furni at the FRONT (nearest-camera) corner of its
                        // footprint and anchor the image by its BOTTOM-CENTRE there, so
                        // its base rests on the floor (size-independent; a fixed % lift
                        // floated tall props). Depth, however, sorts by the ORIGIN (back)
                        // tile - the same rule Nitro uses for a real floor furni - so an
                        // avatar on the near sides (left/front) draws in front of the
                        // furni and only one standing behind it is covered.
                        const front = toScreen(item.x + effW - 1, item.y + effL - 1);
                        // Depth anchor = origin tile CENTRE (+ TILE_HALF_H), matching how
                        // avatars anchor (worldToScreen is tile-centre). Without the
                        // half-tile offset the furni sorted half a tile behind where it
                        // should, which tipped the overlay the wrong way for an avatar
                        // standing right at a corner.
                        const originY = toScreen(item.x, item.y).y + TILE_HALF_H;

                        const furniData = GetSessionDataManager()?.getFloorItemDataByName?.(item.name);
                        return (
                            <div
                                key={`furni-${index}-${furniRetryTick}`}
                                className="snowwar-furni"
                                style={{ left: front.x, top: front.y + (TILE_HALF_H * 2), zIndex: 100 + Math.round(originY) }}
                            >
                                {furniData
                                    ? <LayoutFurniImageView
                                        direction={item.rotation}
                                        productClassId={furniData.id}
                                        productType="s"
                                        style={{ position: 'absolute', transformOrigin: 'center bottom', transform: 'translate(-50%, -100%) scale(0.5)' }}
                                    />
                                    : <div className="snowwar-furni__fallback" />}
                            </div>
                        );
                    })}

                    {!editing && levelData.machines.map(machine =>
                    {
                        const state = simulation.machines.get(machine.objectId);
                        const { x, y } = toScreen(machine.x, machine.y);
                        return (
                            <div
                                key={machine.objectId}
                                // Depth-sort the pile like a floor furni (origin-tile
                                // anchor, same formula as avatars/furni) so it draws in
                                // front of anyone behind it and behind anyone in front,
                                // and sorts correctly against normal furniture too.
                                className="snowwar-machine"
                                // Depth anchor = tile CENTRE (+ TILE_HALF_H) to match the
                                // avatar reference, so the pile sorts cleanly at corners.
                                style={{ left: x, top: y, zIndex: 100 + Math.round(y + TILE_HALF_H) }}
                                title={localizeWithFallback('snowwar.machine.hint', 'Walk here to collect snowballs')}
                                // Clicking the machine walks you to its pickup tile (the
                                // tile in front of its left cell), where the server's
                                // auto-collect tops you up - it isn't an instant click
                                // grab, so give the player the one-click "go get ammo".
                                onClick={event =>
                                {
                                    event.stopPropagation();
                                    walkTo(tileToWorld(machine.x), tileToWorld(machine.y + 1));
                                }}
                            >
                                <div className="snowwar-machine__shadow" />
                                {SNOWWAR_PILE.map((ball, index) => (
                                    <span
                                        key={index}
                                        className="snowwar-machine__ball"
                                        style={{ left: ball.left, top: ball.top, zIndex: ball.z }}
                                    />
                                ))}
                                <div className="snowwar-machine__count">{state?.snowballCount ?? 0}</div>
                            </div>
                        );
                    })}

                    {editing && editSpawns.map((spawn, index) =>
                    {
                        const { x, y } = toScreen(spawn.x, spawn.y);
                        return <div key={`spawn-${index}`} className="snowwar-edit-spawn" style={{ left: x, top: y + TILE_HALF_H }} />;
                    })}

                    {editing && editItems.map((item, index) => item.imageUrl
                        ? (() =>
                        {
                            const { x, y } = toScreen(item.x, item.y);
                            return <div key={`admarker-${index}`} className="snowwar-edit-admarker" style={{ left: x, top: y + TILE_HALF_H }}>🖼</div>;
                        })()
                        : null)}

                    {editing && selectedIndex >= 0 && editItems[selectedIndex] && (() =>
                    {
                        const { x, y } = toScreen(editItems[selectedIndex].x, editItems[selectedIndex].y);
                        return <div className="snowwar-edit-selection" style={{ left: x, top: y + TILE_HALF_H }} />;
                    })()}

                    {[...simulation.snowballs.values()].map(ball =>
                    {
                        const lx = ball.prevLocH + (ball.locH - ball.prevLocH) * alpha;
                        const ly = ball.prevLocV + (ball.locV - ball.prevLocV) * alpha;
                        const lh = Math.max(0, ball.prevHeight + (ball.height - ball.prevHeight) * alpha);
                        const { x, y } = worldToScreen(lx, ly);
                        // Rendered arc = height above the throwing hand (world
                        // 3000). snowballRise raises the origin to the hand and
                        // halves the long-throw arc so it lands near the ground;
                        // the ball also grows near its peak.
                        const rise = snowballRise(lh, ball.trajectory);
                        const off = travelOffset(ball.locH - ball.prevLocH, ball.locV - ball.prevLocV);
                        const peakScale = 1 + Math.min(0.8, Math.max(0, lh - 3000) / 8000);
                        return (
                            <div
                                key={ball.objectId}
                                className={'snowwar-snowball' + (ball.trajectory === 2 ? ' snowwar-snowball--long' : '')}
                                style={{ left: x + off.x, top: y + off.y }}
                            >
                                <div className="snowwar-snowball__shadow" />
                                <div className="snowwar-snowball__ball" style={{ transform: `translateY(${-rise}px) scale(${peakScale})` }} />
                            </div>
                        );
                    })}

                    {splashes.map(splash =>
                        <div
                            key={splash.id}
                            className="snowwar-splash"
                            style={{ left: splash.x, top: splash.y }}
                            onAnimationEnd={() => setSplashes(list => list.filter(item => item.id !== splash.id))}
                        />
                    )}

                    {[...simulation.avatars.values()].map(avatar =>
                    {
                        const ax = avatar.prevWorldX + (avatar.worldX - avatar.prevWorldX) * alpha;
                        const ay = avatar.prevWorldY + (avatar.worldY - avatar.prevWorldY) * alpha;
                        const { x, y } = worldToScreen(ax, ay);
                        const isOwn = avatar.userId === ownUserId;
                        const walking = (avatar.worldX !== avatar.prevWorldX) || (avatar.worldY !== avatar.prevWorldY);
                        const throwUntil = throwPoseUntilRef.current.get(avatar.objectId) ?? 0;
                        const throwing = frameNow < throwUntil;
                        const throwProgress = throwing ? 1 - (throwUntil - frameNow) / SNOWWAR_THROW_POSE_MS : 0;
                        const stunned = avatar.activityState === SNOWWAR_STATE_STUNNED;
                        const invincible = avatar.activityState === SNOWWAR_STATE_INVINCIBLE;
                        const hit = simulation.subturnCount < avatar.hitFlashUntilSubturn;
                        const chat = chatMessages.filter(message => message.objectId === avatar.objectId).slice(-1)[0];
                        const showChat = chat && (frameNow - chat.receivedAt) < 5000;

                        return (
                            <div
                                key={avatar.objectId}
                                className={
                                    'snowwar-avatar' +
                                    (stunned ? ' snowwar-avatar--stunned' : '') +
                                    (invincible ? ' snowwar-avatar--invincible' : '') +
                                    (hit ? ' snowwar-avatar--hit' : '')
                                }
                                style={{ left: x, top: y, zIndex: 100 + Math.round(y) }}
                                onClick={event =>
                                {
                                    if (isOwn || !ownAvatar || avatar.teamId === ownAvatar.teamId) return;
                                    event.stopPropagation();
                                    // Plain click = straight (traj 0, 10 tiles); Shift = curved (traj 2, 20 tiles).
                                    const trajectory = event.shiftKey ? 2 : 0;
                                    if (!isThrowInRange(ownAvatar.tileX, ownAvatar.tileY, avatar.tileX, avatar.tileY, trajectory))
                                    {
                                        setRangeWarningAt(Date.now());
                                        return;
                                    }
                                    throwAtPlayer(avatar.objectId, trajectory);
                                }}
                            >
                                {showChat && <div className="snowwar-avatar__chat">{chat.message}</div>}
                                <div
                                    className={'snowwar-avatar__name' + (isOwn ? ' snowwar-avatar__name--own' : '')}
                                    style={{ color: TEAM_COLORS[avatar.teamId % TEAM_COLORS.length] }}
                                >
                                    {avatar.name}
                                </div>
                                <span className={'snowwar-avatar__body' + (hit ? ' snowwar-avatar__body--hit' : '')}>
                                    <SnowWarAvatarView
                                        figure={avatar.figure}
                                        gender={avatar.gender}
                                        direction={avatar.rotation}
                                        walking={walking && !stunned}
                                        throwing={throwing && !stunned}
                                        throwProgress={throwProgress}
                                        frameNow={frameNow}
                                        scale={0.5}
                                    />
                                </span>
                                {stunned && <div className="snowwar-avatar__stars">{'⭐⭐⭐'}</div>}
                            </div>
                        );
                    })}
                    </div>
                </div>
            </div>
            </div>

            {!editing && (
            <div className="snowwar-chat">
                <div className="snowwar-chat__log">
                    {chatMessages.slice(-4).map(message => (
                        <div key={message.id} className="snowwar-chat__line">
                            <b>{message.name}:</b> {message.message}
                        </div>
                    ))}
                </div>
                <input
                    type="text"
                    className="snowwar-chat__input"
                    value={chatInput}
                    maxLength={100}
                    placeholder={localizeWithFallback('snowwar.chat.placeholder', 'Say something...')}
                    onChange={event => setChatInput(event.target.value)}
                    onKeyDown={event =>
                    {
                        if (event.key !== 'Enter') return;
                        sendChat(chatInput);
                        setChatInput('');
                    }}
                />
            </div>
            )}

            <div className="snowwar-help">
                {editing
                    ? localizeWithFallback('snowwar.editor.help', 'Editor: pick a piece then click a tile • click a piece to select, then an empty tile to move • Floor paints tiles')
                    : localizeWithFallback('snowwar.help', 'Click: walk • Click enemy: throw • Shift+click: lob • Right-click: long throw')}
            </div>
        </div>
    );
};
