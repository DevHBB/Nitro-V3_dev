import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigatorSearchResultItemInfoView } from './NavigatorSearchResultItemInfoView';

vi.mock('@nitrots/nitro-renderer', async () => {
    const actual = await vi.importActual<typeof import('@nitrots/nitro-renderer')>('@nitrots/nitro-renderer');

    return {
        ...actual,
        GetSessionDataManager: () => ({ userId: 7 }),
        RoomSettingsComposer: class {},
        UpdateHomeRoomMessageComposer: class {}
    };
});

vi.mock('../../../../hooks', async () => {
    const actual = await vi.importActual<typeof import('../../../../hooks')>('../../../../hooks');

    return {
        ...actual,
        useHelp: () => ({ report: vi.fn() }),
        useNavigatorData: () => ({ navigatorData: { homeRoomId: 0 } }),
        useNavigatorFavourite: () => ({ isFavourite: false, toggle: vi.fn() })
    };
});

vi.mock('../../../../api', async () => {
    const actual = await vi.importActual<typeof import('../../../../api')>('../../../../api');

    return {
        ...actual,
        LocalizeText: (key: string) => key
    };
});

const room = {
    roomId: 42,
    roomName: 'lol',
    description: '',
    ownerId: 7,
    ownerName: 'fornela',
    showOwner: true,
    officialRoomPicRef: '/room.png',
    habboGroupId: 0,
    groupBadgeCode: '',
    groupName: '',
    doorMode: 0,
    tradeMode: 0,
    maxUserCount: 50,
    userCount: 0,
    tags: []
} as any;

afterEach(() => cleanup());

describe('AIR navigator room popover', () => {
    it('keeps the official 360px card width so metadata and actions do not collapse', () => {
        render(<NavigatorSearchResultItemInfoView roomData={room} isVisible={true} />);

        expect(screen.getByRole('dialog')).toHaveStyle({ width: '360px', maxWidth: 'calc(100vw - 16px)' });
    });

    it('hides the owner link when AIR marks the room owner as private', () => {
        render(<NavigatorSearchResultItemInfoView roomData={{ ...room, showOwner: false }} isVisible={true} />);

        expect(screen.queryByText('fornela')).not.toBeInTheDocument();
    });

    it('shows AIR room-ad details only while the room event is active', () => {
        render(
            <NavigatorSearchResultItemInfoView
                roomData={{ ...room, roomAdExpiresInMin: 15, roomAdName: 'Pizza party', roomAdDescription: 'Come join us' }}
                isVisible={true}
            />
        );

        expect(screen.getByText(/Pizza party/)).toBeInTheDocument();
        expect(screen.getByText(/Come join us/)).toBeInTheDocument();
    });

    it('uses all three AIR room trading levels', () => {
        const { rerender } = render(<NavigatorSearchResultItemInfoView roomData={{ ...room, tradeMode: 1 }} isVisible={true} />);

        expect(screen.getByText('trading.mode.controller')).toBeInTheDocument();

        rerender(<NavigatorSearchResultItemInfoView roomData={{ ...room, tradeMode: 2 }} isVisible={true} />);

        expect(screen.getByText('trading.mode.free')).toBeInTheDocument();
    });
});
