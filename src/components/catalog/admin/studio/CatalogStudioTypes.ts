export interface CatalogStudioActor {
    id: number;
    username: string;
}

export interface CatalogStudioPublishedVersion {
    id: number;
    label: string;
    publishedAt: string;
}

export type CatalogStudioCatalogType = 'NORMAL' | 'BUILDER';

export interface CatalogStudioPageSnapshot {
    catalogType: CatalogStudioCatalogType;
    pageId: number;
    parentId: number;
    captionSave: string;
    caption: string;
    pageLayout: string;
    iconColor: number;
    iconImage: number;
    minRank: number;
    orderNum: number;
    visible: boolean;
    enabled: boolean;
    clubOnly: boolean;
    catalogMode: string;
    vipOnly: boolean;
    pageHeadline: string;
    pageTeaser: string;
    pageSpecial: string;
    pageText1: string;
    pageText2: string;
    pageTextDetails: string;
    pageTextTeaser: string;
    roomId: number;
    includes: string;
}

export interface CatalogStudioOfferSnapshot {
    catalogType: CatalogStudioCatalogType;
    offerId: number;
    itemIds: string;
    pageId: number;
    catalogName: string;
    costCredits: number;
    costPoints: number;
    pointsType: number;
    amount: number;
    limitedStack: number;
    orderNumber: number;
    offerIdClient: number;
    songId: number;
    extradata: string;
    haveOffer: boolean;
    clubOnly: boolean;
}

export interface CatalogStudioSession {
    activeVersionId: number;
    draftVersionId: number;
    revision: number;
    activeUpdatedAt: string;
    draftCreatedAt: string;
    pendingCount: number;
    actors: CatalogStudioActor[];
    validationCurrent: boolean;
    validationIssueCount: number;
    publishedVersions: CatalogStudioPublishedVersion[];
    pages: CatalogStudioPageSnapshot[];
    offers: CatalogStudioOfferSnapshot[];
}

export interface CatalogStudioLock {
    draftVersionId: number;
    entityType: string;
    catalogType: CatalogStudioCatalogType;
    entityId: number;
    ownerId: number;
    ownerName: string;
    token: string;
    expiresAt: string;
}

export interface CatalogStudioHistoryEntry {
    entityType: string;
    entityId: number;
    operation: string;
}

export interface CatalogStudioHistoryGroup {
    id: number;
    revision: number;
    actorId: number;
    actorName: string;
    summary: string;
    source: string;
    createdAt: string;
    entries: CatalogStudioHistoryEntry[];
}

export interface CatalogStudioValidationIssue {
    code: string;
    entityType: string;
    entityId: number;
    field: string;
    message: string;
}

export interface CatalogStudioValidationState {
    operationId: string;
    success: boolean;
    code: string;
    message: string;
    revision: number;
    current: boolean;
    issues: CatalogStudioValidationIssue[];
}

export interface CatalogStudioPreviewOffer {
    offer: CatalogStudioOfferSnapshot;
    eligible: boolean;
    reasons: string[];
}

export interface CatalogStudioPreviewState {
    revision: number;
    pages: CatalogStudioPageSnapshot[];
    offers: CatalogStudioPreviewOffer[];
}

export interface CatalogStudioDocumentResult {
    operationId: string;
    success: boolean;
    code: string;
    message: string;
    revision: number;
    format: string;
    document: string;
    fingerprint: string;
    changedEntities: number;
}
