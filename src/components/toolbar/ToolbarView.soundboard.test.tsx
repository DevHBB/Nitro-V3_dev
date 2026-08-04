import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Toolbar Soundboard feedback', () => {
    it('listens to room playback and applies the pulse to both layouts', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/components/toolbar/ToolbarView.tsx'), 'utf8');

        expect(source).toContain('SoundboardRoomMessageEvent.ROOM_MESSAGE');
        expect(source).toContain('700');
        expect(source.match(/soundboardPulse \? 'animate-pulse'/g)).toHaveLength(2);
    });
});
