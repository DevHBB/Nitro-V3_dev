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

// Furni images come from getFurnitureFloorImage at geometry scale 64, i.e.
// authored for a 64px-wide tile (half-width 32). The SnowWar tile is only
// TILE_HALF_W*2 wide, so this scale makes one furni tile exactly cover one
// arena tile - a 2x2 grid furni then lines up with the 2x2 floor tiles instead
// of overhanging them.
const SNOWWAR_FURNI_SCALE = TILE_HALF_W / 32;

// Draws a small snowy tree on the arena canvas. `blue` picks the blue winter
// theme over red; `bushy` picks the round, snow-capped shape over the pointed
// tiered pine - so the four tree props read as two red + two blue, each pair
// with a distinct silhouette. Trunk is brown with a dab of snow.
const drawSnowTree = (context: CanvasRenderingContext2D, sx: number, centerY: number, blue: boolean, bushy: boolean): void =>
{
    const leaf = blue ? '#2f77c2' : '#c1392b';
    const leafDark = blue ? '#1f5490' : '#8f271d';
    const snow = '#f4fbff';

    // Trunk: brown, a touch of shadow on the right + snow at its base.
    context.fillStyle = '#6b4626';
    context.fillRect(sx - 2, centerY - 9, 4, 10);
    context.fillStyle = '#583920';
    context.fillRect(sx + 0.5, centerY - 9, 1.5, 10);
    context.fillStyle = snow;
    context.fillRect(sx - 3, centerY - 1, 6, 2);

    if (!bushy)
    {
        // Pointed pine: three stacked tiers (widest at the bottom), each with a
        // snow line, plus a snow cap on the tip.
        const tiers = [
            { base: centerY - 8, w: 13, h: 12 },
            { base: centerY - 17, w: 10, h: 11 },
            { base: centerY - 25, w: 7, h: 11 },
        ];
        for (const t of tiers)
        {
            context.beginPath();
            context.moveTo(sx, t.base - t.h);
            context.lineTo(sx + t.w, t.base);
            context.lineTo(sx - t.w, t.base);
            context.closePath();
            context.fillStyle = leaf;
            context.fill();
            context.strokeStyle = leafDark;
            context.lineWidth = 1;
            context.stroke();
            // Snow resting on the tier.
            context.strokeStyle = snow;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(sx - t.w + 1, t.base - 1);
            context.lineTo(sx - t.w * 0.3, t.base - 3);
            context.lineTo(sx + t.w * 0.25, t.base - 1);
            context.lineTo(sx + t.w - 1, t.base - 3);
            context.stroke();
        }
        context.fillStyle = snow;
        context.beginPath();
        context.arc(sx, centerY - 36, 2, 0, Math.PI * 2);
        context.fill();
    }
    else
    {
        // Bushy round tree: overlapping blobs, each with a snow cap on top.
        const blobs = [
            { x: sx, y: centerY - 12, r: 9 },
            { x: sx - 7, y: centerY - 9, r: 6 },
            { x: sx + 7, y: centerY - 9, r: 6 },
            { x: sx, y: centerY - 22, r: 7 },
        ];
        context.lineWidth = 1;
        for (const b of blobs)
        {
            context.beginPath();
            context.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            context.fillStyle = leaf;
            context.fill();
            context.strokeStyle = leafDark;
            context.stroke();
        }
        context.fillStyle = snow;
        for (const b of blobs)
        {
            context.beginPath();
            context.arc(b.x, b.y - (b.r * 0.45), b.r * 0.62, Math.PI, Math.PI * 2);
            context.fill();
        }
    }
};

// Footprint (in tiles) of the flat floor-tile props. These are drawn as N×N
// isometric floor diamonds and are walkable / height-0 (a snowball flies over).
const CLASSIC_SIZES: Record<string, { w: number; l: number }> = {
    block_basic: { w: 1, l: 1 },
    block_basic2: { w: 2, l: 2 },
    block_basic3: { w: 4, l: 4 },
    block_ice: { w: 1, l: 1 },
    block_ice2: { w: 2, l: 2 },
    block_ice3: { w: 4, l: 4 },
    block_water1: { w: 1, l: 1 },
    block_water2: { w: 2, l: 2 },
    block_water3: { w: 3, l: 3 },
};

// Draws one flat isometric floor tile (diamond) with its top vertex at (tsx,tsy).
const drawFloorDiamond = (context: CanvasRenderingContext2D, tsx: number, tsy: number, kind: 'stone' | 'ice' | 'water'): void =>
{
    const midY = tsy + TILE_HALF_H;
    const bottomY = tsy + (TILE_HALF_H * 2);

    context.beginPath();
    context.moveTo(tsx, tsy);
    context.lineTo(tsx + TILE_HALF_W, midY);
    context.lineTo(tsx, bottomY);
    context.lineTo(tsx - TILE_HALF_W, midY);
    context.closePath();

    if (kind === 'water')
    {
        // Deep-to-light vertical gradient so the tile reads as water with depth.
        const gradient = context.createLinearGradient(tsx, tsy, tsx, bottomY);
        gradient.addColorStop(0, '#7cc3ec');
        gradient.addColorStop(1, '#2f7cb8');
        context.fillStyle = gradient;
    }
    else
    {
        context.fillStyle = kind === 'ice' ? '#bfe6f7' : '#c7cfd6';
    }
    context.fill();
    context.strokeStyle = kind === 'ice' ? '#7fbfe0' : kind === 'water' ? '#276fa8' : '#9aa5b0';
    context.lineWidth = 1;
    context.stroke();

    if (kind === 'ice')
    {
        // Glossy highlight: a bright facet in the upper-left of the tile.
        context.fillStyle = 'rgba(255, 255, 255, 0.55)';
        context.beginPath();
        context.moveTo(tsx, tsy + 2);
        context.lineTo(tsx - TILE_HALF_W * 0.55, tsy + TILE_HALF_H * 0.7);
        context.lineTo(tsx, tsy + TILE_HALF_H);
        context.lineTo(tsx + TILE_HALF_W * 0.3, tsy + TILE_HALF_H * 0.55);
        context.closePath();
        context.fill();
    }
    else if (kind === 'water')
    {
        // Two short wavy ripples across the middle, kept well inside the diamond.
        context.strokeStyle = 'rgba(226, 246, 255, 0.75)';
        context.lineWidth = 1;
        for (const dy of [-2.5, 2])
        {
            context.beginPath();
            context.moveTo(tsx - 6, midY + dy);
            context.quadraticCurveTo(tsx - 3, midY + dy - 1.4, tsx, midY + dy);
            context.quadraticCurveTo(tsx + 3, midY + dy + 1.4, tsx + 6, midY + dy);
            context.stroke();
        }
    }
};

