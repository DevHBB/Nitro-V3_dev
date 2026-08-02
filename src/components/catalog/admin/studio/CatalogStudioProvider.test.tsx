/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageComposer } from '../../../../api';
import { useMessageEvent } from '../../../../hooks';
import { CatalogStudioProvider } from './CatalogStudioProvider';
import { useCatalogStudio } from './useCatalogStudio';

vi.mock('../../../../api', () => ({ SendMessageComposer: vi.fn() }));
vi.mock('../../../../hooks', () => ({ useMessageEvent: vi.fn() }));

const handlers = new Map<string, (event: any) => void>();

const Probe = () => {
    const studio = useCatalogStudio();

    return (
        <div>
            <span data-testid="draft">{studio.session?.draftVersionId ?? 0}</span>
            <span data-testid="revision">{studio.revision}</span>
            <span data-testid="pending">{studio.pendingCount}</span>
            <span data-testid="locks">{Object.keys(studio.locks).length}</span>
            <button onClick={() => studio.acquireLock('PAGE', 44)}>lock</button>
            <button onClick={() => studio.releaseLock('PAGE', 44)}>release</button>
            <button onClick={() => studio.publish()}>publish</button>
        </div>
    );
};

const emit = (eventName: string, parser: Record<string, unknown>) =>
    act(() => handlers.get(eventName)?.({ getParser: () => parser }));

describe('CatalogStudioProvider', () => {
    beforeEach(() => {
        handlers.clear();
        vi.mocked(SendMessageComposer).mockClear();
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
