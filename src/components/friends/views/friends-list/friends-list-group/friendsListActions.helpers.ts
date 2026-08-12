import { MessengerFriend } from '../../../../../api';
import { isStaffChatIdentity } from '../../../staffChatIdentity';

export const canFollowFriendListEntry = (friend: Pick<MessengerFriend, 'id' | 'name' | 'online'>) =>
    friend.online && friend.id > 0 && !isStaffChatIdentity(friend);
