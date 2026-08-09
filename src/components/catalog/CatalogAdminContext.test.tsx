/* @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogAdminProvider, useCatalogAdmin } from './CatalogAdminContext';

const mocks = vi.hoisted(() => ({
    acquireLock: vi.fn(),
    applyMutation: vi.fn(),
    handlers: new Map<string, (event: any) => void>(),
    loadHistory: vi.fn(),
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
    useMessageEvent: (eventType: any, handler: (event: any) => void) =>
        mocks.handlers.set(`${eventType?.name ?? 'anonymous'}-${mocks.handlers.size}`, handler),
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

const OfferProbe = () => {
    const admin = useCatalogAdmin();

    return (
        <div>
            <button onClick={() => admin.setEditingOffer({ offerId: 99 } as any)}>open-offer</button>
            <span data-testid="offer-name">{admin.editingOfferDetails?.catalogName ?? ''}</span>
        </div>
    );
};

const SaveProbe = () => {
    const admin = useCatalogAdmin();
    return <div>
        <button onClick={() => admin.savePage({
            pageId: 42, caption: 'Renamed', captionSave: 'page_42', parentId: -1, catalogMode: 'NORMAL',
            pageLayout: 'default_3x3', iconColor: 1, iconImage: 1, enabled: '1', visible: '1', minRank: 1,
            orderNum: 1
        })}>save-page</button>
        <span data-testid="mutation-id">{admin.lastMutationResult?.operationId ?? ''}</span>
        <span data-testid="field-error">{admin.lastMutationResult?.fieldErrors.caption ?? ''}</span>
    </div>;
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

const emitAdminResult = (parser: Record<string, unknown>) => {
    const handler = Array.from(mocks.handlers.values()).at(-1);
    act(() => handler?.({ getParser: () => parser }));
};

describe('CatalogAdminProvider page mutations', () => {
    let studio: Record<string, any>;

    beforeEach(() => {
        mocks.acquireLock.mockReset();
        mocks.applyMutation.mockReset();
        mocks.handlers.clear();
        mocks.loadHistory.mockReset();
        mocks.refresh.mockReset();
        mocks.sendMessage.mockReset();
        studio = {
            session,
            revision: session.revision,
            locks: {},
            lastError: null,
            acquireLock: mocks.acquireLock,
            refresh: mocks.refresh,
            loadHistory: mocks.loadHistory,
            applyMutation: mocks.applyMutation,
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

    it('retries an offer inspector read after the studio session becomes ready', async () => {
        studio = { ...studio, session: null };
        const view = render(<CatalogAdminProvider><OfferProbe /></CatalogAdminProvider>);

        act(() => screen.getByText('open-offer').click());
        expect(mocks.sendMessage).not.toHaveBeenCalled();

        studio = {
            ...studio,
            session: {
                ...session,
                offers: [ {
                    catalogType: 'NORMAL',
                    offerId: 99,
                    itemIds: '100',
                    pageId: 42,
                    catalogName: 'studio_offer',
                    costCredits: 5,
                    costPoints: 0,
                    pointsType: 0,
                    amount: 1,
                    limitedStack: 0,
                    orderNumber: -1,
                    offerIdClient: 77,
                    songId: 321,
                    extradata: '',
                    haveOffer: true,
                    clubOnly: false
                } ]
            }
        };
        view.rerender(<CatalogAdminProvider><OfferProbe /></CatalogAdminProvider>);

        await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledTimes(1));
        expect(mocks.sendMessage.mock.calls[0][0].constructor.name).toBe('CatalogAdminLoadOfferComposer');
        expect(screen.getByTestId('offer-name')).toHaveTextContent('studio_offer');
    });

    it('applies a correlated Smart Save result without broad refreshes', () => {
        const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
        studio = {
            ...studio,
            locks: {
                'PAGE:42': { draftVersionId: 12, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42,
                    ownerId: 9, ownerName: 'Alice', token: 'page-token', expiresAt: '' }
            }
        };
        render(<CatalogAdminProvider><SaveProbe /></CatalogAdminProvider>);

        act(() => screen.getByText('save-page').click());
        const composer = mocks.sendMessage.mock.calls[0][0];
        const operationId = composer.getMessageArray().at(-1);
        expect(operationId).toMatch(/^savePage-/);

        const entity = {
            catalogType: 'NORMAL', pageId: 42, parentId: -1, captionSave: 'page_42', caption: 'Renamed',
            pageLayout: 'default_3x3', iconColor: 1, iconImage: 1, minRank: 1, orderNum: 1,
            visible: true, enabled: true, clubOnly: false, catalogMode: 'NORMAL', vipOnly: false,
            pageHeadline: '', pageTeaser: '', pageSpecial: '', pageText1: '', pageText2: '', pageTextDetails: '',
            pageTextTeaser: '', roomId: 0, includes: ''
        };
        emitAdminResult({
            success: true, message: 'Saved', smartSaveResult: {
                protocolVersion: 1, operationId, action: 'savePage', code: 'SAVED', draftVersionId: 12,
                revision: 4, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42, entity,
                historyGroup: { id: 91, revision: 4, actorId: 9, actorName: 'Alice', summary: 'Edit page',
                    source: 'UI', createdAt: '', entries: [ { entityType: 'PAGE', entityId: 42, operation: 'UPDATE' } ] },
                fieldErrors: {}, serverDurationMs: 7
            }
        });

        expect(mocks.applyMutation).toHaveBeenCalledTimes(1);
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(mocks.loadHistory).not.toHaveBeenCalled();
        expect(dispatchEvent).not.toHaveBeenCalled();
        expect(screen.getByTestId('mutation-id')).toHaveTextContent(operationId);
        dispatchEvent.mockRestore();
    });

    it('exposes correlated field errors without clearing the editor', () => {
        studio = {
            ...studio,
            locks: {
                'PAGE:42': { draftVersionId: 12, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42,
                    ownerId: 9, ownerName: 'Alice', token: 'page-token', expiresAt: '' }
            }
        };
        render(<CatalogAdminProvider><SaveProbe /></CatalogAdminProvider>);
        act(() => screen.getByText('save-page').click());
        const operationId = mocks.sendMessage.mock.calls[0][0].getMessageArray().at(-1);

        emitAdminResult({
            success: false, message: 'Page caption is required', smartSaveResult: {
                protocolVersion: 1, operationId, action: 'savePage', code: 'VALIDATION_FAILED', draftVersionId: 12,
                revision: 3, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42, entity: null,
                historyGroup: null, fieldErrors: { caption: 'Page caption is required' }, serverDurationMs: 2
            }
        });

        expect(screen.getByTestId('field-error')).toHaveTextContent('Page caption is required');
        expect(mocks.applyMutation).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('retains broad refresh behavior for a legacy two-field result', () => {
        studio = {
            ...studio,
            locks: {
                'PAGE:42': { draftVersionId: 12, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42,
                    ownerId: 9, ownerName: 'Alice', token: 'page-token', expiresAt: '' }
            }
        };
        render(<CatalogAdminProvider><SaveProbe /></CatalogAdminProvider>);
        act(() => screen.getByText('save-page').click());
        emitAdminResult({
            success: true, message: 'Saved', smartSaveResult: null
        });

        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        expect(mocks.loadHistory).toHaveBeenCalledTimes(1);
    });

    it('keeps public catalog refreshes for a legacy delete result', () => {
        const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
        studio = {
            ...studio,
            locks: {
                'PAGE:42': { draftVersionId: 12, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42,
                    ownerId: 9, ownerName: 'Alice', token: 'token-42', expiresAt: '' }
            }
        };
        render(<CatalogAdminProvider><Probe action="delete" /></CatalogAdminProvider>);
        act(() => screen.getByText('delete').click());
        emitAdminResult({ success: true, message: 'Deleted', smartSaveResult: null });

        expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'catalog-admin-refresh-index' }));
        dispatchEvent.mockRestore();
    });
});
