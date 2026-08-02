import {
    CatalogAdminCreateOfferComposer,
    CatalogAdminCreatePageComposer,
    CatalogAdminDeleteOfferComposer,
    CatalogAdminDeletePageComposer,
    CatalogAdminLoadOfferComposer,
    CatalogAdminLoadPageComposer,
    CatalogAdminMovePageComposer,
    CatalogAdminOfferDetailsEvent,
    CatalogAdminPageDetailsEvent,
    CatalogAdminReorderOffersComposer,
    CatalogAdminResultEvent,
    CatalogAdminSaveOfferComposer,
    CatalogAdminSavePageComposer,
    CatalogAdminSetPageEnabledComposer,
    CatalogAdminSetPageVisibleComposer
} from '@nitrots/nitro-renderer';
import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ICatalogNode, IPurchasableOffer, NotificationAlertType, SendMessageComposer } from '../../api';
import { useCatalogUiState, useMessageEvent, useNotification } from '../../hooks';
import { useCatalogStudio } from './admin/studio/useCatalogStudio';
import { createCatalogAdminPageDetailsFromSnapshot } from './views/admin/CatalogAdminPageState';

const toStudioCatalogType = (catalogType: string): 'NORMAL' | 'BUILDER' =>
    catalogType === 'BUILDERS_CLUB' || catalogType === 'BUILDER' ? 'BUILDER' : 'NORMAL';

const studioLockKey = (entityType: 'PAGE' | 'OFFER', entityId: number, catalogType: string) => {
    const type = toStudioCatalogType(catalogType);
    return type === 'NORMAL' ? `${entityType}:${entityId}` : `${type}:${entityType}:${entityId}`;
};

export interface IPageEditData {
    pageId?: number;
    caption: string;
    captionSave: string;
    parentId: number;
    catalogMode: string;
    pageLayout: string;
    iconColor: number;
    iconImage: number;
    enabled: string;
    visible: string;
    minRank: number;
    clubOnly?: string;
    vipOnly?: string;
    orderNum: number;
    pageHeadline?: string;
    pageTeaser?: string;
    pageSpecial?: string;
    pageText1?: string;
    pageText2?: string;
    pageTextDetails?: string;
    pageTextTeaser?: string;
    roomId?: number;
    includes?: string;
}

export interface IOfferEditData {
    offerId?: number;
    pageId: number;
    itemIds: string;
    catalogName: string;
    costCredits: number;
    costPoints: number;
    pointsType: number;
    amount: number;
    clubOnly: string;
    extradata: string;
    haveOffer: string;
    offerId_group: number;
    limitedStack: number;
    orderNumber: number;
}

export interface IEditingOfferDetails {
    offerId: number;
    pageId: number;
    itemIds: string;
    catalogName: string;
    costCredits: number;
    costPoints: number;
    pointsType: number;
    amount: number;
    clubOnly: boolean;
    extradata: string;
    haveOffer: boolean;
    offerIdGroup: number;
    limitedStack: number;
    limitedSells: number;
    orderNumber: number;
    catalogMode: string;
}

export interface IEditingPageDetails {
    pageId: number;
    caption: string;
    captionSave: string;
    parentId: number;
    catalogMode: string;
    layout: string;
    iconColor: number;
    iconImage: number;
    minRank: number;
    orderNum: number;
    visible: boolean;
    enabled: boolean;
    clubOnly: boolean;
    vipOnly: boolean;
    headline: string;
    teaser: string;
    special: string;
    textOne: string;
    textTwo: string;
    textDetails: string;
    textTeaser: string;
    roomId: number;
    includes: string;
}

