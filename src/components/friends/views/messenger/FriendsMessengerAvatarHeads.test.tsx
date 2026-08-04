/* @vitest-environment jsdom */

import { AddLinkEventTracker, GetAvatarRenderManager, GetSessionDataManager } from '@nitrots/nitro-renderer';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerFriend, MessengerThread } from '../../../../api';
import { useFriends, useHelp, useMessenger, useTranslation } from '../../../../hooks';
import { FriendsMessengerView } from './FriendsMessengerView';
import { FriendsMessengerThreadGroup } from './messenger-thread/FriendsMessengerThreadGroup';

vi.mock('../../../../hooks', () => ({
    useFriends: vi.fn(),
    useHelp: vi.fn(),
    useMessenger: vi.fn(),
    useTranslation: vi.fn()
}));

vi.mock('../../../../common/layout/avatarImageCrop', () => ({
    cropTransparentImageUrl: vi.fn(async () => 'data:image/png;base64,cropped')
}));

const figure = 'hd-180-1.ch-210-66.lg-270-82.sh-290-80';

const makeFriend = () => {
    const friend = new MessengerFriend();

    friend.id = 42;
    friend.name = 'Lorenzo';
    friend.gender = 0;
    friend.figure = figure;
    friend.online = true;

    return friend;
};

const makeThread = (friend: MessengerFriend) => {
    const thread = new MessengerThread(friend);

    thread.addMessage(friend.id, 'Ciao');

    return thread;
};

describe('Messenger avatar heads', () => {
    const friend = makeFriend();

    beforeEach(() => {
        vi.mocked(AddLinkEventTracker).mockClear();
        vi.mocked(GetAvatarRenderManager).mockReturnValue({
            createAvatarImage: () => ({
                setDirection: vi.fn(),
                processAsImageUrl: () => 'data:image/png;base64,raw',
                isPlaceholder: () => false,
                dispose: vi.fn()
            })
        } as unknown as ReturnType<typeof GetAvatarRenderManager>);
        vi.mocked(GetSessionDataManager).mockReturnValue({
            userId: 7,
            userName: 'Simoleo',
            figure
        } as ReturnType<typeof GetSessionDataManager>);
        vi.mocked(useFriends).mockReturnValue({ getFriend: () => friend } as unknown as ReturnType<typeof useFriends>);
        vi.mocked(useHelp).mockReturnValue({ report: vi.fn() } as unknown as ReturnType<typeof useHelp>);
        vi.mocked(useTranslation).mockReturnValue({
            settings: { enabled: false },
            translateOutgoing: vi.fn()
        } as unknown as ReturnType<typeof useTranslation>);
    });

    afterEach(cleanup);

    it('uses a tightly cropped head in each conversation tab', () => {
        const thread = makeThread(friend);

        vi.mocked(useMessenger).mockReturnValue({
            visibleThreads: [thread],
            activeThread: null,
            getMessageThread: () => thread,
            sendMessage: vi.fn(),
            setActiveThreadId: vi.fn(),
            closeThread: vi.fn(),
            typingUserIds: [],
            sendTypingStatus: vi.fn()
        } as unknown as ReturnType<typeof useMessenger>);

        render(<FriendsMessengerView />);

        const tracker = vi.mocked(AddLinkEventTracker).mock.calls[0][0];

        act(() => tracker.linkReceived('friends-messenger/open'));

        const avatar = document.querySelector<HTMLElement>('.messenger-avatar-tab .avatar-image');

        expect(avatar).not.toBeNull();
        expect(avatar).toHaveClass('compact-head');
        expect(avatar).toHaveStyle({ backgroundSize: '35px 35px', backgroundPosition: 'center' });
    });

    it('uses a tightly cropped head beside incoming messages', () => {
        const thread = makeThread(friend);
        const { container } = render(<FriendsMessengerThreadGroup thread={thread} group={thread.groups[0]} />);
        const avatar = container.querySelector<HTMLElement>('.message-avatar .avatar-image');

        expect(avatar).not.toBeNull();
        expect(avatar).toHaveClass('compact-head');
        expect(avatar).toHaveStyle({ backgroundSize: '40px 40px', backgroundPosition: 'center' });
    });

    it('uses the same tightly cropped head beside sent messages', () => {
        const thread = new MessengerThread(friend);

        thread.addMessage(7, 'Ciao Lorenzo');

        const { container } = render(<FriendsMessengerThreadGroup thread={thread} group={thread.groups[0]} />);
        const avatar = container.querySelector<HTMLElement>('.messenger-message-row.own .message-avatar .avatar-image');

        expect(avatar).not.toBeNull();
        expect(avatar).toHaveClass('compact-head');
        expect(avatar).toHaveStyle({ backgroundSize: '40px 40px', backgroundPosition: 'center' });
    });
});
