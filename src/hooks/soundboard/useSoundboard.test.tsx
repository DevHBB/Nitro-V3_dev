/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundboardPlayDeniedEvent, SoundboardSettingsEvent } from '@nitrots/nitro-renderer';
import { NotificationBubbleType } from '../../api/notification/NotificationBubbleType';
import { useSoundboardState } from './useSoundboard';

const mocks = vi.hoisted(() => ({
    handlers: new Map<unknown, (event: any) => void>(),
    playSoundboard: vi.fn().mockResolvedValue(true),
    stopSoundboard: vi.fn(),
    sendMessage: vi.fn(),
    showSingleBubble: vi.fn()
}));

vi.mock('@nitrots/nitro-renderer', () => {
    class NitroEvent { constructor(public type: string) {} }
    class SoundboardPlayComposer { constructor(public id: number) {} }
    class SoundboardRequestSettingsComposer {}
    class SoundboardSetEnabledComposer { constructor(public enabled: boolean) {} }
    class SoundboardPlayEvent {}
    class SoundboardPlayDeniedEvent {}
    class SoundboardSettingsEvent {}

    return {
        GetSessionDataManager: () => ({ getUserDataSnapshot: () => ({ userId: 42 }) }),
        GetSoundManager: () => ({ playSoundboard: mocks.playSoundboard, stopSoundboard: mocks.stopSoundboard }),
        loadGamedata: vi.fn().mockResolvedValue({}),
        NitroEvent,
        SoundboardPlayComposer,
        SoundboardRequestSettingsComposer,
        SoundboardSetEnabledComposer,
        SoundboardPlayEvent,
        SoundboardPlayDeniedEvent,
        SoundboardSettingsEvent
    };
});

vi.mock('../../api', () => ({
        DispatchUiEvent: vi.fn(),
        GetConfigurationValue: vi.fn().mockReturnValue(''),
        LocalizeText: (key: string, names?: string[], values?: string[]) => `${key}:${values?.join(',') ?? ''}`,
        NotificationBubbleType: { SOUNDBOARD: 'soundboard' },
        SendMessageComposer: mocks.sendMessage,
        setSoundboardRoomEnabled: vi.fn()
}));

vi.mock('../events', () => ({
    useMessageEvent: (type: unknown, handler: (event: any) => void) => mocks.handlers.set(type, handler)
}));

vi.mock('../notification', () => ({
    useNotificationActions: () => ({ showSingleBubble: mocks.showSingleBubble })
}));

describe('useSoundboardState', () => {
    beforeEach(() => {
        mocks.handlers.clear();
        mocks.playSoundboard.mockClear();
        mocks.stopSoundboard.mockClear();
        mocks.sendMessage.mockClear();
        mocks.showSingleBubble.mockClear();
    });

    it('blocks a locally known cooldown and shows one personal bubble', () => {
        const { result } = renderHook(() => useSoundboardState());

        act(() => mocks.handlers.get(SoundboardSettingsEvent)?.({
            getParser: () => ({ enabled: true, cooldownSeconds: 30, sounds: [] })
        }));
        act(() => mocks.handlers.get(SoundboardPlayDeniedEvent)?.({
            getParser: () => ({ reason: 1, remainingSeconds: 12 })
        }));
        act(() => result.current.play({ id: 7 } as any));

        expect(result.current.isCoolingDown).toBe(true);
        expect(mocks.sendMessage).not.toHaveBeenCalled();
        expect(mocks.showSingleBubble).toHaveBeenCalledWith(
            expect.stringContaining('12'),
            NotificationBubbleType.SOUNDBOARD
        );
    });

    it('sends refresh and play composers when allowed', () => {
        const { result } = renderHook(() => useSoundboardState());

        act(() => result.current.refresh());
        act(() => result.current.play({ id: 7 } as any));

        expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
        expect((mocks.sendMessage.mock.calls[1][0] as any).id).toBe(7);
    });
});