// Draws a classic SnowWar prop (tree / snowman / floor tile / block) by
// classname, anchored at the tile whose top vertex is (sx, sy). Shared by the
// placed-item pass and the editor placement preview so the ghost matches
// exactly what gets placed.
const drawClassicProp = (context: CanvasRenderingContext2D, name: string, sx: number, sy: number, rotation = 0): void =>
{
    const centerY = sy + TILE_HALF_H;

    if (name.startsWith('sw_fence'))
    {
        // A low wooden fence running along one tile axis, centred so adjacent
        // fences of the same orientation join up edge-to-edge. sw_fence2 defaults
        // to the other diagonal; rotating (2/6) flips whichever it is.
        const orientB = (name === 'sw_fence2') !== (rotation === 2 || rotation === 6);
        const hw = TILE_HALF_W / 2;
        const hh = TILE_HALF_H / 2;
        const p0 = orientB ? { x: sx + hw, y: centerY - hh } : { x: sx - hw, y: centerY - hh };
        const p1 = orientB ? { x: sx - hw, y: centerY + hh } : { x: sx + hw, y: centerY + hh };
        const fh = 13;

        // Two horizontal rails.
        context.strokeStyle = '#caa063';
        context.lineWidth = 1.6;
        for (const ry of [fh * 0.4, fh * 0.85])
        {
            context.beginPath();
            context.moveTo(p0.x, p0.y - ry);
            context.lineTo(p1.x, p1.y - ry);
            context.stroke();
        }
        // Posts (back to front), each with a small cap.
        context.lineWidth = 2;
        for (const t of [0, 0.5, 1])
        {
            const px = p0.x + ((p1.x - p0.x) * t);
            const py = p0.y + ((p1.y - p0.y) * t);
            context.strokeStyle = '#8a6436';
            context.beginPath();
            context.moveTo(px, py);
            context.lineTo(px, py - fh);
            context.stroke();
            context.fillStyle = '#a87c48';
            context.fillRect(px - 1, py - fh - 1, 2, 2);
        }
        return;
    }

    if (name.startsWith('sw_tree'))
    {
        const blue = name === 'sw_tree3' || name === 'sw_tree4';
        const bushy = name === 'sw_tree2' || name === 'sw_tree4';
        drawSnowTree(context, sx, centerY, blue, bushy);
        return;
    }

    if (name.startsWith('obst_snowman'))
    {
        const outline = '#a9bccb';
        // Three stacked snow balls (bottom, middle, head), each shaded with a
        // radial gradient for a rounded 3D look.
        const balls = [
            { cy: centerY - 6, r: 8 },
            { cy: centerY - 17, r: 6 },
            { cy: centerY - 26, r: 4.5 },
        ];
        for (const b of balls)
        {
            const g = context.createRadialGradient(sx - (b.r * 0.35), b.cy - (b.r * 0.35), b.r * 0.2, sx, b.cy, b.r);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(1, '#d5e2ec');
            context.fillStyle = g;
            context.beginPath();
            context.arc(sx, b.cy, b.r, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = outline;
            context.lineWidth = 1;
            context.stroke();
        }

        const mid = balls[1];
        const head = balls[2];

        // Twig arms from the middle ball.
        context.strokeStyle = '#7a5230';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(sx - 5, mid.cy - 1);
        context.lineTo(sx - 11, mid.cy - 5);
        context.moveTo(sx - 8, mid.cy - 3);
        context.lineTo(sx - 10, mid.cy - 6);
        context.moveTo(sx + 5, mid.cy - 1);
        context.lineTo(sx + 11, mid.cy - 5);
        context.moveTo(sx + 8, mid.cy - 3);
        context.lineTo(sx + 10, mid.cy - 6);
        context.stroke();

        // Coal buttons on the middle ball.
        context.fillStyle = '#3a4652';
        for (const dy of [-2, 1.5])
        {
            context.beginPath();
            context.arc(sx, mid.cy + dy, 0.9, 0, Math.PI * 2);
            context.fill();
        }

        // Red scarf between head and middle.
        context.fillStyle = '#c0392b';
        context.fillRect(sx - 4, head.cy + head.r - 1.5, 8, 2.5);
        context.fillRect(sx + 2, head.cy + head.r, 2.5, 4);

        // Eyes + carrot nose.
        context.fillStyle = '#2b333b';
        context.beginPath();
        context.arc(sx - 1.6, head.cy - 0.6, 0.9, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(sx + 1.6, head.cy - 0.6, 0.9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#e8912f';
        context.beginPath();
        context.moveTo(sx, head.cy + 0.4);
        context.lineTo(sx + 5, head.cy + 1);
        context.lineTo(sx, head.cy + 1.8);
        context.closePath();
        context.fill();

        // Small black top hat.
        context.fillStyle = '#2b333b';
        context.fillRect(sx - 5, head.cy - head.r - 1, 10, 1.6);
        context.fillRect(sx - 3, head.cy - head.r - 6, 6, 5);
        return;
    }

    // Flat floor tiles (basic / ice): a walkable N×N patch drawn as isometric
    // diamonds over the footprint, matching the arena tile shape.
    const size = CLASSIC_SIZES[name];
    if (size)
    {
        const kind = name.includes('ice') ? 'ice' : name.includes('water') ? 'water' : 'stone';
        for (let dx = 0; dx < size.w; dx++)
        {
            for (let dy = 0; dy < size.l; dy++)
            {
                const tsx = sx + ((dx - dy) * TILE_HALF_W);
                const tsy = sy + ((dx + dy) * TILE_HALF_H);
                drawFloorDiamond(context, tsx, tsy, kind);
            }
        }
        return;
    }

    // Any other block / fence / obstacle: raised cube.
    const height = name.includes('3') ? 26 : name.includes('2') ? 18 : 10;
    const isIce = name.includes('ice');
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
};

// A flat floor tile stays on the shared floor canvas (below avatars); every
// other classic prop (trees/snowman/fences/blocks) is a standalone sprite that
// depth-sorts with the avatars.
const isFlatFloorProp = (name: string) => !!CLASSIC_SIZES[name];

// Per-prop sprite box: big enough for the tallest prop (trees ~ 40px up) plus
// the tile's lower half. PROP_ANCHOR_Y is the tile top-vertex inside the box.
const PROP_BOX_W = 40;
const PROP_BOX_H = 54;
const PROP_ANCHOR_Y = 40;

// One tall classic prop drawn into its own little canvas, so it can sit in the
// DOM at a per-tile z-index and be occluded by / occlude avatars just like a
// hotel furni. Redraws only when the prop or its rotation changes.
const ClassicPropSprite: FC<{ name: string; rotation: number; opacity?: number }> = ({ name, rotation, opacity }) =>
{
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() =>
    {
        const context = ref.current?.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, PROP_BOX_W, PROP_BOX_H);
        drawClassicProp(context, name, PROP_BOX_W / 2, PROP_ANCHOR_Y, rotation);
    }, [name, rotation]);
    return <canvas ref={ref} width={PROP_BOX_W} height={PROP_BOX_H} className="snowwar-classic-prop-canvas" style={opacity != null ? { opacity } : undefined} />;
};

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
// How long a tree's canopy shakes after a snowball hits it (matches the CSS
// shake keyframe duration).
const TREE_SHAKE_MS = 500;
// How long the snowman squash-bounces after a snowball hits it (matches the CSS
// bonk keyframe duration).
const SNOWMAN_BONK_MS = 450;
const SNOWWAR_THROW_HAND_RISE = 34;
// A normal (straight, non-shift) throw skims flat, ~0.5 tile above the ground,
// rather than arcing up. Lob/long throws keep their arc.
const SNOWWAR_FLAT_RISE = 10;
const snowballRise = (height: number, trajectory: number): number =>
{
    if (trajectory === 0) return SNOWWAR_FLAT_RISE;
    const arc = Math.min(120, Math.max(0, height - 3000) / 60);
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

interface EditItem { name: string; x: number; y: number; rotation: number; imageUrl: string; offsetZ: number; width?: number; length?: number; state: number; stateCount?: number; walkableHeight?: number }

// Editor preview walker: a purely client-side avatar you can stroll around the
// arena while editing (no server / game simulation involved), to test the
// layout. It steps one tile every SNOWWAR_EDITOR_STEP_MS.
const SNOWWAR_EDITOR_STEP_MS = 260;

interface EditorWalk { path: { x: number; y: number }[]; startMs: number; endDir: number }

// Tile delta -> Habbo 8-direction (0 N .. 7 NW; +x = E, +y = S on the grid).
const tileDirection = (dx: number, dy: number): number =>
{
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    if (sx === 0 && sy > 0) return 4;
    if (sx > 0 && sy > 0) return 3;
    if (sx > 0 && sy === 0) return 2;
    if (sx > 0 && sy < 0) return 1;
    if (sx === 0 && sy < 0) return 0;
    if (sx < 0 && sy < 0) return 7;
    if (sx < 0 && sy === 0) return 6;
    if (sx < 0 && sy > 0) return 5;
    return 4;
};

// Breadth-first shortest walk over the '0' (walkable) heightmap tiles, 8-way but
// never cutting a diagonal through a void corner. Returns the tile path
// (including the start) or null when the target is void / unreachable.
const findEditorPath = (rows: string[], from: { x: number; y: number }, to: { x: number; y: number }, width: number, height: number, blocked?: Set<number>): { x: number; y: number }[] | null =>
{
    const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && rows[y]?.charAt(x) === '0' && !(blocked?.has((y * width) + x));
    if (!walkable(from.x, from.y) || !walkable(to.x, to.y)) return null;
    if (from.x === to.x && from.y === to.y) return [from];

    const key = (x: number, y: number) => (y * width) + x;
    const prev = new Map<number, number>();
    const seen = new Set<number>([key(from.x, from.y)]);
    const queue: { x: number; y: number }[] = [from];
    const steps = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];

    while (queue.length)
    {
        const cur = queue.shift();
        if (cur.x === to.x && cur.y === to.y)
        {
            const path: { x: number; y: number }[] = [];
            let cx = cur.x;
            let cy = cur.y;
            let k = key(cx, cy);
            for (;;)
            {
                path.unshift({ x: cx, y: cy });
                if (cx === from.x && cy === from.y) break;
                k = prev.get(k);
                cx = k % width;
                cy = Math.floor(k / width);
            }
            return path;
        }
        for (const s of steps)
        {
            const nx = cur.x + s.dx;
            const ny = cur.y + s.dy;
            if (!walkable(nx, ny)) continue;
            // No diagonal corner-cutting: both orthogonal neighbours must be open.
            if (s.dx !== 0 && s.dy !== 0 && (!walkable(cur.x + s.dx, cur.y) || !walkable(cur.x, cur.y + s.dy))) continue;
            const nk = key(nx, ny);
            if (seen.has(nk)) continue;
            seen.add(nk);
            prev.set(nk, key(cur.x, cur.y));
            queue.push({ x: nx, y: ny });
        }
    }
    return null;
};

// Placeable classnames for the in-arena editor, mirroring the server's
// SnowWarItemProperties registry.
const EDITOR_PALETTE = [
    'sw_tree1', 'sw_tree2', 'sw_tree3', 'sw_tree4',
    'block_basic', 'block_basic2', 'block_basic3',
    'block_ice', 'block_ice2', 'block_ice3',
    'block_water1', 'block_water2', 'block_water3',
    'obst_snowman', 'sw_fence', 'sw_fence2',
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
    // Classic props (trees/blocks/fences/floor tiles) draw on their own canvas
    // ABOVE the ad backdrop overlay, so "hide tiles behind image" only hides the
    // floor grid - the props stay visible, like the hotel furni.
    const propsCanvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    // Dead-zone follow camera: persisted translate + per-axis "recentring"
    // latch. Advanced at most once per animation frame (see the camera block).
    const cameraRef = useRef({ x: 0, y: 0, frame: -1, recenterX: false, recenterY: false, initialized: false });
    // Wall-clock of the last animation frame; doubles as the re-render tick.
    const [frameNow, setFrameNow] = useState(0);
    const [chatInput, setChatInput] = useState('');
    const zoom = ZOOM;
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    // Set when a throw is blocked for being out of range; shows a short hint.
    const [rangeWarningAt, setRangeWarningAt] = useState(0);
    const ownUserId = GetSessionDataManager()?.userId ?? 0;

    // Snow-burst splashes: a short CSS animation spawned wherever a snowball
    // vanishes (server-authoritative removal = a hit on furni/another player,
    // or the ball landing). ballScreenRef holds last frame's on-screen ball
    // positions so we can diff against this frame and splash the ones that went.
    const [splashes, setSplashes] = useState<{ id: number; x: number; y: number }[]>([]);
    const ballScreenRef = useRef<Map<number, { x: number; y: number; tx: number; ty: number }>>(new Map());
    const splashIdRef = useRef(0);
    // Tree hit reaction: tileKey -> frameNow deadline until which that tree's
    // canopy shakes, plus a small pool of falling snowflakes spawned on the hit.
    const treeShakeUntilRef = useRef<Map<string, number>>(new Map());
    const [treeSnow, setTreeSnow] = useState<{ id: number; x: number; y: number }[]>([]);
    const snowIdRef = useRef(0);
    // Ball objectIds that have already produced a splash. A ball can vanish,
    // get re-added by a full-status resync, then vanish again - this makes sure
    // each ball splashes at most once (object ids are unique per game, and the
    // arena remounts between games, so the set never needs manual pruning).
    const splashedBallsRef = useRef<Set<number>>(new Set());
    // avatar objectId -> frameNow timestamp until which that avatar holds the
    // SnowWarThrow pose. Set when a new snowball appears (that ball's thrower).
    const throwPoseUntilRef = useRef<Map<number, number>>(new Map());

    // In-arena editor state (only meaningful while `editing`).
    const [editItems, setEditItems] = useState<EditItem[]>([]);
    const [editHeightmap, setEditHeightmap] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    // Palette selection: a classname to place, 'floor'/'walk' to paint tiles,
    // or null for select/move mode. Spawns aren't placed by hand - the game
    // picks them automatically from walkable tiles at match start.
    const [paletteSel, setPaletteSel] = useState<string | null>(null);
    const [furniSearch, setFurniSearch] = useState('');
    const [savedAt, setSavedAt] = useState(0);
    // Tile under the cursor while editing - drives the 80%-opacity placement
    // ghost. Only updated when it changes, so it doesn't churn renders.
    const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

    // Editor preview walker (client-side only). Held in a ref and animated off
    // the RAF frameNow clock; the current interpolated position is computed in
    // render, so moving it never triggers extra state churn.
    const editorWalkRef = useRef<EditorWalk | null>(null);

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
        setEditItems((levelData?.items ?? []).map(item =>
        {
            // Flat floor-tile props carry a fixed footprint client-side (the
            // server treats them as 1x1 non-blocking floor), so their selection
            // box + walkable band match how they're drawn.
            const classicSize = CLASSIC_SIZES[item.name];
            return {
                name: item.name, x: item.x, y: item.y, rotation: item.rotation, imageUrl: item.imageUrl, offsetZ: item.offsetZ ?? 0,
                width: classicSize?.w ?? item.width, length: classicSize?.l ?? item.length,
                state: item.state ?? 0, stateCount: item.stateCount,
                // Use the server's walkable height (0 for basic/ice, 1 for water).
                walkableHeight: item.walkableHeight,
            };
        }));
        setEditHeightmap([...(levelData?.heightmapRows ?? [])]);
        setSelectedIndex(-1);
        setPaletteSel(null);
        setFurniSearch('');

        // Drop the preview walker on the walkable tile nearest the arena centre.
        const rows = levelData?.heightmapRows ?? [];
        const rowH = rows.length;
        const rowW = rows.reduce((max, row) => Math.max(max, row.length), 0);
        let start: { x: number; y: number } | null = null;
        let best = Infinity;
        for (let y = 0; y < rowH; y++)
        {
            for (let x = 0; x < rows[y].length; x++)
            {
                if (rows[y].charAt(x) !== '0') continue;
                const dist = ((x - (rowW / 2)) ** 2) + ((y - (rowH / 2)) ** 2);
                if (dist < best) { best = dist; start = { x, y }; }
            }
        }
        editorWalkRef.current = start ? { path: [start], startMs: 0, endDir: 4 } : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    // Current walker tile (rounded) at call time - used to path from where it
    // stands right now, whether idle or mid-step.
    const walkerTileNow = useCallback((): { x: number; y: number } | null =>
    {
        const plan = editorWalkRef.current;
        if (!plan || !plan.path.length) return null;
        if (plan.path.length === 1) return plan.path[0];
        const total = plan.path.length - 1;
        const stepFloat = Math.max(0, Date.now() - plan.startMs) / SNOWWAR_EDITOR_STEP_MS;
        if (stepFloat >= total) return plan.path[total];
        const seg = Math.floor(stepFloat);
        const t = stepFloat - seg;
        const a = plan.path[seg];
        const b = plan.path[seg + 1];
        return { x: Math.round(a.x + ((b.x - a.x) * t)), y: Math.round(a.y + ((b.y - a.y) * t)) };
    }, []);


    // The arena renders the editor's working copy while editing, the live
    // level items otherwise. Both references are stable across renders.
    const displayItems = editing ? editItems : (levelData?.items ?? []);

    // classname -> interaction_modes_count, learned from the server's level data.
    // Lets the editor cap a freshly-placed furni's state stepper when that furni
    // type already appears in the arena (the palette/furnidata carries no state
    // count). Unknown types stay uncapped until the arena is saved and reloaded.
    const stateCountByName = useMemo(() =>
    {
        const map = new Map<string, number>();
        for (const item of (levelData?.items ?? []))
        {
            if (item.stateCount && item.stateCount > 0) map.set(item.name, item.stateCount);
        }
        return map;
    }, [levelData]);

    const mapRows = editing ? editHeightmap : (levelData?.heightmapRows ?? []);
    const mapHeight = mapRows.length;
    const mapWidth = mapHeight > 0 ? mapRows[0].length : 0;

    // Path the preview walker to a tile (client-side only). Returns true if a
    // walk was started, so callers can tell a walk from a no-op empty click.
    const walkPreviewTo = useCallback((tileX: number, tileY: number): boolean =>
    {
        const from = walkerTileNow();
        if (!from) return false;
        // Tiles blocked for the preview walker: any non-walkable piece
        // (walkableHeight > 0 - water, trees, blocks, solid furni) over its whole
        // footprint, so the walker routes around them just like in-game.
        const blocked = new Set<number>();
        for (const it of editItems)
        {
            if ((it.walkableHeight ?? 0) <= 0) continue;
            const swap = it.rotation === 2 || it.rotation === 6;
            const w = Math.max(1, (swap ? it.length : it.width) ?? 1);
            const l = Math.max(1, (swap ? it.width : it.length) ?? 1);
            for (let dx = 0; dx < w; dx++)
            {
                for (let dy = 0; dy < l; dy++)
                {
                    blocked.add(((it.y + dy) * mapWidth) + (it.x + dx));
                }
            }
        }
        const path = findEditorPath(mapRows, from, { x: tileX, y: tileY }, mapWidth, mapHeight, blocked);
        if (!path || path.length < 2) return false;
        const last = path[path.length - 1];
        const prevTile = path[path.length - 2];
        editorWalkRef.current = { path, startMs: Date.now(), endDir: tileDirection(last.x - prevTile.x, last.y - prevTile.y) };
        return true;
    }, [mapRows, mapWidth, mapHeight, walkerTileNow, editItems]);

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

        // Classic props draw on a SEPARATE canvas that sits above the ad
        // backdrop overlay, so toggling "hide tiles behind image" hides only the
        // floor grid (this canvas) and not the props.
        const propsCanvas = propsCanvasRef.current;
        const propsContext = propsCanvas?.getContext('2d');
        if (!propsContext) return;
        propsContext.clearRect(0, 0, propsCanvas.width, propsCanvas.height);

        for (const item of displayItems)
        {
            // Only the FLAT floor tiles (basic/ice/water) draw on this canvas -
            // they sit on the ground below the avatars. The tall props (trees,
            // snowman, fences, blocks) are DOM sprites that depth-sort with the
            // avatars, and hotel furni are their own DOM images.
            if (!isFlatFloorProp(item.name)) continue;

            const { x: sx, y: sy } = toScreen(item.x, item.y);
            drawClassicProp(propsContext, item.name, sx, sy, item.rotation);
        }

        // Placement preview for a flat floor tile (tall props get a DOM ghost).
        if (editing && paletteSel && isFlatFloorProp(paletteSel) && hoverTile)
        {
            const { x: sx, y: sy } = toScreen(hoverTile.x, hoverTile.y);
            propsContext.save();
            propsContext.globalAlpha = 0.55;
            drawClassicProp(propsContext, paletteSel, sx, sy);
            propsContext.restore();
        }
    }, [displayItems, mapHeight, mapWidth, mapRows, toScreen, editing, paletteSel, hoverTile]);

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
        if (paletteSel === 'walk')
        {
            // Stroll the client-side preview avatar to the clicked tile.
            walkPreviewTo(tileX, tileY);
            return;
        }

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

        if (paletteSel && paletteSel !== 'edit')
        {
            // Carry the real footprint (and walkable flag) from furnidata so the
            // placed furni anchors exactly like the placement ghost - otherwise it
            // defaults to 1x1 and jumps position the moment it's dropped.
            const fd = GetSessionDataManager()?.getFloorItemDataByName?.(paletteSel);
            const classicSize = CLASSIC_SIZES[paletteSel];
            // Water and fences are NON-walkable (you'd fall in / can't cross);
            // the flat floor tiles (basic/ice) are walkable.
            const isBlocking = paletteSel.startsWith('block_water') || paletteSel.startsWith('sw_fence');
            const walkable = !isBlocking && (!!(fd?.canStandOn || fd?.canLayOn) || !!classicSize);
            setEditItems(items => [...items, {
                name: paletteSel, x: tileX, y: tileY, rotation: 0, imageUrl: '', offsetZ: 0, state: 0,
                stateCount: stateCountByName.get(paletteSel),
                width: fd?.tileSizeX ?? classicSize?.w, length: fd?.tileSizeY ?? classicSize?.l,
                // Solid furni (anything not a rug/floor-tile) must BLOCK: encode a
                // positive walkableHeight, never undefined - the preview walker
                // treats undefined as walkable and would walk through it. The saved
                // arena still re-derives walkability server-side from the base item.
                walkableHeight: walkable ? 0 : 1,
            }]);
            // Keep the palette piece armed so you can drop several in a row; it
            // stays selected (ghost keeps following) until you pick it again to
            // toggle it off, or choose another piece / mode.
            return;
        }

        // Selection modes: 'edit' (paletteSel === 'edit') just picks a piece to
        // tweak in place (rotate / state / delete); Select/Move (paletteSel ===
        // null) additionally drops the selected piece on an empty tile. Both
        // select the piece under the click.
        // When a piece is already picked up for a move (Select/Move), a click
        // should DROP it on the tile - even a tile covered by a flat floor tile
        // (basic/ice/water) - instead of the flat tile grabbing the click and
        // re-selecting itself. So skip flat floor tiles (and the moving piece
        // itself) in the hit-test while relocating; solid furni still re-select.
        const relocating = paletteSel === null && selectedIndex >= 0;
        let hitIndex = -1;
        for (let i = editItems.length - 1; i >= 0; i--)
        {
            const it = editItems[i];
            if (relocating && (i === selectedIndex || isFlatFloorProp(it.name))) continue;
            // Hit-test the whole footprint (rotation swaps width/length), not
            // just the origin tile, so clicking any tile of a 3x3 / 2x1 / ...
            // furni selects it.
            const swap = it.rotation === 2 || it.rotation === 6;
            const effW = Math.max(1, (swap ? it.length : it.width) ?? 1);
            const effL = Math.max(1, (swap ? it.width : it.length) ?? 1);
            if (tileX >= it.x && tileX < it.x + effW && tileY >= it.y && tileY < it.y + effL) { hitIndex = i; break; }
        }

        if (hitIndex >= 0) { setSelectedIndex(hitIndex); return; }

        // Only Select/Move relocates on an empty-tile click; Edit leaves the
        // piece where it is so you can't nudge it by accident while editing.
        if (paletteSel === null && selectedIndex >= 0)
        {
            setEditItems(items => items.map((item, i) => (i === selectedIndex ? { ...item, x: tileX, y: tileY } : item)));
            // Dropped at the new tile - deselect so the moved furni shows at its
            // new spot and stops following the cursor.
            setSelectedIndex(-1);
            setHoverTile(null);
            return;
        }

        // Empty tile clicked in a selection mode with nothing to move: stroll the
        // preview avatar there too, so walking works without switching to the
        // dedicated Walk mode.
        if (paletteSel === null || paletteSel === 'edit') walkPreviewTo(tileX, tileY);
        setSelectedIndex(-1);
    }, [paletteSel, editItems, selectedIndex, stateCountByName, walkPreviewTo]);

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

    // Multistate furni: step the state index up/down, clamped to the furni's
    // real range - [0, interaction_modes_count - 1] from items_base, sent by the
    // server. When the count is unknown (a freshly-placed furni type not yet in
    // the arena), leave the high end open until the arena is saved and reloaded.
    const cycleState = useCallback((delta: number) =>
        setEditItems(items => items.map((item, i) =>
        {
            if (i !== selectedIndex) return item;
            const count = item.stateCount ?? stateCountByName.get(item.name);
            const max = count && count > 0 ? count - 1 : Number.MAX_SAFE_INTEGER;
            return { ...item, state: Math.min(max, Math.max(0, (item.state ?? 0) + delta)) };
        })),
    [selectedIndex, stateCountByName]);

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
            return [...items, { name: 'ads_background', x: 0, y: 0, rotation: 0, imageUrl: trimmed, offsetZ: 0, state: 0 }];
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
        // Spawns are auto-generated server-side, so none are sent from the editor.
        saveArena(levelData.mapId, editItems, [], editHeightmap);
        setSavedAt(Date.now());
    }, [levelData, editItems, editHeightmap, saveArena]);

    const ownAvatar = simulation.getAvatarByUserId(ownUserId);
    const alpha = simulation.interpolationAlpha;

    // Detect snowballs that disappeared since the last frame and spawn a splash
    // at their last on-screen spot. Runs every animation frame (frameNow tick).
    // A bulk vanish (round end / arena reset) is ignored so we don't spray the
    // whole map with splashes.
    useEffect(() =>
    {
        const prev = ballScreenRef.current;
        const next = new Map<number, { x: number; y: number; tx: number; ty: number }>();
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
            next.set(ball.objectId, { x, y: y - rise, tx: Math.round(lx / TILE_SIZE_WORLD), ty: Math.round(ly / TILE_SIZE_WORLD) });

            // A newly-appeared ball means its thrower just threw - flash that
            // avatar into the SnowWarThrow pose for a short window.
            if (!prev.has(ball.objectId) && ball.throwerObjectId)
            {
                throwPoseUntilRef.current.set(ball.throwerObjectId, frameNow + SNOWWAR_THROW_POSE_MS);
            }
        }

        // A ball is "gone" only the first time its objectId disappears; a
        // resync that clears then re-adds the same ball must not splash twice.
        const gone: { ballId: number; x: number; y: number; tx: number; ty: number }[] = [];
        prev.forEach((pos, id) =>
        {
            if (!next.has(id) && !splashedBallsRef.current.has(id))
            {
                gone.push({ ballId: id, x: pos.x, y: pos.y, tx: pos.tx, ty: pos.ty });
            }
        });
        ballScreenRef.current = next;

        // A bulk vanish (round end / arena reset) is ignored so we don't spray
        // the whole map with splashes.
        if (gone.length > 0 && gone.length <= 3)
        {
            gone.forEach(g => splashedBallsRef.current.add(g.ballId));
            setSplashes(list => [...list, ...gone.map(g => ({ id: ++splashIdRef.current, x: g.x, y: g.y }))]);

            // If a ball vanished on (or next to) a tree or the snowman, react:
            // trees sway their canopy, the snowman does a little squash-bounce -
            // and both puff a few snowflakes loose.
            const flakes: { id: number; x: number; y: number }[] = [];
            for (const g of gone)
            {
                const prop = displayItems.find(item => (item.name.startsWith('sw_tree') || item.name.startsWith('obst_snowman'))
                    && Math.abs(item.x - g.tx) <= 1 && Math.abs(item.y - g.ty) <= 1);
                if (!prop) continue;
                const snowman = prop.name.startsWith('obst_snowman');
                treeShakeUntilRef.current.set(`${prop.x},${prop.y}`, frameNow + (snowman ? SNOWMAN_BONK_MS : TREE_SHAKE_MS));
                const { x: cx, y: cy } = toScreen(prop.x, prop.y);
                // Snowman is shorter than a tree, so puff from lower down.
                const puffY = snowman ? -12 : -22;
                for (const ox of [-7, -3, 1, 5, 9])
                {
                    flakes.push({ id: ++snowIdRef.current, x: cx + ox, y: cy + puffY + ((ox + 7) % 6) });
                }
            }
            if (flakes.length) setTreeSnow(list => [...list, ...flakes]);
        }
    }, [frameNow, alpha, worldToScreen, toScreen, simulation, displayItems]);

    // First room-ad furni's image is the arena backdrop. offsetZ doubles as an
    // overlay flag: 0 = drawn behind the arena (full-screen), 1 = overlaid on
    // top of the floor tiles (hiding them, but they stay walkable) while still
    // sitting under the furni and avatars. Edit-aware so it previews live.
    const arenaBackdrop = displayItems.find(item => item.imageUrl) ?? null;
    const backdropOverlay = !!(arenaBackdrop && (arenaBackdrop.offsetZ ?? 0) > 0);
    const selectedItem = (editing && selectedIndex >= 0 && editItems[selectedIndex]) ? editItems[selectedIndex] : null;
    const placingFurni = (editing && paletteSel && paletteSel !== 'floor' && paletteSel !== 'edit')
        ? GetSessionDataManager()?.getFloorItemDataByName?.(paletteSel) : null;
    const selectedFurni = selectedItem ? GetSessionDataManager()?.getFloorItemDataByName?.(selectedItem.name) : null;
    const backdropItem = editing ? (editItems.find(item => item.imageUrl) ?? null) : null;

    // Interaction-mode count for the selected furni (items_base value from the
    // server). Known => the stepper caps at count-1 and single-state furni hide
    // it entirely; unknown => leave the stepper open (freshly-placed new type).
    const selectedStateCount = selectedItem ? (selectedItem.stateCount ?? stateCountByName.get(selectedItem.name)) : undefined;
    const selectedStateMax = (selectedStateCount && selectedStateCount > 0) ? selectedStateCount - 1 : Number.MAX_SAFE_INTEGER;

    // Placement ghost: the furni being placed (palette pick) or the selected
    // furni being moved, previewed at the hovered tile at 80% opacity.
    const ghostFurni = placingFurni ?? (selectedItem ? selectedFurni : null);
    const ghostRotation = placingFurni ? 0 : (selectedItem?.rotation ?? 0);
    // A freshly-placed furni starts at state 0; a moving furni keeps its state.
    const ghostState = placingFurni ? 0 : (selectedItem?.state ?? 0);

    // "Actively moving": Select/Move mode (paletteSel === null) with a piece
    // selected and the cursor over a tile. Only then do we hide the piece at its
    // old spot, float the move ghost, and suppress the selection box. Edit mode
    // (paletteSel === 'edit') never moves, so it keeps the piece + selection box.
    const movingSelected = editing && paletteSel === null && !!selectedItem && !!hoverTile;

    // Editor preview walker: current interpolated tile position + facing, derived
    // purely from the walk plan + the RAF frameNow clock (recomputed each frame).
    const editorWalker = (() =>
    {
        if (!editing) return null;
        const plan = editorWalkRef.current;
        if (!plan || !plan.path.length) return null;
        if (plan.path.length === 1) return { x: plan.path[0].x, y: plan.path[0].y, dir: plan.endDir, walking: false };
        const total = plan.path.length - 1;
        const stepFloat = Math.max(0, frameNow - plan.startMs) / SNOWWAR_EDITOR_STEP_MS;
        if (stepFloat >= total)
        {
            const last = plan.path[total];
            return { x: last.x, y: last.y, dir: plan.endDir, walking: false };
        }
        const seg = Math.floor(stepFloat);
        const t = stepFloat - seg;
        const a = plan.path[seg];
        const b = plan.path[seg + 1];
        return { x: a.x + ((b.x - a.x) * t), y: a.y + ((b.y - a.y) * t), dir: tileDirection(b.x - a.x, b.y - a.y), walking: true };
    })();
    const ownPlayer = levelData?.players?.find(player => player.userId === ownUserId) ?? null;
    const editorWalkerFigure = ownPlayer?.figure ?? GetSessionDataManager()?.figure ?? '';
    const editorWalkerGender = ownPlayer?.gender ?? 'M';

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
                        {localizeWithFallback('snowwar.editor.hint', 'Pick a piece (or search furniture) then click a tile to place it. Floor tile paints/erases the arena floor. Select/Move: click a piece then an empty tile to move it. Edit: click a piece to rotate / change its state / delete it without moving it. Walk: stroll a preview avatar around to test the layout.')}
                    </div>
                    {/* Function controls (modes + tools), grouped and separated
                        from the furni palette below - these are actions, not furni. */}
                    <div className="snowwar-editor__tools snowwar-editor__tools--modes">
                        <button
                            type="button"
                            className={'snowwar-editor__chip' + (paletteSel === null ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => setPaletteSel(null)}
                        >
                            {localizeWithFallback('snowwar.editor.select', 'Select / Move')}
                        </button>
                        <button
                            type="button"
                            className={'snowwar-editor__chip' + (paletteSel === 'edit' ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => setPaletteSel('edit')}
                        >
                            {localizeWithFallback('snowwar.editor.edit', 'Edit')}
                        </button>
                        <button
                            type="button"
                            className={'snowwar-editor__chip' + (paletteSel === 'walk' ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => { setPaletteSel('walk'); setSelectedIndex(-1); }}
                        >
                            {localizeWithFallback('snowwar.editor.walk', 'Walk')}
                        </button>
                        <button
                            type="button"
                            className={'snowwar-editor__chip snowwar-editor__chip--floor' + (paletteSel === 'floor' ? ' snowwar-editor__chip--active' : '')}
                            onClick={() => { setPaletteSel('floor'); setSelectedIndex(-1); }}
                        >
                            {localizeWithFallback('snowwar.editor.floor', 'Floor tile')}
                        </button>
                        <button type="button" className="snowwar-button snowwar-button--danger" onClick={() => clearAllItems()}>
                            {localizeWithFallback('snowwar.editor.clear', 'Clear all furni')}
                        </button>
                    </div>
                    {EDITOR_PALETTE.length > 0 && (
                        <div className="snowwar-editor__palette">
                            {EDITOR_PALETTE.map(name => (
                                <button
                                    key={name}
                                    type="button"
                                    className={'snowwar-editor__chip' + (paletteSel === name ? ' snowwar-editor__chip--active' : '')}
                                    onClick={() => { setPaletteSel(prev => prev === name ? null : name); setSelectedIndex(-1); setHoverTile(null); }}
                                >
                                    {name.replace('block_', '').replace('obst_', '').replace('sw_', '')}
                                </button>
                            ))}
                        </div>
                    )}
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
                                    onClick={() => { setPaletteSel(prev => prev === furni.className ? null : furni.className); setSelectedIndex(-1); setHoverTile(null); }}
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
                                    ? <LayoutFurniImageView direction={selectedItem.rotation} productClassId={selectedFurni.id} productType="s" state={selectedItem.state ?? 0} style={{ transform: 'scale(0.5)' }} />
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
                            {!selectedItem.imageUrl && selectedStateMax > 0 && (
                                <div className="snowwar-editor__state">
                                    <span>{localizeWithFallback('snowwar.editor.state', 'State')}</span>
                                    <button
                                        type="button"
                                        className="snowwar-button snowwar-button--icon"
                                        disabled={(selectedItem.state ?? 0) <= 0}
                                        onClick={() => cycleState(-1)}>
                                        &#8722;
                                    </button>
                                    <span className="snowwar-editor__state-value">
                                        {(selectedItem.state ?? 0)}{selectedStateCount ? ` / ${selectedStateMax}` : ''}
                                    </span>
                                    <button
                                        type="button"
                                        className="snowwar-button snowwar-button--icon"
                                        disabled={(selectedItem.state ?? 0) >= selectedStateMax}
                                        onClick={() => cycleState(1)}>
                                        +
                                    </button>
                                </div>
                            )}
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
                onMouseMove={editing ? (event) =>
                {
                    const { tileX, tileY } = screenToTile(event);
                    const inBounds = tileX >= 0 && tileY >= 0 && tileX < mapWidth && tileY < mapHeight;
                    setHoverTile(prev =>
                        (prev && prev.x === tileX && prev.y === tileY) || (!prev && !inBounds)
                            ? prev
                            : (inBounds ? { x: tileX, y: tileY } : null));
                } : undefined}
                onMouseLeave={editing ? () => setHoverTile(null) : undefined}
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

                    {/* Classic props, above the overlay so they aren't hidden. */}
                    <canvas ref={propsCanvasRef} width={canvasWidth} height={canvasHeight} className="snowwar-floor snowwar-floor--props" />

                    {displayItems
                        .filter(item => !isClassicItem(item.name) && !item.imageUrl)
                        // While a selected furni is being moved (its ghost is
                        // following the cursor), hide its copy at the old tile so
                        // it isn't shown twice.
                        .filter(item => !(movingSelected && item === selectedItem))
                        .map((item, index) =>
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

                        // A walkable furni (walkableHeight 0 - a rug/floor tile you
                        // stand ON) is flat on the ground and must NEVER occlude an
                        // avatar. Depth-sorting the whole sprite by one tile lets its
                        // front edge out-sort an avatar standing on it, so put flat
                        // furni in a low band (above the floor + overlay, below the
                        // machines at 90 and the avatars/solid furni at 100+). Solid
                        // furni keep the shared depth band so they occlude correctly.
                        const furniData = GetSessionDataManager()?.getFloorItemDataByName?.(item.name);
                        // Flat = a walkable floor furni (rug / water / tile you stand
                        // ON). Prefer the server's walkableHeight; for a freshly-placed
                        // editor furni that doesn't carry it yet, fall back to the
                        // furnidata "can stand on" flag so it's still drawn below the
                        // avatar.
                        const flat = item.walkableHeight != null
                            ? item.walkableHeight === 0
                            : !!(furniData?.canStandOn || furniData?.canLayOn);
                        const zIndex = flat
                            ? 3 + Math.min(80, Math.max(0, Math.round(originY / 8)))
                            : 100 + Math.round(originY);

                        return (
                            <div
                                key={`furni-${index}`}
                                className="snowwar-furni"
                                style={{ left: front.x, top: front.y + (TILE_HALF_H * 2), zIndex }}
                            >
                                {furniData
                                    ? <LayoutFurniImageView
                                        direction={item.rotation}
                                        productClassId={furniData.id}
                                        productType="s"
                                        state={item.state ?? 0}
                                        style={{ position: 'absolute', transformOrigin: 'center bottom', transform: `translate(-50%, -100%) scale(${SNOWWAR_FURNI_SCALE})` }}
                                    />
                                    : <div className="snowwar-furni__fallback" />}
                            </div>
                        );
                    })}

                    {editing && ghostFurni && hoverTile && (placingFurni || movingSelected) && (() =>
                    {
                        const swap = ghostRotation === 2 || ghostRotation === 6;
                        const effW = Math.max(1, (swap ? ghostFurni.tileSizeY : ghostFurni.tileSizeX) || 1);
                        const effL = Math.max(1, (swap ? ghostFurni.tileSizeX : ghostFurni.tileSizeY) || 1);
                        const front = toScreen(hoverTile.x + effW - 1, hoverTile.y + effL - 1);
                        const originY = toScreen(hoverTile.x, hoverTile.y).y + TILE_HALF_H;
                        return (
                            <div
                                className="snowwar-furni snowwar-furni--ghost"
                                style={{ left: front.x, top: front.y + (TILE_HALF_H * 2), zIndex: 100 + Math.round(originY), opacity: 0.8, pointerEvents: 'none' }}
                            >
                                <LayoutFurniImageView
                                    direction={ghostRotation}
                                    productClassId={ghostFurni.id}
                                    productType="s"
                                    state={ghostState}
                                    style={{ position: 'absolute', transformOrigin: 'center bottom', transform: `translate(-50%, -100%) scale(${SNOWWAR_FURNI_SCALE})` }}
                                />
                            </div>
                        );
                    })()}

                    {/* Tall classic props (trees / snowman / fences / blocks) as
                        per-tile sprites, depth-sorted with the avatars so one
                        standing behind a prop is occluded, like hotel furni. */}
                    {displayItems
                        .filter(item => isClassicItem(item.name) && !isFlatFloorProp(item.name) && !item.name.startsWith('snowball_machine'))
                        .map((item, index) =>
                        {
                            const { x: screenX, y: screenY } = toScreen(item.x, item.y);
                            const hitActive = (treeShakeUntilRef.current.get(`${item.x},${item.y}`) ?? 0) > frameNow;
                            // Trees sway their canopy; the snowman does a squash-bounce.
                            const hitClass = !hitActive ? ''
                                : item.name.startsWith('obst_snowman') ? ' snowwar-classic-prop--bonk'
                                : item.name.startsWith('sw_tree') ? ' snowwar-classic-prop--shake'
                                : '';
                            return (
                                <div
                                    key={`classic-${index}`}
                                    className={'snowwar-classic-prop' + hitClass}
                                    style={{ left: screenX - (PROP_BOX_W / 2), top: screenY - PROP_ANCHOR_Y, zIndex: 100 + Math.round(screenY + TILE_HALF_H) }}
                                >
                                    <ClassicPropSprite name={item.name} rotation={item.rotation} />
                                </div>
                            );
                        })}

                    {editing && paletteSel && isClassicItem(paletteSel) && !isFlatFloorProp(paletteSel) && !paletteSel.startsWith('snowball_machine') && hoverTile && (() =>
                    {
                        const { x: screenX, y: screenY } = toScreen(hoverTile.x, hoverTile.y);
                        return (
                            <div
                                className="snowwar-classic-prop"
                                style={{ left: screenX - (PROP_BOX_W / 2), top: screenY - PROP_ANCHOR_Y, zIndex: 100 + Math.round(screenY + TILE_HALF_H) }}
                            >
                                <ClassicPropSprite name={paletteSel} rotation={0} opacity={0.55} />
                            </div>
                        );
                    })()}

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

                    {editing && editItems.map((item, index) => item.imageUrl
                        ? (() =>
                        {
                            const { x, y } = toScreen(item.x, item.y);
                            return <div key={`admarker-${index}`} className="snowwar-edit-admarker" style={{ left: x, top: y + TILE_HALF_H }}>🖼</div>;
                        })()
                        : null)}

                    {editing && selectedIndex >= 0 && editItems[selectedIndex] && !movingSelected && (() =>
                    {
                        // Hidden while the ghost is following the cursor (a move in
                        // progress) - the ghost is the indicator then, so the box
                        // isn't left floating at the old/empty tile.
                        // Outline the WHOLE footprint as one isometric parallelogram
                        // (rotation swaps width/length) so the selection follows the
                        // tile angle instead of a grid of axis-aligned boxes.
                        const sel = editItems[selectedIndex];
                        const swap = sel.rotation === 2 || sel.rotation === 6;
                        const effW = Math.max(1, (swap ? sel.length : sel.width) ?? 1);
                        const effL = Math.max(1, (swap ? sel.width : sel.length) ?? 1);
                        // The four extreme tile-diamond vertices of the footprint.
                        const topV = toScreen(sel.x, sel.y);
                        const rightV = toScreen(sel.x + effW - 1, sel.y);
                        const bottomV = toScreen(sel.x + effW - 1, sel.y + effL - 1);
                        const leftV = toScreen(sel.x, sel.y + effL - 1);
                        const corners = [
                            { x: topV.x, y: topV.y },
                            { x: rightV.x + TILE_HALF_W, y: rightV.y + TILE_HALF_H },
                            { x: bottomV.x, y: bottomV.y + (TILE_HALF_H * 2) },
                            { x: leftV.x - TILE_HALF_W, y: leftV.y + TILE_HALF_H },
                        ];
                        const minX = Math.min(...corners.map(c => c.x));
                        const minY = Math.min(...corners.map(c => c.y));
                        const boxW = Math.max(...corners.map(c => c.x)) - minX;
                        const boxH = Math.max(...corners.map(c => c.y)) - minY;
                        const points = corners.map(c => `${c.x - minX},${c.y - minY}`).join(' ');
                        return (
                            <svg className="snowwar-edit-selection" width={boxW} height={boxH} style={{ left: minX, top: minY }}>
                                <polygon points={points} />
                            </svg>
                        );
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

                    {treeSnow.map(flake =>
                        <div
                            key={flake.id}
                            className="snowwar-treesnow"
                            style={{ left: flake.x, top: flake.y }}
                            onAnimationEnd={() => setTreeSnow(list => list.filter(item => item.id !== flake.id))}
                        />
                    )}

                    {!editing && [...simulation.avatars.values()].map(avatar =>
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

                    {editorWalker && (() =>
                    {
                        // Client-side preview avatar shown only in the editor (the
                        // game simulation is empty here). Anchored the same way as an
                        // in-game avatar so it lines up with the tiles it walks.
                        const { x, y } = toScreen(editorWalker.x, editorWalker.y);
                        return (
                            <div
                                className="snowwar-avatar snowwar-avatar--preview"
                                style={{ left: x, top: y, zIndex: 100 + Math.round(y) }}
                            >
                                <span className="snowwar-avatar__body">
                                    <SnowWarAvatarView
                                        figure={editorWalkerFigure}
                                        gender={editorWalkerGender}
                                        direction={editorWalker.dir}
                                        walking={editorWalker.walking}
                                        throwing={false}
                                        throwProgress={0}
                                        frameNow={frameNow}
                                        scale={0.5}
                                    />
                                </span>
                            </div>
                        );
                    })()}
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
