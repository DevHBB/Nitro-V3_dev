import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('SnowWar chat', () => {
    it('uses the classic centered input and AIR team chat bubbles', () => {
        const arena = readSource('src/components/game-center/views/snowwar/SnowWarArenaView.tsx');
        const css = readSource('src/css/game-center/GameCenterView.css');

        expect(arena).toContain('<form');
        expect(arena).toContain("localizeWithFallback('widgets.chatinput.say', 'Say')");
        expect(arena).toContain("avatar.teamId === 1 ? 'blue' : 'red'");
        expect(arena).toContain('<b>{avatar.name}: </b>{message.message}');
        expect(arena).not.toContain('snowwar-chat__log');
        expect(arena).not.toContain('snowwar-avatar__chat');
        expect(css).toContain('width: min(394px, calc(100% - 180px));');
        expect(css).toContain('border-image-slice: 29 18 5 34 fill;');
        expect(css).toContain('.snowwar-chat-bubble--blue');
        expect(css).toContain('.snowwar-chat-bubble__face');
    });
});
