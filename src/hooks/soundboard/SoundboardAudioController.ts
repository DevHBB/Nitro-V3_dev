interface SoundboardAudioChannel {
    currentTime: number;
    volume: number;
    play(): Promise<void>;
    pause(): void;
    removeAttribute(name: string): void;
    load(): void;
}

type SoundboardAudioFactory = (url: string) => SoundboardAudioChannel;

const isSafeAudioUrl = (url: string): boolean => {
    const value = url.trim();
    if (!value) return false;

    const scheme = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
    return !scheme || scheme === 'http' || scheme === 'https';
};

export class SoundboardAudioController {
    private current: SoundboardAudioChannel | null = null;

    constructor(private readonly createAudio: SoundboardAudioFactory = (url) => new Audio(url)) {}

    public async play(url: string): Promise<void> {
        const normalizedUrl = url.trim();
        if (!isSafeAudioUrl(normalizedUrl)) return;

        this.stop();

        const audio = this.createAudio(normalizedUrl);
        audio.volume = 0.8;
        this.current = audio;

        try {
            await audio.play();
        } catch {
            if (this.current === audio) this.stop();
        }
    }

    public stop(): void {
        if (!this.current) return;

        const audio = this.current;
        this.current = null;
        audio.pause();

        try {
            audio.currentTime = 0;
        } catch {}

        audio.removeAttribute('src');
        audio.load();
    }
}
