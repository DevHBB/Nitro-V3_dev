import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAirFriendTabCapacity, resolveBottomDockLayout } from './bottomDockLayout';

describe('AIR bottom dock layout', () => {
    it('keeps the responsive dock math in a dedicated module', () => {
        const modulePath = resolve(process.cwd(), 'src/components/toolbar/bottomDockLayout.ts');

        expect(existsSync(modulePath)).toBe(true);

        const source = readFileSync(modulePath, 'utf8');

        expect(source).toContain('resolveBottomDockLayout');
        expect(source).toContain('resolveAirFriendTabCapacity');
    });

    it('keeps the chat centered in the bar when both AIR side areas leave enough room', () => {
        expect(
            resolveBottomDockLayout({
                viewportWidth: 1860,
                leftEdge: 500,
                rightEdge: 1360
            })
        ).toEqual({
            chatRaised: false,
            chatBottom: 7
        });
    });

    it('raises the chat above crowded side areas and clears the room tools rail', () => {
        expect(
            resolveBottomDockLayout({
                viewportWidth: 1180,
                leftEdge: 470,
                rightEdge: 730,
                roomToolsBottom: 148
            })
        ).toEqual({
            chatRaised: true,
            chatBottom: 160
        });
    });

    it('derives friend tab capacity from AIR tab geometry instead of a hard cap', () => {
        expect(resolveAirFriendTabCapacity(730, 150, 1)).toBe(4);
        expect(resolveAirFriendTabCapacity(220, 150, 1)).toBe(1);
    });
});
