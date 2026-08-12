import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigatorSearchResultItemView } from './NavigatorSearchResultItemView';

vi.mock('@nitrots/nitro-renderer', async () => {
    const actual = await vi.importActual<typeof import('@nitrots/nitro-renderer')>('@nitrots/nitro-renderer');

    return {
        ...actual,
        GetSessionDataManager: () => ({ userId: 7 }),
        RoomDataParser: { DOORBELL_STATE: 1, INVISIBLE_STATE: 3, OPEN_STATE: 0, PASSWORD_STATE: 2 }
    };
});

vi.mock('../../../../api', async () => {
    const actual = await vi.importActual<typeof import('../../../../api')>('../../../../api');

    return {
        ...actual,
        GetConfigurationValue: (key: string, fallback?: unknown) => {
            if (key === 'thumbnails.url') return 'https://thumbnails.test/%thumbnail%.png';
            return fallback;
        },
        LocalizeText: (key: string) => key
    };
});

vi.mock('../../../../hooks', async () => {
    const actual = await vi.importActual<typeof import('../../../../hooks')>('../../../../hooks');

    return {
        ...actual,
        useDoorState: () => ({ setSnapshot: vi.fn() }),
        useHelp: () => ({ report: vi.fn() }),
        useNavigatorData: () => ({ navigatorData: { homeRoomId: 0 } }),
        useNavigatorFavourite: () => ({ isFavourite: false, toggle: vi.fn() })
    };
});

const room = {
    description: 'Room description',
    doorMode: 0,
    groupBadgeCode: '',
    groupName: '',
    habboGroupId: 0,
    maxUserCount: 50,
    officialRoomPicRef: '',
    ownerId: 7,
    ownerName: 'tester',
    roomAdExpiresInMin: 0,
    roomId: 42,
    roomName: 'Hover room',
    showOwner: true,
    tags: [],
    tradeMode: 0,
    userCount: 3
} as any;

const Harness = () => {
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [isPopoverActive, setIsPopoverActive] = useState(false);

    return (
        <NavigatorSearchResultItemView
            roomData={room}
            selectedRoomId={selectedRoomId}
            setSelectedRoomId={setSelectedRoomId}
            isPopoverActive={isPopoverActive}
            setIsPopoverActive={setIsPopoverActive}
        />
    );
};

afterEach(() => {
    vi.useRealTimers();
    cleanup();
});

describe('AIR navigator room information hover', () => {
    it('opens the room information popup on the first mouse hover without a click', () => {
        render(<Harness />);

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover room' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Room description')).toBeInTheDocument();
    });

    it('closes the room information popup after the pointer leaves', () => {
        vi.useFakeTimers();
        render(<Harness />);
        const roomRow = screen.getByRole('button', { name: 'Hover room' });
        fireEvent.mouseEnter(roomRow);

        fireEvent.mouseLeave(roomRow);
        act(() => vi.advanceTimersByTime(200));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the popup open while the pointer moves from the row into its actions', () => {
        vi.useFakeTimers();
        render(<Harness />);
        const roomRow = screen.getByRole('button', { name: 'Hover room' });
        fireEvent.mouseEnter(roomRow);
        const dialog = screen.getByRole('dialog');

        fireEvent.mouseLeave(roomRow);
        fireEvent.mouseEnter(dialog);
        act(() => vi.advanceTimersByTime(200));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.mouseLeave(dialog);
        act(() => vi.advanceTimersByTime(200));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
