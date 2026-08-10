/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageComposer } from '../../../../api';
import { useConnectionState, useMessageEvent } from '../../../../hooks';
import { CatalogStudioProvider } from './CatalogStudioProvider';
import { useCatalogStudio } from './useCatalogStudio';

vi.mock('../../../../api', () => ({ SendMessageComposer: vi.fn() }));
vi.mock('../../../../hooks', () => ({ useConnectionState: vi.fn(), useMessageEvent: vi.fn() }));

const handlers = new Map<string, (event: any) => void>();
const pageSnapshot = (caption: string) => ({
    catalogType: 'NORMAL' as const, pageId: 42, parentId: -1, captionSave: 'page_42', caption,
    pageLayout: 'default_3x3', iconColor: 1, iconImage: 1, minRank: 1, orderNum: 1,
    visible: true, enabled: true, clubOnly: false, catalogMode: 'NORMAL', vipOnly: false,
    pageHeadline: '', pageTeaser: '', pageSpecial: '', pageText1: '', pageText2: '',
    pageTextDetails: '', pageTextTeaser: '', roomId: 0, includes: ''
});

const Probe = () => {
    const studio = useCatalogStudio();

    return (
        <div>
            <span data-testid="draft">{studio.session?.draftVersionId ?? 0}</span>
            <span data-testid="revision">{studio.revision}</span>
            <span data-testid="pending">{studio.pendingCount}</span>
            <span data-testid="locks">{Object.keys(studio.locks).length}</span>
            <span data-testid="error">{studio.lastError ?? ''}</span>
            <span data-testid="page-caption">{studio.session?.pages.find(page => page.pageId === 42)?.caption ?? ''}</span>
            <span data-testid="history-count">{studio.historyTotalCount}</span>
            <button onClick={() => studio.acquireLock('PAGE', 44)}>lock</button>
            <button onClick={() => studio.releaseLock('PAGE', 44)}>release</button>
            <button onClick={() => studio.publish()}>publish</button>
            <button onClick={() => studio.applyDocument('JSONC', '{"pages":[]}', 'fingerprint', 'Import JSONC')}>apply</button>
            <button onClick={() => studio.applyMutation({
                operationId: 'save-page-1', action: 'savePage', revision: 8, entityType: 'PAGE', catalogType: 'NORMAL',
                entity: pageSnapshot('Renamed'),
                historyGroup: {
                    id: 91, revision: 8, actorId: 9, actorName: 'Alice', summary: 'Edit page', source: 'UI', createdAt: '',
                    entries: [ { entityType: 'PAGE', catalogType: 'NORMAL', entityId: 42, operation: 'UPDATE' } ]
                }
            })}>delta</button>
        </div>
    );
};

const emit = (eventName: string, parser: Record<string, unknown>) =>
    act(() => handlers.get(eventName)?.({ getParser: () => parser }));