interface ICatalogAdminContext {
    adminMode: boolean;
    setAdminMode: (value: boolean) => void;
    editingOffer: IPurchasableOffer | null;
    setEditingOffer: (offer: IPurchasableOffer | null) => void;
    editingOfferDetails: IEditingOfferDetails | null;
    editingPageDetails: IEditingPageDetails | null;
    requestPageDetails: (pageId: number) => void;
    editingPageData: boolean;
    setEditingPageData: (value: boolean) => void;
    editingRootPage: boolean;
    setEditingRootPage: (value: boolean) => void;
    editingPageNode: ICatalogNode | null;
    setEditingPageNode: (node: ICatalogNode | null) => void;
    creatingPage: boolean;
    setCreatingPage: (value: boolean) => void;
    loading: boolean;
    lastError: string | null;
    studioSessionReady: boolean;
    ensurePageLock: (pageId: number) => void;
    hasPageLock: (pageId: number) => boolean;
    savePage: (data: IPageEditData) => void;
    createPage: (data: IPageEditData) => void;
    deletePage: (pageId: number, summary?: string) => void;
    saveOffer: (data: IOfferEditData) => void;
    createOffer: (data: IOfferEditData) => void;
    deleteOffer: (offerId: number, summary?: string) => void;
    reorderOffers: (orders: { id: number; orderNumber: number }[], summary?: string, pageId?: number) => void;
    reorderPage: (pageId: number, newParentId: number, newIndex: number, summary?: string) => void;
    togglePageEnabled: (pageId: number, enabled: boolean, summary?: string) => void;
    togglePageVisible: (pageId: number, visible: boolean, summary?: string) => void;
    publishCatalog: () => void;
}

const CatalogAdminContext = createContext<ICatalogAdminContext>(null);

export const useCatalogAdmin = () => useContext(CatalogAdminContext);

export const CATALOG_ROOT_LOCK_ID = 2147483647;

const PAGE_INDEX_REFRESH_ACTIONS = new Set(['savePage', 'createPage', 'deletePage', 'movePage', 'toggleVisible', 'toggleEnabled']);
const OFFER_REFRESH_ACTIONS = new Set(['saveOffer', 'createOffer', 'deleteOffer', 'reorder']);

