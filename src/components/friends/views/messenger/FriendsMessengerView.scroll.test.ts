import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('FriendsMessengerView routing and scroll behavior', () =>
{
    it('does not dereference the legacy message box when the persistent view is mounted', () =>
    {
        const source = readFileSync(join(process.cwd(), 'src/components/friends/views/messenger/FriendsMessengerView.tsx'), 'utf8');

        expect(source).toContain('if(!messagesBox.current) return;');
    });

    it('routes Staff Chat and direct chats through the same persistent window', () =>
    {
        const source = readFileSync(join(process.cwd(), 'src/components/friends/views/messenger/FriendsMessengerView.tsx'), 'utf8');

        expect(source).not.toContain('isLegacyStaffChat');
        expect(source).not.toContain('shouldUseLegacyStaffChat');

        // Staff Chat must not get its own branch: both it and direct chats resolve a
        // thread and open the same window, so there is a single routing path.
        expect(source).not.toContain('if(participantId === -1)');
        expect(source).toContain('const thread = getMessageThread(participantId);');
        expect(source).toContain('setActiveThreadId(thread.threadId);');
        expect(source.match(/setActiveThreadId\(thread\.threadId\);/g)).toHaveLength(1);
    });

    it('keeps the Staff Chat avatar in the persistent tab bar', () =>
    {
        const source = readFileSync(join(process.cwd(), 'src/components/friends/views/messenger/FriendsPersistentMessengerView.tsx'), 'utf8');

        expect(source).toContain('figure={STAFF_CHAT_FIGURE}');
    });
});
