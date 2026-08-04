import { FC } from 'react';
import { DisplaySoundboardSound, SoundboardTone } from '../../hooks/soundboard/soundboardPresentation';

interface SoundboardPadViewProps {
    sound: DisplaySoundboardSound;
    disabled: boolean;
    onPlay: (sound: DisplaySoundboardSound) => void;
}

const TONE_CLASSES: Record<SoundboardTone, string> = {
    blue: 'border-[#286889] bg-[#3d8fba] hover:bg-[#347da3]',
    green: 'border-[#327143] bg-[#4da462] hover:bg-[#438e56]',
    gold: 'border-[#8b681f] bg-[#d4a43b] hover:bg-[#bc9033]',
    purple: 'border-[#62438a] bg-[#8d65ba] hover:bg-[#7b58a4]'
};

export const SoundboardPadView: FC<SoundboardPadViewProps> = ({ sound, disabled, onPlay }) => (
    <button
        type="button"
        aria-disabled={disabled}
        data-tone={sound.tone}
        title={sound.name}
        onClick={() => !disabled && onPlay(sound)}
        className={`h-9 min-w-0 cursor-pointer truncate rounded-md border-2 px-2 text-[11px] font-bold text-white shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${TONE_CLASSES[sound.tone]}`}
    >
        {sound.name}
    </button>
);
