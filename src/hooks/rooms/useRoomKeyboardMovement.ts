import { GetRoomEngine, RoomObjectCategory, RoomUnitWalkComposer } from '@nitrots/nitro-renderer';
import { useEffect, useRef } from 'react';
import { SendMessageComposer } from '../../api';
import { useKeyboardMovement } from '../useKeyboardMovement';
import { useRoom } from './useRoom';

// Screen-aligned, not axis-aligned: the room is isometric, so a single tile step
// on x or y reads as a diagonal. Pressing up should move the avatar up the
// screen, which is x-1 together with y-1.
const STEPS: Record<string, [number, number]> = {
    ArrowUp: [-1, -1],
    ArrowDown: [1, 1],
    ArrowLeft: [-1, 1],
    ArrowRight: [1, -1]
};

const REPEAT_DELAY = 180;

const isTyping = () => {
    const element = document.activeElement as HTMLElement;

    if (!element) return false;

    const tag = element.tagName;

    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
};

export const useRoomKeyboardMovement = () => {
    const { roomSession = null } = useRoom();
    const [enabled] = useKeyboardMovement();
    const lastStep = useRef(0);

    useEffect(() => {
        if (!enabled || !roomSession) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const step = STEPS[event.key];

            if (!step) return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (isTyping()) return;

            // The arrows would otherwise scroll the page behind the canvas.
            event.preventDefault();

            const now = Date.now();

            if (now - lastStep.current < REPEAT_DELAY) return;

            const avatar = GetRoomEngine().getRoomObject(roomSession.roomId, roomSession.ownRoomIndex, RoomObjectCategory.UNIT);

            if (!avatar) return;

            const location = avatar.getLocation();

            if (!location) return;

            lastStep.current = now;

            // The server decides whether the tile is reachable; a blocked step
            // simply does nothing, exactly like clicking a wall.
            SendMessageComposer(new RoomUnitWalkComposer(Math.round(location.x) + step[0], Math.round(location.y) + step[1]));
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled, roomSession]);
};
