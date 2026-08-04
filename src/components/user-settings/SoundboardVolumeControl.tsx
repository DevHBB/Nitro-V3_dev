import { FC } from 'react';
import { FaVolumeDown, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { LocalizeText } from '../../api';
import { Text } from '../../common';
import { classNames } from '../../layout';

interface SoundboardVolumeControlProps {
    value: number;
    onChange: (value: number) => void;
    onCommit: () => void;
}

export const SoundboardVolumeControl: FC<SoundboardVolumeControlProps> = ({ value, onChange, onCommit }) => {
    const label = LocalizeText('widget.memenu.settings.volume.soundboard');

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor="volumeSoundboard">
                <Text>{label}</Text>
            </label>
            <div className="flex items-center gap-1">
                {value === 0 && <FaVolumeMute className={classNames(value >= 50 && 'text-muted', 'fa-icon')} />}
                {value > 0 && <FaVolumeDown className={classNames(value >= 50 && 'text-muted', 'fa-icon')} />}
                <input
                    aria-label={label}
                    className="custom-range w-full"
                    id="volumeSoundboard"
                    max="100"
                    min="0"
                    step="1"
                    type="range"
                    value={value}
                    onChange={(event) => onChange(Number(event.target.value))}
                    onBlur={onCommit}
                    onKeyUp={(event) => {
                        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) onCommit();
                    }}
                    onMouseUp={onCommit}
                    onTouchEnd={onCommit}
                />
                <FaVolumeUp className={classNames(value < 50 && 'text-muted', 'fa-icon')} />
            </div>
        </div>
    );
};
