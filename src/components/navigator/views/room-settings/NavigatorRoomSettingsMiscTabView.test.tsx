/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigatorRoomSettingsMiscTabView } from './NavigatorRoomSettingsMiscTabView';

vi.mock('@nitrots/nitro-renderer', () => ({
    YouTubeRoomSettingsComposer: class {},
    YouTubeRoomSettingsEvent: class {}
}));

vi.mock('../../../../api', () => ({
    getYoutubeRoomEnabled: () => false,
    LocalizeText: (key: string) => ({
        'product.type.other': 'Other',
        'soundboard.room.allow': 'Allow Soundboard use in this room'
    })[key] || key,
    SendMessageComposer: vi.fn(),
    setYoutubeRoomEnabled: vi.fn()
}));

vi.mock('../../../../hooks', () => ({
    useMessageEvent: vi.fn(),
    useSoundboard: () => ({ enabled: true, setRoomEnabled: vi.fn() })
}));

describe('NavigatorRoomSettingsMiscTabView Soundboard controls', () => {
    afterEach(cleanup);

    it('renders one whole-room toggle and no per-sound controls', () => {
        const { container } = render(<NavigatorRoomSettingsMiscTabView roomData={{} as any} />);

        expect(screen.getAllByRole('checkbox', { name: 'Allow Soundboard use in this room' })).toHaveLength(1);
        expect(container.textContent).not.toContain('Block');
        expect(container.textContent).not.toContain('Minimum rank');
        expect(container.textContent).not.toContain('Save catalog');
    });
});
