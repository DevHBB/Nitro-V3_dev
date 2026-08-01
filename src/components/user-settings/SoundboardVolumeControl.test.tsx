/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundboardVolumeControl } from './SoundboardVolumeControl';

vi.mock('../../api', () => ({ LocalizeText: () => 'Soundboard' }));

describe('SoundboardVolumeControl', () => {
    afterEach(cleanup);

    it('uses the standard volume range and commits changes', () => {
        const onChange = vi.fn();
        const onCommit = vi.fn();
        render(<SoundboardVolumeControl value={80} onChange={onChange} onCommit={onCommit} />);

        const range = screen.getByRole('slider', { name: 'Soundboard' });
        expect(range).toHaveAttribute('min', '0');
        expect(range).toHaveAttribute('max', '100');
        expect(range).toHaveAttribute('step', '1');

        fireEvent.change(range, { target: { value: '25' } });
        fireEvent.mouseUp(range);

        expect(onChange).toHaveBeenCalledWith(25);
        expect(onCommit).toHaveBeenCalledOnce();
    });
});
