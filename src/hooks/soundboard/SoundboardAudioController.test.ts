import { describe, expect, test, vi } from 'vitest';
import { SoundboardAudioController } from './SoundboardAudioController';

const createAudio = () => ({
    src: '',
    currentTime: 0,
    volume: 1,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn()
});

describe('SoundboardAudioController', () => {
    test('keeps one active audio channel', async () => {
        const first = createAudio();
        const second = createAudio();
        const factory = vi.fn()
            .mockImplementationOnce((url: string) => {
                first.src = url;
                return first;
            })
            .mockImplementationOnce((url: string) => {
                second.src = url;
                return second;
            });
        const controller = new SoundboardAudioController(factory);

        await controller.play('/sounds/one.mp3');
        await controller.play('https://cdn.example/two.mp3');

        expect(first.pause).toHaveBeenCalledOnce();
        expect(first.currentTime).toBe(0);
        expect(first.removeAttribute).toHaveBeenCalledWith('src');
        expect(second.volume).toBe(0.8);
        expect(second.play).toHaveBeenCalledOnce();
    });

    test.each(['javascript:alert(1)', 'data:audio/mp3;base64,AA', 'blob:https://example.test/id', 'ftp://example.test/sound.mp3'])('rejects unsafe URL %s', async (url) => {
        const factory = vi.fn(createAudio);
        const controller = new SoundboardAudioController(factory);

        await controller.play(url);

        expect(factory).not.toHaveBeenCalled();
    });

    test('stop clears the active source', async () => {
        const audio = createAudio();
        const controller = new SoundboardAudioController(() => audio);

        await controller.play('../sounds/relative.ogg');
        controller.stop();

        expect(audio.pause).toHaveBeenCalledOnce();
        expect(audio.currentTime).toBe(0);
        expect(audio.removeAttribute).toHaveBeenCalledWith('src');
        expect(audio.load).toHaveBeenCalledOnce();
    });

    test('clears a source when browser playback rejects it', async () => {
        const audio = createAudio();
        audio.play.mockRejectedValueOnce(new Error('blocked'));
        const controller = new SoundboardAudioController(() => audio);

        await expect(controller.play('/sounds/blocked.mp3')).resolves.toBeUndefined();

        expect(audio.pause).toHaveBeenCalledOnce();
        expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    });
});
