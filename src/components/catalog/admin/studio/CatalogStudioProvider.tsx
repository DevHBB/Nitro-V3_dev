import {
    CatalogStudioAcquireLockComposer,
    CatalogStudioAcquireLockEvent,
    CatalogStudioDiscardComposer,
    CatalogStudioDiscardEvent,
    CatalogStudioDocumentApplyComposer,
    CatalogStudioDocumentDryRunComposer,
    CatalogStudioDocumentResultEvent,
    CatalogStudioExportComposer,
    CatalogStudioHistoryComposer,
    CatalogStudioHistoryEvent,
    CatalogStudioOpenSessionComposer,
    CatalogStudioPublishComposer,
    CatalogStudioPublishEvent,
    CatalogStudioPreviewComposer,
    CatalogStudioPreviewEvent,
    CatalogStudioReleaseLockComposer,
    CatalogStudioReleaseLockEvent,
    CatalogStudioRenewLockComposer,
    CatalogStudioRenewLockEvent,
    CatalogStudioRestoreComposer,
    CatalogStudioRestoreEvent,
    CatalogStudioSessionEvent,
    CatalogStudioUndoComposer,
    CatalogStudioUndoEvent,
    CatalogStudioValidateComposer,
    CatalogStudioValidationEvent
} from '@nitrots/nitro-renderer';
import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SendMessageComposer } from '../../../../api';
import { useMessageEvent } from '../../../../hooks';
import { CatalogStudioDocumentResult, CatalogStudioHistoryGroup, CatalogStudioLock, CatalogStudioPreviewState, CatalogStudioSession, CatalogStudioValidationState } from './CatalogStudioTypes';
import { CatalogPreviewPersona } from './CatalogPreviewPersona';
import { CatalogStudioContext, CatalogStudioContextValue } from './useCatalogStudio';

const lockKey = (entityType: string, entityId: number, catalogType: string = 'NORMAL') =>
    catalogType === 'NORMAL' ? `${entityType}:${entityId}` : `${catalogType}:${entityType}:${entityId}`;
let operationSequence = 0;
const nextOperationId = (action: string) => `${action}-${Date.now()}-${++operationSequence}`;
const CATALOG_ROOT_LOCK_ID = 2147483647;

