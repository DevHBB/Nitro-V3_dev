import { render, screen } from '@testing-library/react';
import { FC, PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NavigatorView } from './NavigatorView';

const ShellPart: FC<PropsWithChildren<Record<string, unknown>>> = ({ children, ...props }) => <div {...props}>{children}</div>;

vi.mock('@layout/NitroCard', () => ({
    NitroCard: Object.assign(ShellPart, {
        Header: ShellPart,
        Tabs: ShellPart,
        TabItem: ShellPart,
        Content: ShellPart
    })
}));

vi.mock('@nitrots/nitro-renderer', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@nitrots/nitro-renderer');

    return {
        ...actual,
        HabboWebTools: { OPENROOM: 'open-room' },
        LegacyExternalInterface: { addCallback: vi.fn() },
        RoomSessionEvent: { CREATED: 'room-session-created' }
    };
});

vi.mock('./views/NavigatorDoorStateView', () => ({ NavigatorDoorStateView: () => null }));
vi.mock('./views/NavigatorRoomInfoView', () => ({ NavigatorRoomInfoView: () => null }));
vi.mock('./views/NavigatorRoomLinkView', () => ({ NavigatorRoomLinkView: () => null }));
vi.mock('./views/room-settings/NavigatorRoomSettingsView', () => ({ NavigatorRoomSettingsView: () => null }));

vi.mock('../../hooks', async () => {
    const actual = await vi.importActual<typeof import('../../hooks')>('../../hooks');

    return {
        ...actual,
        useNavigatorData: () => ({
            topLevelContext: { code: 'official_view' },
            topLevelContexts: [{ code: 'official_view' }, { code: 'hotel_view' }],
            navigatorData: { homeRoomId: 0 },
            navigatorSearches: []
        }),
        useNavigatorSearch: () => ({ searchResult: null, isFetching: false }),
        useNavigatorUiState: () => ({
            isVisible: true,
            isCreatorOpen: false,
            isRoomInfoOpen: false,
            isRoomLinkOpen: false,
            isOpenSavesSearches: true,
            needsInit: false,
            currentTabCode: 'official_view'
        }),
        useNitroEvent: () => undefined
    };
});

describe('AIR navigator shell', () => {
    it('exposes a collapsible quick-links navigation beside the browsing workspace', () => {
        render(<NavigatorView />);

        expect(screen.getByRole('navigation', { name: 'Quick links' })).toBeInTheDocument();
        expect(screen.getByRole('main', { name: 'Navigator' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show or hide quick links' })).toHaveAttribute('aria-expanded', 'true');
    });
});
