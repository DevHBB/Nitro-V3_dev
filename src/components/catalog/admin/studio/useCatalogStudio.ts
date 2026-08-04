import { createContext, useContext } from 'react';
import { CatalogStudioDocumentResult, CatalogStudioHistoryGroup, CatalogStudioLock, CatalogStudioPreviewState, CatalogStudioSession, CatalogStudioValidationState } from './CatalogStudioTypes';
import { CatalogPreviewPersona } from './CatalogPreviewPersona';

export interface CatalogStudioContextValue {
    session: CatalogStudioSession | null;
    revision: number;
    pendingCount: number;
    history: CatalogStudioHistoryGroup[];
    historyTotalCount: number;
    validation: CatalogStudioValidationState | null;
    preview: CatalogStudioPreviewState | null;
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
    discard: () => void;
    restore: (sourceVersionId: number) => void;
    requestPreview: (persona: CatalogPreviewPersona) => void;
    exportDocument: (format: 'JSONC' | 'SQL') => void;
    dryRunDocument: (format: 'JSONC' | 'SQL' | 'BULK', document: string) => void;
    applyDocument: (format: 'JSONC' | 'SQL' | 'BULK', document: string, fingerprint: string, summary: string) => void;
}

export const CatalogStudioContext = createContext<CatalogStudioContextValue>(null);
export const useCatalogStudio = () => useContext(CatalogStudioContext);
