/* @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogAdminProvider, useCatalogAdmin } from './CatalogAdminContext';

const mocks = vi.hoisted(() => ({
    acquireLock: vi.fn(),
    refresh: vi.fn(),
    sendMessage: vi.fn(),
    useCatalogStudio: vi.fn()
}));

vi.mock('../../api', () => ({
    NotificationAlertType: { ALERT: 'alert' },
    SendMessageComposer: mocks.sendMessage
}));

vi.mock('../../hooks', () => ({
    useCatalogUiState: () => ({ currentType: 'NORMAL' }),
    useMessageEvent: vi.fn(),
    useNotification: () => ({ simpleAlert: null })
}));

vi.mock('./admin/studio/useCatalogStudio', () => ({
    useCatalogStudio: mocks.useCatalogStudio
}));

type PageMutationAction = 'delete' | 'move' | 'toggleEnabled' | 'toggleVisible';

const Probe = ({ action }: { action: PageMutationAction }) => {
    const admin = useCatalogAdmin();

    const mutate = () => {
        switch (action) {
            case 'delete':
                admin.deletePage(42, 'Deleted page');
                break;
            case 'move':
                admin.reorderPage(42, 7, 1, 'Moved page');
                break;
            case 'toggleEnabled':
                admin.togglePageEnabled(42, false, 'Disabled page');
                break;
            case 'toggleVisible':
                admin.togglePageVisible(42, false, 'Hidden page');
                break;
        }
    };

    return <button onClick={mutate}>{action}</button>;
};

const session = {
    activeVersionId: 11,
    draftVersionId: 12,
    revision: 3,
    activeUpdatedAt: '',
    draftCreatedAt: '',
    pendingCount: 0,
    actors: [],
    validationCurrent: false,
    validationIssueCount: 0,
    publishedVersions: [],
    pages: [],
    offers: []
};

describe('CatalogAdminProvider page mutations', () => {
    let studio: Record<string, any>;

    beforeEach(() => {
        mocks.acquireLock.mockReset();
        mocks.refresh.mockReset();
        mocks.sendMessage.mockReset();
        studio = {
            session,
            revision: session.revision,
            locks: {},
            lastError: null,
            acquireLock: mocks.acquireLock,
            refresh: mocks.refresh,
            loadHistory: vi.fn(),
            publish: vi.fn()
        };
        mocks.useCatalogStudio.mockImplementation(() => studio);
    });

    afterEach(cleanup);

    const cases: Array<{
        action: PageMutationAction;
        composer: string;
        args: unknown[];
    }> = [
        {
            action: 'delete',
            composer: 'CatalogAdminDeletePageComposer',
            args: [ 42, 'NORMAL', 12, 3, 'token-42', 'Deleted page' ]
        },
        {
            action: 'move',
            composer: 'CatalogAdminMovePageComposer',
            args: [ 42, 7, 1, 'NORMAL', 12, 3, 'token-42', 'Moved page' ]
        },
        {
            action: 'toggleEnabled',
            composer: 'CatalogAdminSetPageEnabledComposer',
            args: [ 42, false, 'NORMAL', 12, 3, 'token-42', 'Disabled page' ]
        },
        {
            action: 'toggleVisible',
            composer: 'CatalogAdminSetPageVisibleComposer',
            args: [ 42, false, 'NORMAL', 12, 3, 'token-42', 'Hidden page' ]
        }
    ];

    it.each(cases)('acquires the page lock and resumes a queued $action mutation', async ({ action, composer, args }) => {
        const view = render(<CatalogAdminProvider><Probe action={action} /></CatalogAdminProvider>);

        act(() => screen.getByText(action).click());

        expect(mocks.acquireLock).toHaveBeenCalledWith('PAGE', 42, 'NORMAL');
        expect(mocks.sendMessage).not.toHaveBeenCalled();

        studio = {
            ...studio,
            locks: {
                'PAGE:42': {
                    draftVersionId: 12,
                    entityType: 'PAGE',
                    catalogType: 'NORMAL',
                    entityId: 42,
                    ownerId: 9,
                    ownerName: 'Alice',
                    token: 'token-42',
                    expiresAt: '2026-08-02T18:00:00Z'
                }
            }
        };
        view.rerender(<CatalogAdminProvider><Probe action={action} /></CatalogAdminProvider>);

        await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledTimes(1));
        const message = mocks.sendMessage.mock.calls[0][0];
        expect(message.constructor.name).toBe(composer);
        expect(message.getMessageArray()).toEqual(args);
    });

    it('refreshes a missing session and then acquires the queued page lock', async () => {
        studio = { ...studio, session: null };
        const view = render(<CatalogAdminProvider><Probe action="move" /></CatalogAdminProvider>);

        act(() => screen.getByText('move').click());

        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        expect(mocks.acquireLock).not.toHaveBeenCalled();

        studio = { ...studio, session };
        view.rerender(<CatalogAdminProvider><Probe action="move" /></CatalogAdminProvider>);

        await waitFor(() => expect(mocks.acquireLock).toHaveBeenCalledWith('PAGE', 42, 'NORMAL'));
        expect(mocks.sendMessage).not.toHaveBeenCalled();
    });
});
