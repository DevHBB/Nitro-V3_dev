/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DisplaySoundboardSound } from '../../hooks/soundboard/soundboardPresentation';
import { SoundboardPadView } from './SoundboardPadView';

const sound: DisplaySoundboardSound = {
    id: 1,
    name: 'Campanella',
    url: '/sounds/campanella.mp3',
    categoryId: 'effects',
    tone: 'gold',
    keywords: []
};

describe('SoundboardPadView', () => {
    afterEach(cleanup);

    test('renders a compact text-only tone button and plays it', () => {
        const onPlay = vi.fn();
        render(<SoundboardPadView sound={sound} disabled={false} onPlay={onPlay} />);

        const button = screen.getByRole('button', { name: 'Campanella' });
        expect(button.textContent).toBe('Campanella');
        expect(button).toHaveAttribute('data-tone', 'gold');

        fireEvent.click(button);
        expect(onPlay).toHaveBeenCalledWith(sound);
    });

    test('does not play while disabled', () => {
        const onPlay = vi.fn();
        render(<SoundboardPadView sound={sound} disabled onPlay={onPlay} />);

        const button = screen.getByRole('button', { name: 'Campanella' });
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(button);
        expect(onPlay).not.toHaveBeenCalled();
    });
});