export const CatalogStudioProvider: FC<{ active: boolean; children: ReactNode }> = ({ active, children }) => {
    const [session, setSession] = useState<CatalogStudioSession | null>(null);
    const [history, setHistory] = useState<CatalogStudioHistoryGroup[]>([]);
    const [historyTotalCount, setHistoryTotalCount] = useState(0);
    const [validation, setValidation] = useState<CatalogStudioValidationState | null>(null);
    const [preview, setPreview] = useState<CatalogStudioPreviewState | null>(null);
    const [documentResult, setDocumentResult] = useState<CatalogStudioDocumentResult | null>(null);
    const [locks, setLocks] = useState<Record<string, CatalogStudioLock>>({});
    const [loading, setLoading] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const sessionRef = useRef<CatalogStudioSession | null>(null);
    const locksRef = useRef<Record<string, CatalogStudioLock>>({});

    const replaceSession = useCallback((next: CatalogStudioSession) => {
        sessionRef.current = next;
        setSession(next);
    }, []);

    const refresh = useCallback(() => {
        if (!active) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioOpenSessionComposer());
    }, [active]);

    const updateRevision = useCallback((revision: number) => {
        setSession((current) => {
            if (!current || current.revision === revision) return current;
            const next = { ...current, revision };
            sessionRef.current = next;
            return next;
        });
    }, []);

    useMessageEvent<CatalogStudioSessionEvent>(CatalogStudioSessionEvent, (event) => {
        const parser = event.getParser();
        replaceSession({
            activeVersionId: parser.activeVersionId,
            draftVersionId: parser.draftVersionId,
            revision: parser.revision,
            activeUpdatedAt: parser.activeUpdatedAt,
            draftCreatedAt: parser.draftCreatedAt,
            pendingCount: parser.pendingCount,
            actors: parser.actors.map((actor) => ({ ...actor })),
            validationCurrent: parser.validationCurrent,
            validationIssueCount: parser.validationIssueCount,
            publishedVersions: parser.publishedVersions.map((version) => ({ ...version })),
            pages: (parser.pages ?? []).map((page) => ({ ...page })),
            offers: (parser.offers ?? []).map((offer) => ({ ...offer }))
        });
        setLoading(false);
        setLastError(null);
    });

    const handleLock = useCallback((event: CatalogStudioAcquireLockEvent | CatalogStudioRenewLockEvent) => {
        const parser = event.getParser();
        setLoading(false);
        if (!parser.success) {
            setLastError(parser.message || parser.code);
            return;
        }
        const nextLock: CatalogStudioLock = {
            draftVersionId: parser.draftVersionId,
            entityType: parser.entityType,
            catalogType: parser.catalogType === 'BUILDER' ? 'BUILDER' : 'NORMAL',
            entityId: parser.entityId,
            ownerId: parser.ownerId,
            ownerName: parser.ownerName,
            token: parser.token,
            expiresAt: parser.expiresAt
        };
        setLocks((current) => {
            const next = { ...current, [lockKey(nextLock.entityType, nextLock.entityId, nextLock.catalogType)]: nextLock };
            locksRef.current = next;
            return next;
        });
        setLastError(null);
    }, []);

    useMessageEvent<CatalogStudioAcquireLockEvent>(CatalogStudioAcquireLockEvent, handleLock);
    useMessageEvent<CatalogStudioRenewLockEvent>(CatalogStudioRenewLockEvent, handleLock);

    const handleOperation = useCallback((event: CatalogStudioReleaseLockEvent | CatalogStudioUndoEvent | CatalogStudioPublishEvent | CatalogStudioDiscardEvent | CatalogStudioRestoreEvent) => {
        const parser = event.getParser();
        updateRevision(parser.revision);
        setLoading(false);
        if (!parser.success) {
            setLastError(parser.message || parser.code);
            if (parser.code === 'STALE_REVISION') refresh();
            return;
        }
        setLastError(null);
        refresh();
    }, [refresh, updateRevision]);

    const handleLifecycleOperation = useCallback((event: CatalogStudioPublishEvent | CatalogStudioDiscardEvent | CatalogStudioRestoreEvent) => {
        if (event.getParser().success) {
            locksRef.current = {};
            setLocks({});
        }
        handleOperation(event);
    }, [handleOperation]);

    useMessageEvent<CatalogStudioReleaseLockEvent>(CatalogStudioReleaseLockEvent, handleOperation);
    useMessageEvent<CatalogStudioUndoEvent>(CatalogStudioUndoEvent, handleOperation);
    useMessageEvent<CatalogStudioPublishEvent>(CatalogStudioPublishEvent, handleLifecycleOperation);
    useMessageEvent<CatalogStudioDiscardEvent>(CatalogStudioDiscardEvent, handleLifecycleOperation);
    useMessageEvent<CatalogStudioRestoreEvent>(CatalogStudioRestoreEvent, handleLifecycleOperation);

    useMessageEvent<CatalogStudioHistoryEvent>(CatalogStudioHistoryEvent, (event) => {
        const parser = event.getParser();
        updateRevision(parser.revision);
        setHistory(parser.groups.map((group) => ({ ...group, entries: group.entries.map((entry) => ({ ...entry })) })));
        setHistoryTotalCount(parser.totalCount);
        setLoading(false);
    });

    useMessageEvent<CatalogStudioValidationEvent>(CatalogStudioValidationEvent, (event) => {
        const parser = event.getParser();
        const next: CatalogStudioValidationState = {
            operationId: parser.operationId,
            success: parser.success,
            code: parser.code,
            message: parser.message,
            revision: parser.revision,
            current: parser.current,
            issues: parser.issues.map((issue) => ({ ...issue }))
        };
        setValidation(next);
        updateRevision(parser.revision);
        setLoading(false);
        setLastError(parser.success ? null : parser.message || parser.code);
    });

    useMessageEvent<CatalogStudioPreviewEvent>(CatalogStudioPreviewEvent, (event) => {
        const parser = event.getParser();
        setPreview({
            revision: parser.revision,
            pages: parser.pages.map((page) => ({ ...page })),
            offers: parser.offers.map((entry) => ({
                offer: { ...entry.offer }, eligible: entry.eligible, reasons: [ ...entry.reasons ]
            }))
        });
        setLoading(false);
        setLastError(null);
    });

    useMessageEvent<CatalogStudioDocumentResultEvent>(CatalogStudioDocumentResultEvent, (event) => {
        const parser = event.getParser();
        const result: CatalogStudioDocumentResult = {
            operationId: parser.operationId,
            success: parser.success,
            code: parser.code,
            message: parser.message,
            revision: parser.revision,
            format: parser.format,
            document: parser.document,
            fingerprint: parser.fingerprint,
            changedEntities: parser.changedEntities
        };
        setDocumentResult(result);
        setLoading(false);
        setLastError(result.success ? null : result.message || result.code);
        if(result.code === 'APPLIED' || result.code === 'ALREADY_APPLIED') refresh();
    });

    useEffect(() => {
        if (!active) {
            setSession(null);
            sessionRef.current = null;
            return;
        }
        refresh();
    }, [active, refresh]);

    useEffect(() => {
        if (!active) return;
        const timer = window.setInterval(() => {
            Object.values(locksRef.current).forEach((lock) => {
                SendMessageComposer(new CatalogStudioRenewLockComposer(
                    nextOperationId('renew-lock'), lock.draftVersionId, lock.entityType,
                    lock.catalogType, lock.entityId, lock.token
                ));
            });
        }, 30_000);
        return () => window.clearInterval(timer);
    }, [active]);

    const acquireLock = useCallback((entityType: string, entityId: number, catalogType: 'NORMAL' | 'BUILDER' = 'NORMAL') => {
        const current = sessionRef.current;
        if (!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioAcquireLockComposer(nextOperationId('acquire-lock'), current.draftVersionId, entityType, catalogType, entityId));
    }, []);

    const releaseLock = useCallback((entityType: string, entityId: number, catalogType: 'NORMAL' | 'BUILDER' = 'NORMAL') => {
        const lock = locksRef.current[lockKey(entityType, entityId, catalogType)];
        if (!lock) return;
        SendMessageComposer(new CatalogStudioReleaseLockComposer(
            nextOperationId('release-lock'), lock.draftVersionId, lock.entityType, lock.catalogType, lock.entityId, lock.token
        ));
        setLocks((current) => {
            const next = { ...current };
            delete next[lockKey(entityType, entityId, catalogType)];
            locksRef.current = next;
            return next;
        });
    }, []);

    const loadHistory = useCallback((offset = 0, limit = 50) => {
        const current = sessionRef.current;
        if (!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioHistoryComposer(current.draftVersionId, offset, limit));
    }, []);

    const revisionAction = useCallback((action: 'validate' | 'publish' | 'discard') => {
        const current = sessionRef.current;
        if (!current) return;
        setLoading(true);
        const operationId = nextOperationId(action);
        if (action === 'validate') SendMessageComposer(new CatalogStudioValidateComposer(operationId, current.draftVersionId, current.revision));
        if (action === 'publish') SendMessageComposer(new CatalogStudioPublishComposer(operationId, current.draftVersionId, current.revision));
        if (action === 'discard') SendMessageComposer(new CatalogStudioDiscardComposer(operationId, current.draftVersionId, current.revision));
    }, []);

    const undo = useCallback((groupId: number) => {
        const current = sessionRef.current;
        if (!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioUndoComposer(nextOperationId('undo'), current.draftVersionId, current.revision, groupId));
    }, []);

    const restore = useCallback((sourceVersionId: number) => {
        const current = sessionRef.current;
        if (!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioRestoreComposer(nextOperationId('restore'), current.draftVersionId, current.revision, sourceVersionId));
    }, []);

    const requestPreview = useCallback((persona: CatalogPreviewPersona) => {
        const current = sessionRef.current;
        if(!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioPreviewComposer(
            nextOperationId('preview'), current.draftVersionId, current.revision, persona.rank,
            persona.hc, persona.vip, persona.buildersClub, persona.showHidden, persona.credits, persona.currencies
        ));
    }, []);

    const exportDocument = useCallback((format: 'JSONC' | 'SQL') => {
        const current = sessionRef.current;
        if(!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioExportComposer(
            nextOperationId('export'), current.draftVersionId, current.revision, format
        ));
    }, []);

    const dryRunDocument = useCallback((format: 'JSONC' | 'SQL' | 'BULK', document: string) => {
        const current = sessionRef.current;
        if(!current) return;
        setLoading(true);
        SendMessageComposer(new CatalogStudioDocumentDryRunComposer(
            nextOperationId('dry-run'), current.draftVersionId, current.revision, format, document
        ));
    }, []);

    const applyDocument = useCallback((format: 'JSONC' | 'SQL' | 'BULK', document: string, fingerprint: string, summary: string) => {
        const current = sessionRef.current;
        if(!current) return;
        const rootLock = locksRef.current[lockKey('PAGE', CATALOG_ROOT_LOCK_ID)];
        if(!rootLock) {
            setLastError('Acquire the catalog root lock before applying a bulk or import operation.');
            return;
        }
        setLoading(true);
        SendMessageComposer(new CatalogStudioDocumentApplyComposer(
            nextOperationId('apply'), current.draftVersionId, current.revision, rootLock.token,
            format, document, fingerprint, summary
        ));
    }, []);

    const value = useMemo<CatalogStudioContextValue>(() => ({
        session,
        revision: session?.revision ?? 0,
        pendingCount: session?.pendingCount ?? 0,
        history,
        historyTotalCount,
        validation,
        preview,
        documentResult,
        locks,
        loading,
        lastError,
        refresh,
        acquireLock,
        releaseLock,
        loadHistory,
        undo,
        validate: () => revisionAction('validate'),
        publish: () => revisionAction('publish'),
        discard: () => revisionAction('discard'),
        restore,
        requestPreview,
        exportDocument,
        dryRunDocument,
        applyDocument
    }), [session, history, historyTotalCount, validation, preview, documentResult, locks, loading, lastError, refresh, acquireLock, releaseLock, loadHistory, undo, revisionAction, restore, requestPreview, exportDocument, dryRunDocument, applyDocument]);

    return <CatalogStudioContext value={value}>{children}</CatalogStudioContext>;
};