describe('CatalogStudioProvider', () => {
    beforeEach(() => {
        handlers.clear();
        vi.mocked(SendMessageComposer).mockClear();
        vi.mocked(useConnectionState).mockReturnValue({
            phase: 'connected',
            reconnectAttempt: 0,
            maxReconnectAttempts: 7,
            authenticated: true,
            closeCode: null,
            closeReason: ''
        });
        vi.mocked(useMessageEvent).mockImplementation((eventType: any, handler: any) => {
            handlers.set(eventType.name, handler);
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('opens and hydrates the shared server session', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);

        expect(vi.mocked(SendMessageComposer).mock.calls[0][0].constructor.name).toBe('CatalogStudioOpenSessionComposer');

        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11,
            draftVersionId: 12,
            revision: 7,
            activeUpdatedAt: '2026-08-02T10:00:00Z',
            draftCreatedAt: '2026-08-02T10:05:00Z',
            pendingCount: 3,
            actors: [ { id: 9, username: 'Alice' } ],
            validationCurrent: false,
            validationIssueCount: 0,
            publishedVersions: []
        });

        expect(screen.getByTestId('draft')).toHaveTextContent('12');
        expect(screen.getByTestId('revision')).toHaveTextContent('7');
        expect(screen.getByTestId('pending')).toHaveTextContent('3');
    });

    it('applies a mutation delta without requesting a broad session or history refresh', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 3,
            actors: [], validationCurrent: true, validationIssueCount: 0, publishedVersions: [],
            pages: [ pageSnapshot('Original') ], offers: []
        });
        const callsBefore = vi.mocked(SendMessageComposer).mock.calls.length;

        act(() => screen.getByText('delta').click());

        expect(screen.getByTestId('revision')).toHaveTextContent('8');
        expect(screen.getByTestId('pending')).toHaveTextContent('4');
        expect(screen.getByTestId('page-caption')).toHaveTextContent('Renamed');
        expect(screen.getByTestId('history-count')).toHaveTextContent('1');
        expect(vi.mocked(SendMessageComposer).mock.calls).toHaveLength(callsBefore);
    });

    it('waits for authentication and opens a fresh session after reconnecting', () => {
        vi.mocked(useConnectionState).mockReturnValue({
            phase: 'connecting',
            reconnectAttempt: 0,
            maxReconnectAttempts: 7,
            authenticated: false,
            closeCode: null,
            closeReason: ''
        });
        const view = render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);

        expect(vi.mocked(SendMessageComposer)).not.toHaveBeenCalled();

        vi.mocked(useConnectionState).mockReturnValue({
            phase: 'connected',
            reconnectAttempt: 0,
            maxReconnectAttempts: 7,
            authenticated: true,
            closeCode: null,
            closeReason: ''
        });
        view.rerender(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);

        expect(vi.mocked(SendMessageComposer).mock.calls
            .filter(([ composer ]) => composer.constructor.name === 'CatalogStudioOpenSessionComposer')).toHaveLength(1);

        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 0,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });
        expect(screen.getByTestId('draft')).toHaveTextContent('12');

        vi.mocked(useConnectionState).mockReturnValue({
            phase: 'reconnecting',
            reconnectAttempt: 1,
            maxReconnectAttempts: 7,
            authenticated: false,
            closeCode: null,
            closeReason: ''
        });
        view.rerender(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        expect(screen.getByTestId('draft')).toHaveTextContent('0');

        vi.mocked(useConnectionState).mockReturnValue({
            phase: 'connected',
            reconnectAttempt: 0,
            maxReconnectAttempts: 7,
            authenticated: true,
            closeCode: null,
            closeReason: ''
        });
        view.rerender(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);

        expect(vi.mocked(SendMessageComposer).mock.calls
            .filter(([ composer ]) => composer.constructor.name === 'CatalogStudioOpenSessionComposer')).toHaveLength(2);
    });

    it('uses server revisions and recovers from a stale operation', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 1,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });

        act(() => screen.getByText('publish').click());
        const publish = vi.mocked(SendMessageComposer).mock.calls.at(-1)[0] as any;
        expect(publish.getMessageArray().slice(1)).toEqual([ 12, 7 ]);

        emit('CatalogStudioPublishEvent', {
            operationId: publish.getMessageArray()[0], success: false,
            code: 'STALE_REVISION', message: 'Refresh required', revision: 8, changedEntities: []
        });

        expect(screen.getByTestId('revision')).toHaveTextContent('8');
        expect(vi.mocked(SendMessageComposer).mock.calls.at(-1)[0].constructor.name).toBe('CatalogStudioOpenSessionComposer');
    });

    it('renews an acquired lock and releases it when requested', () => {
        vi.useFakeTimers();
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 0,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });

        act(() => screen.getByText('lock').click());
        const acquire = vi.mocked(SendMessageComposer).mock.calls.at(-1)[0] as any;
        emit('CatalogStudioAcquireLockEvent', {
            operationId: acquire.getMessageArray()[0], success: true, code: 'LOCK_ACQUIRED', message: '',
            draftVersionId: 12, entityType: 'PAGE', entityId: 44, ownerId: 9,
            ownerName: 'Alice', token: 'token-123', expiresAt: '2026-08-02T10:06:30Z'
        });

        act(() => vi.advanceTimersByTime(30_000));
        expect(vi.mocked(SendMessageComposer).mock.calls.at(-1)[0].constructor.name).toBe('CatalogStudioRenewLockComposer');

        act(() => screen.getByText('release').click());
        const release = vi.mocked(SendMessageComposer).mock.calls.at(-1)[0] as any;
        expect(release.constructor.name).toBe('CatalogStudioReleaseLockComposer');
        expect(release.getMessageArray()).toEqual(expect.arrayContaining([ 12, 'PAGE', 44, 'token-123' ]));
    });

    it('does not send duplicate lock requests while the first request is pending', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 0,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });

        act(() => {
            screen.getByText('lock').click();
            screen.getByText('lock').click();
        });

        const acquireCalls = vi.mocked(SendMessageComposer).mock.calls
            .filter(([ composer ]) => composer.constructor.name === 'CatalogStudioAcquireLockComposer');
        expect(acquireCalls).toHaveLength(1);
    });

    it('acquires the catalog lock and continues a document apply automatically', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 0,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });

        act(() => screen.getByText('apply').click());
        const acquire = vi.mocked(SendMessageComposer).mock.calls.at(-1)[0] as any;
        expect(acquire.constructor.name).toBe('CatalogStudioAcquireLockComposer');
        expect(acquire.getMessageArray()).toEqual(expect.arrayContaining([ 12, 'PAGE', 'NORMAL', 2147483647 ]));
        expect(vi.mocked(SendMessageComposer).mock.calls
            .filter(([ composer ]) => composer.constructor.name === 'CatalogStudioDocumentApplyComposer')).toHaveLength(0);

        emit('CatalogStudioAcquireLockEvent', {
            operationId: acquire.getMessageArray()[0], success: true, code: 'LOCK_ACQUIRED', message: '',
            draftVersionId: 12, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 2147483647,
            ownerId: 9, ownerName: 'Alice', token: 'root-token', expiresAt: '2026-08-02T10:06:30Z'
        });

        const apply = vi.mocked(SendMessageComposer).mock.calls.at(-1)[0] as any;
        expect(apply.constructor.name).toBe('CatalogStudioDocumentApplyComposer');
        expect(apply.getMessageArray().slice(1)).toEqual([
            12, 7, 'root-token', 'JSONC', '{"pages":[]}', 'fingerprint', 'Import JSONC'
        ]);
    });

    it('ignores a late lock response from an obsolete draft', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 0,
            actors: [], validationCurrent: false, validationIssueCount: 0, publishedVersions: []
        });

        act(() => screen.getByText('apply').click());
        emit('CatalogStudioAcquireLockEvent', {
            operationId: 'late-lock', success: true, code: 'LOCK_ACQUIRED', message: '',
            draftVersionId: 11, entityType: 'PAGE', catalogType: 'NORMAL', entityId: 2147483647,
            ownerId: 9, ownerName: 'Alice', token: 'obsolete-token', expiresAt: '2026-08-02T10:06:30Z'
        });

        expect(screen.getByTestId('locks')).toHaveTextContent('0');
        expect(screen.getByTestId('error')).toHaveTextContent('draft changed');
        expect(vi.mocked(SendMessageComposer).mock.calls
            .filter(([ composer ]) => composer.constructor.name === 'CatalogStudioDocumentApplyComposer')).toHaveLength(0);
    });

    it('drops locks from the old draft after a successful publication', () => {
        render(<CatalogStudioProvider active><Probe /></CatalogStudioProvider>);
        emit('CatalogStudioSessionEvent', {
            activeVersionId: 11, draftVersionId: 12, revision: 7,
            activeUpdatedAt: '', draftCreatedAt: '', pendingCount: 1,
            actors: [], validationCurrent: true, validationIssueCount: 0, publishedVersions: []
        });
        emit('CatalogStudioAcquireLockEvent', {
            operationId: 'lock', success: true, code: 'LOCK_ACQUIRED', message: '',
            draftVersionId: 12, entityType: 'PAGE', entityId: 44, ownerId: 9,
            ownerName: 'Alice', token: 'token-123', expiresAt: '2026-08-02T10:06:30Z'
        });
        expect(screen.getByTestId('locks')).toHaveTextContent('1');

        emit('CatalogStudioPublishEvent', {
            operationId: 'publish', success: true, code: 'PUBLISHED', message: '',
            revision: 8, changedEntities: []
        });

        expect(screen.getByTestId('locks')).toHaveTextContent('0');
    });
});
