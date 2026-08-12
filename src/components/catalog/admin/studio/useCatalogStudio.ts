import { createContext, useContext } from 'react';
import { CatalogStudioDocumentResult, CatalogStudioHistoryGroup, CatalogStudioLock, CatalogStudioMutationResult, CatalogStudioSession, CatalogStudioValidationState } from './CatalogStudioTypes';

export interface CatalogStudioContextValue {
    session: CatalogStudioSession | null;
    revision: number;
    pendingCount: number;
    history: CatalogStudioHistoryGroup[];
    historyTotalCount: number;
    validation: CatalogStudioValidationState | null;
    documentResult: CatalogStudioDocumentResult | null;
    locks: Readonly<Record<string, CatalogStudioLock>>;
    loading: boolean;
    lastError: string | null;
    refresh: () => void;
    acquireLock: (entityType: string, entityId: number, catalogType?: 'NORMAL' | 'BUILDER') => void;
    releaseLock: (entityType: string, entityId: number, catalogType?: 'NORMAL' | 'BUILDER') => void;
    loadHistory: (offset?: number, limit?: number) => void;
    undo: (groupId: number) => void;
    validate: () => void;
    publish: () => void;
    exportDocument: (format: 'SQL') => void;
    dryRunDocument: (format: 'SQL', document: string) => void;
    applyDocument: (format: 'SQL', document: string, fingerprint: string, summary: string) => void;
    applyMutation: (mutation: CatalogStudioMutationResult) => void;
}

export const CatalogStudioContext = createContext<CatalogStudioContextValue>(null);
export const useCatalogStudio = () => useContext(CatalogStudioContext);