export const CatalogAdminProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { currentType } = useCatalogUiState();
    const studio = useCatalogStudio();
    const [adminMode, setAdminMode] = useState(false);
    const [editingOffer, setEditingOfferState] = useState<IPurchasableOffer | null>(null);
    const [editingOfferDetails, setEditingOfferDetails] = useState<IEditingOfferDetails | null>(null);
    const [editingPageDetails, setEditingPageDetails] = useState<IEditingPageDetails | null>(null);
    const [editingPageData, setEditingPageData] = useState(false);
    const [editingRootPage, setEditingRootPage] = useState(false);
    const [editingPageNode, setEditingPageNode] = useState<ICatalogNode | null>(null);
    const [creatingPage, setCreatingPage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const queuedOfferDeleteRef = useRef<{ offerId: number; summary: string } | null>(null);
    const pendingActionRef = useRef<string | null>(null);
    const { simpleAlert = null } = useNotification();

    const beginAdminAction = useCallback((action: string, _summary: string) => {
        if (pendingActionRef.current) return false;

        setLoading(true);
        setLastError(null);
        pendingActionRef.current = action;
        return true;
    }, []);

    const setEditingOffer = useCallback(
        (offer: IPurchasableOffer | null) => {
            setEditingOfferState(offer);
            setEditingOfferDetails(null);

            if (offer && offer.offerId !== -1) {
                if (!studio.session) {
                    setLastError('Catalog Studio session is not ready');
                    return;
                }
                SendMessageComposer(new CatalogAdminLoadOfferComposer(
                    offer.offerId,
                    currentType,
                    studio.session.draftVersionId,
                    studio.revision
                ));
            }
        },
        [currentType, studio.session, studio.revision]
    );

    useMessageEvent(CatalogAdminOfferDetailsEvent, (event: CatalogAdminOfferDetailsEvent) => {
        const parser = event.getParser();

        setEditingOfferDetails({
            offerId: parser.offerId,
            pageId: parser.pageId,
            itemIds: parser.itemIds,
            catalogName: parser.catalogName,
            costCredits: parser.costCredits,
            costPoints: parser.costPoints,
            pointsType: parser.pointsType,
            amount: parser.amount,
            clubOnly: parser.clubOnly,
            extradata: parser.extradata,
            haveOffer: parser.haveOffer,
            offerIdGroup: parser.offerIdGroup,
            limitedStack: parser.limitedStack,
            limitedSells: parser.limitedSells,
            orderNumber: parser.orderNumber,
            catalogMode: parser.catalogMode
        });
    });

    useMessageEvent(CatalogAdminPageDetailsEvent, (event: CatalogAdminPageDetailsEvent) => {
        const parser = event.getParser();

        setEditingPageDetails({
            pageId: parser.pageId,
            caption: parser.caption,
            captionSave: parser.captionSave,
            parentId: parser.parentId,
            catalogMode: parser.catalogMode,
            layout: parser.layout,
            iconColor: parser.iconColor,
            iconImage: parser.iconImage,
            minRank: parser.minRank,
            orderNum: parser.orderNum,
            visible: parser.visible,
            enabled: parser.enabled,
            clubOnly: parser.clubOnly,
            vipOnly: parser.vipOnly,
            headline: parser.headline,
            teaser: parser.teaser,
            special: parser.special,
            textOne: parser.textOne,
            textTwo: parser.textTwo,
            textDetails: parser.textDetails,
            textTeaser: parser.textTeaser,
            roomId: parser.roomId,
            includes: parser.includes
        });
    });

    const requestPageDetails = useCallback(
        (pageId: number) => {
            setEditingPageDetails(null);
            if (pageId == null || pageId < 0) return;
            if (!studio.session) {
                setLastError('Catalog Studio session is not ready');
                return;
            }

            const catalogType = toStudioCatalogType(currentType);
            const snapshot = studio.session.pages.find((page) =>
                page.pageId === pageId && page.catalogType === catalogType);
            if (snapshot) setEditingPageDetails(createCatalogAdminPageDetailsFromSnapshot(snapshot));

            setLastError(null);
            SendMessageComposer(new CatalogAdminLoadPageComposer(
                pageId,
                currentType,
                studio.session.draftVersionId,
                studio.revision
            ));
        },
        [currentType, studio.session, studio.revision]
    );

    const ensurePageLock = useCallback(
        (pageId: number) => {
            if (pageId == null || pageId < 0) return;

            const key = studioLockKey('PAGE', pageId, currentType);
            if (studio.locks[key]) {
                setLastError(null);
                return;
            }
            if (!studio.session) {
                setLastError('Catalog Studio session is not ready');
                studio.refresh();
                return;
            }

            setLastError(null);
            studio.acquireLock('PAGE', pageId, toStudioCatalogType(currentType));
        },
        [currentType, studio.acquireLock, studio.locks, studio.refresh, studio.session]
    );

    const hasPageLock = useCallback(
        (pageId: number) => !!studio.locks[studioLockKey('PAGE', pageId, currentType)],
        [currentType, studio.locks]
    );

    useEffect(() => {
        if (!adminMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editingOffer) {
                    setEditingOffer(null);
                    e.preventDefault();
                    return;
                }
                if (editingPageData || editingRootPage || editingPageNode) {
                    setEditingPageData(false);
                    setEditingRootPage(false);
                    setEditingPageNode(null);
                    setCreatingPage(false);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [adminMode, editingOffer, editingPageData, editingRootPage, editingPageNode]);

    useMessageEvent(CatalogAdminResultEvent, (event: CatalogAdminResultEvent) => {
        const parser = event.getParser();
        const action = pendingActionRef.current;

        pendingActionRef.current = null;
        setLoading(false);

        if (!parser.success) {
            setLastError(parser.message || 'Operation failed');

            if (simpleAlert) {
                simpleAlert(parser.message || 'Operation failed', NotificationAlertType.ALERT, null, null, 'Admin Error');
            }
        } else {
            setLastError(null);
            setEditingOffer(null);
            setEditingPageData(false);
            setEditingRootPage(false);
            setEditingPageNode(null);
            setCreatingPage(false);

            studio.refresh();
            studio.loadHistory();

            if (action && PAGE_INDEX_REFRESH_ACTIONS.has(action)) {
                window.dispatchEvent(new Event('catalog-admin-refresh-index'));
            }

            if (action && OFFER_REFRESH_ACTIONS.has(action)) {
                window.dispatchEvent(new Event('catalog-admin-refresh-current-page'));
            }
        }
    });

    const savePage = useCallback(
        (data: IPageEditData) => {
            const summary = `Updated page: ${data.caption || `#${data.pageId}`}`;
            const lock = studio.locks[studioLockKey('PAGE', data.pageId || 0, currentType)];
            if (!studio.session || !lock) {
                setLastError('Open the page inspector and acquire its edit lock before saving');
                return;
            }
            if (!beginAdminAction('savePage', summary)) return;

            SendMessageComposer(
                new CatalogAdminSavePageComposer(
                    data.pageId || 0,
                    data.caption,
                    data.captionSave,
                    data.pageLayout,
                    data.iconImage,
                    data.minRank,
                    data.visible === '1',
                    data.enabled === '1',
                    data.orderNum,
                    data.parentId,
                    data.pageHeadline || '',
                    data.pageTeaser || '',
                    data.pageTextDetails || '',
                    currentType,
                    data.catalogMode,
                    data.pageText1 || '',
                    data.iconColor,
                    data.clubOnly === '1',
                    data.vipOnly === '1',
                    data.pageSpecial || '',
                    data.pageText2 || '',
                    data.pageTextTeaser || '',
                    data.roomId || 0,
                    data.includes || '',
                    studio.session.draftVersionId,
                    studio.revision,
                    lock.token,
                    summary
                )
            );
        },
        [currentType, beginAdminAction, studio]
    );

    const createPage = useCallback(
        (data: IPageEditData) => {
            const summary = `Created page: ${data.caption || 'New page'}`;
            const lockId = data.parentId <= 0 ? CATALOG_ROOT_LOCK_ID : data.parentId;
            const lock = studio.locks[studioLockKey('PAGE', lockId, currentType)];
            if (!studio.session || !lock) {
                setLastError(data.parentId <= 0
                    ? 'Wait for the catalog root lock before creating a root category'
                    : 'Open the parent page inspector and acquire its edit lock before creating a sub-page');
                return;
            }
            if (!beginAdminAction('createPage', summary)) return;
            SendMessageComposer(
                new CatalogAdminCreatePageComposer(
                    data.caption,
                    data.captionSave,
                    data.pageLayout,
                    data.iconImage,
                    data.minRank,
                    data.visible === '1',
                    data.enabled === '1',
                    data.orderNum,
                    data.parentId,
                    currentType,
                    data.catalogMode,
                    data.iconColor,
                    data.clubOnly === '1',
                    data.vipOnly === '1',
                    data.pageHeadline || '',
                    data.pageTeaser || '',
                    data.pageSpecial || '',
                    data.pageText1 || '',
                    data.pageText2 || '',
                    data.pageTextDetails || '',
                    data.pageTextTeaser || '',
                    data.roomId || 0,
                    data.includes || '',
                    studio.session.draftVersionId,
                    studio.revision,
                    lock.token,
                    summary
                )
            );
        },
        [currentType, beginAdminAction, studio]
    );

    const deletePage = useCallback(
        (pageId: number, summary?: string) => {
            const effectiveSummary = summary || `Deleted page #${pageId}`;
            const lock = studio.locks[studioLockKey('PAGE', pageId, currentType)];
            if (!studio.session || !lock) {
                setLastError('Select the page and wait for its edit lock before deleting it');
                return;
            }
            if (!beginAdminAction('deletePage', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminDeletePageComposer(
                pageId, currentType, studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    const saveOffer = useCallback(
        (data: IOfferEditData) => {
            const summary = `Updated offer: ${data.catalogName || `#${data.offerId}`}`;
            const lock = studio.locks[studioLockKey('OFFER', data.offerId || 0, currentType)];
            if (!studio.session || !lock) {
                setLastError('Open the offer inspector and acquire its edit lock before saving');
                return;
            }
            if (!beginAdminAction('saveOffer', summary)) return;
            SendMessageComposer(
                new CatalogAdminSaveOfferComposer(
                    data.offerId || 0,
                    data.pageId,
                    data.itemIds || '',
                    data.catalogName,
                    data.costCredits,
                    data.costPoints,
                    data.pointsType,
                    data.amount,
                    data.clubOnly === '1' ? 1 : 0,
                    data.extradata,
                    data.haveOffer === '1',
                    data.offerId_group,
                    data.limitedStack,
                    data.orderNumber,
                    currentType,
                    studio.session.draftVersionId,
                    studio.revision,
                    lock.token,
                    summary
                )
            );
        },
        [currentType, beginAdminAction, studio]
    );

    const createOffer = useCallback(
        (data: IOfferEditData) => {
            const summary = `Created offer: ${data.catalogName || 'New offer'}`;
            const lock = studio.locks[studioLockKey('PAGE', data.pageId, currentType)];
            if (!studio.session || !lock) {
                setLastError('Open the target page and acquire its edit lock before creating an offer');
                return;
            }
            if (!beginAdminAction('createOffer', summary)) return;
            SendMessageComposer(
                new CatalogAdminCreateOfferComposer(
                    data.pageId,
                    data.itemIds || '',
                    data.catalogName,
                    data.costCredits,
                    data.costPoints,
                    data.pointsType,
                    data.amount,
                    data.clubOnly === '1' ? 1 : 0,
                    data.extradata,
                    data.haveOffer === '1',
                    data.offerId_group,
                    data.limitedStack,
                    data.orderNumber,
                    currentType,
                    studio.session.draftVersionId,
                    studio.revision,
                    lock.token,
                    summary
                )
            );
        },
        [currentType, beginAdminAction, studio]
    );

    const deleteOffer = useCallback(
        (offerId: number, summary?: string) => {
            const effectiveSummary = summary || `Deleted offer #${offerId}`;
            const lock = studio.locks[studioLockKey('OFFER', offerId, currentType)];
            if (!studio.session) {
                setLastError('Catalog Studio session is not ready');
                return;
            }
            if (!lock) {
                queuedOfferDeleteRef.current = { offerId, summary: effectiveSummary };
                studio.acquireLock('OFFER', offerId, toStudioCatalogType(currentType));
                return;
            }
            if (!beginAdminAction('deleteOffer', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminDeleteOfferComposer(
                offerId, currentType, studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    useEffect(() => {
        const queued = queuedOfferDeleteRef.current;
        if (!queued || !studio.locks[studioLockKey('OFFER', queued.offerId, currentType)]) return;
        queuedOfferDeleteRef.current = null;
        deleteOffer(queued.offerId, queued.summary);
    }, [currentType, deleteOffer, studio.locks]);

    const reorderOffers = useCallback(
        (orders: { id: number; orderNumber: number }[], summary?: string, pageId?: number) => {
            if (!orders.length) return;
            const effectivePageId = pageId || 0;
            const lock = studio.locks[studioLockKey('PAGE', effectivePageId, currentType)];
            const effectiveSummary = summary || 'Reordered offers';
            if (!studio.session || !lock) {
                setLastError('Select the page and wait for its edit lock before reordering offers');
                return;
            }
            if (!beginAdminAction('reorder', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminReorderOffersComposer(
                orders, currentType, studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    const reorderPage = useCallback(
        (pageId: number, newParentId: number, newIndex: number, summary?: string) => {
            const effectiveSummary = summary || `Moved page #${pageId}`;
            const lock = studio.locks[studioLockKey('PAGE', pageId, currentType)];
            if (!studio.session || !lock) {
                setLastError('Select the page and wait for its edit lock before moving it');
                return;
            }
            if (!beginAdminAction('movePage', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminMovePageComposer(
                pageId, newParentId, newIndex, currentType,
                studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    const togglePageEnabled = useCallback(
        (pageId: number, enabled: boolean, summary?: string) => {
            const effectiveSummary = summary || `Toggled enabled state for page #${pageId}`;
            const lock = studio.locks[studioLockKey('PAGE', pageId, currentType)];
            if (!studio.session || !lock) {
                setLastError('Select the page and wait for its edit lock before changing it');
                return;
            }
            if (!beginAdminAction('toggleEnabled', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminSetPageEnabledComposer(
                pageId, enabled, currentType, studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    const togglePageVisible = useCallback(
        (pageId: number, visible: boolean, summary?: string) => {
            const effectiveSummary = summary || `Toggled visibility for page #${pageId}`;
            const lock = studio.locks[studioLockKey('PAGE', pageId, currentType)];
            if (!studio.session || !lock) {
                setLastError('Select the page and wait for its edit lock before changing it');
                return;
            }
            if (!beginAdminAction('toggleVisible', effectiveSummary)) return;
            SendMessageComposer(new CatalogAdminSetPageVisibleComposer(
                pageId, visible, currentType, studio.session.draftVersionId, studio.revision, lock.token, effectiveSummary));
        },
        [currentType, beginAdminAction, studio]
    );

    const publishCatalog = useCallback(() => studio.publish(), [studio]);

    return (
        <CatalogAdminContext
            value={{
                adminMode,
                setAdminMode,
                editingOffer,
                setEditingOffer,
                editingOfferDetails,
                editingPageDetails,
                requestPageDetails,
                editingPageData,
                setEditingPageData,
                editingRootPage,
                setEditingRootPage,
                editingPageNode,
                setEditingPageNode,
                creatingPage,
                setCreatingPage,
                loading,
                lastError: lastError || studio.lastError,
                studioSessionReady: !!studio.session,
                ensurePageLock,
                hasPageLock,
                savePage,
                createPage,
                deletePage,
                saveOffer,
                createOffer,
                deleteOffer,
                reorderOffers,
                reorderPage,
                togglePageEnabled,
                togglePageVisible,
                publishCatalog
            }}
        >
            {children}
        </CatalogAdminContext>
    );
};
