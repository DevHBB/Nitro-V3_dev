/* @vitest-environment jsdom */

import { GetAvatarRenderManager } from '@nitrots/nitro-renderer';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessengerFriend } from '../../../../../api';
import { useFriends } from '../../../../../hooks';
import { FriendsListGroupItemView } from './FriendsListGroupItemView';

vi.mock('../../../../../hooks', () => ({
    useFriends: vi.fn()
}));

vi.mock('../../../../../common/layout/avatarImageCrop', () => ({
    cropTransparentImageUrl: vi.fn(async () => 'data:image/png;base64,cropped')
}));

describe('Friends list avatar head', () => {
    beforeEach(() => {
        vi.mocked(GetAvatarRenderManager).mockReturnValue({
            createAvatarImage: () => ({
                setDirection: vi.fn(),
                processAsImageUrl: () => 'data:image/png;base64,raw',
                isPlaceholder: () => false,
                dispose: vi.fn()
            })
        } as unknown as ReturnType<typeof GetAvatarRenderManager>);
        vi.mocked(useFriends).mockReturnValue({
            followFriend: vi.fn(),
            updateRelationship: vi.fn()
        } as unknown as ReturnType<typeof useFriends>);
    });

    afterEach(cleanup);

    it('renders the friend head as a smooth 20px compact thumbnail', () => {
        const friend = new MessengerFriend();

        friend.id = 42;
        friend.name = 'tester1';
        friend.figure = 'hd-180-1.ch-210-66.lg-270-82.sh-290-80';
        friend.gender = 0;
        friend.online = true;

        const { container } = render(<FriendsListGroupItemView friend={friend} selected={false} selectFriend={vi.fn()} />);
        const avatar = container.querySelector<HTMLElement>('.hfl-friend-avatar .avatar-image');

        expect(avatar).not.toBeNull();
        expect(avatar).toHaveClass('compact-head');
        expect(avatar).toHaveStyle({
            backgroundSize: '20px 20px',
            backgroundPosition: 'center',
            imageRendering: 'auto'
        });
    });
});
