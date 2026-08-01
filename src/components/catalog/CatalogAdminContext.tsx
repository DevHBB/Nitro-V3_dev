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
    CatalogAdminPublishComposer,
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

export interface ICatalogAdminPendingChange {
    id: string;
    summary: string;
    at: number;
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
    savePage: (data: IPageEditData) => void;
    createPage: (data: IPageEditData) => void;
    deletePage: (pageId: number, summary?: string) => void;
    saveOffer: (data: IOfferEditData) => void;
    createOffer: (data: IOfferEditData) => void;
    deleteOffer: (offerId: number, summary?: string) => void;
    reorderOffers: (orders: { id: number; orderNumber: number }[], summary?: string) => void;
    reorderPage: (pageId: number, newParentId: number, newIndex: number, summary?: string) => void;
    togglePageEnabled: (pageId: number, enabled: boolean, summary?: string) => void;
    togglePageVisible: (pageId: number, visible: boolean, summary?: string) => void;
    publishCatalog: () => void;
    hasPendingChanges: boolean;
    pendingChanges: ICatalogAdminPendingChange[];
}

const CatalogAdminContext = createContext<ICatalogAdminContext>(null);

export const useCatalogAdmin = () => useContext(CatalogAdminContext);

let pendingChangeCounter = 0;

const PAGE_INDEX_REFRESH_ACTIONS = new Set(['savePage', 'createPage', 'deletePage', 'movePage', 'toggleVisible', 'toggleEnabled']);
const OFFER_REFRESH_ACTIONS = new Set(['saveOffer', 'createOffer', 'deleteOffer', 'reorder']);

export const CatalogAdminProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { currentType } = useCatalogUiState();
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
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<ICatalogAdminPendingChange[]>([]);
    const pendingActionRef = useRef<string | null>(null);
    const pendingChangeLabelRef = useRef<string | null>(null);
    const pendingChangeRecordedForBatchRef = useRef(false);
    const { simpleAlert = null } = useNotification();

    const beginAdminAction = useCallback((action: string, summary: string) => {
        if (pendingActionRef.current) return false;

        setLoading(true);
        setLastError(null);
        pendingActionRef.current = action;
        pendingChangeLabelRef.current = summary;

        if (action === 'reorder') pendingChangeRecordedForBatchRef.current = false;
        return true;
    }, []);

    const recordPendingChange = useCallback((action: string | null, summary: string | null) => {
        if (!action || action === 'publish' || !summary?.length) return;

        if (action === 'reorder') {
            if (pendingChangeRecordedForBatchRef.current) return;
            pendingChangeRecordedForBatchRef.current = true;
        }

        pendingChangeCounter += 1;

        setPendingChanges((prev) => [
            ...prev,
            {
                id: `pending-${pendingChangeCounter}`,
                summary,
                at: Date.now()
            }
        ]);
        setHasPendingChanges(true);
    }, []);

    const setEditingOffer = useCallback(
        (offer: IPurchasableOffer | null) => {
            setEditingOfferState(offer);
            setEditingOfferDetails(null);

            if (offer && offer.offerId !== -1) {
                SendMessageComposer(new CatalogAdminLoadOfferComposer(offer.offerId, currentType));
            }
        },
        [currentType]
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
            SendMessageComposer(new CatalogAdminLoadPageComposer(pageId, currentType));
        },
        [currentType]
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
        const summary = pendingChangeLabelRef.current;

        pendingActionRef.current = null;
        pendingChangeLabelRef.current = null;
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

            if (action === 'publish') {
                setHasPendingChanges(false);
                setPendingChanges([]);
            } else {
                recordPendingChange(action, summary);

                if (PAGE_INDEX_REFRESH_ACTIONS.has(action)) {
                    window.dispatchEvent(new Event('catalog-admin-refresh-index'));
                }

                if (OFFER_REFRESH_ACTIONS.has(action)) {
                    window.dispatchEvent(new Event('catalog-admin-refresh-current-page'));
                }
            }
        }
    });

    const savePage = useCallback(
        (data: IPageEditData) => {
            if (!beginAdminAction('savePage', `Updated page: ${data.caption || `#${data.pageId}`}`)) return;

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
                    data.includes || ''
                )
            );
        },
        [currentType, beginAdminAction]
    );

    const createPage = useCallback(
        (data: IPageEditData) => {
            if (!beginAdminAction('createPage', `Created page: ${data.caption || 'New page'}`)) return;
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
                    data.includes || ''
                )
            );
        },
        [currentType, beginAdminAction]
    );

    const deletePage = useCallback(
        (pageId: number, summary?: string) => {
            if (!beginAdminAction('deletePage', summary || `Deleted page #${pageId}`)) return;
            SendMessageComposer(new CatalogAdminDeletePageComposer(pageId, currentType));
        },
        [currentType, beginAdminAction]
    );

    const saveOffer = useCallback(
        (data: IOfferEditData) => {
            if (!beginAdminAction('saveOffer', `Updated offer: ${data.catalogName || `#${data.offerId}`}`)) return;
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
                    currentType
                )
            );
        },
        [currentType, beginAdminAction]
    );

    const createOffer = useCallback(
        (data: IOfferEditData) => {
            if (!beginAdminAction('createOffer', `Created offer: ${data.catalogName || 'New offer'}`)) return;
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
                    currentType
                )
            );
        },
        [currentType, beginAdminAction]
    );

    const deleteOffer = useCallback(
        (offerId: number, summary?: string) => {
            if (!beginAdminAction('deleteOffer', summary || `Deleted offer #${offerId}`)) return;
            SendMessageComposer(new CatalogAdminDeleteOfferComposer(offerId, currentType));
        },
        [currentType, beginAdminAction]
    );

    const reorderOffers = useCallback(
        (orders: { id: number; orderNumber: number }[], summary?: string) => {
            if (!orders.length) return;

            if (!beginAdminAction('reorder', summary || 'Reordered offers')) return;
            SendMessageComposer(new CatalogAdminReorderOffersComposer(orders, currentType));
        },
        [currentType, beginAdminAction]
    );

    const reorderPage = useCallback(
        (pageId: number, newParentId: number, newIndex: number, summary?: string) => {
            if (!beginAdminAction('movePage', summary || `Moved page #${pageId}`)) return;
            SendMessageComposer(new CatalogAdminMovePageComposer(pageId, newParentId, newIndex, currentType));
        },
        [currentType, beginAdminAction]
    );

    const togglePageEnabled = useCallback(
        (pageId: number, enabled: boolean, summary?: string) => {
            if (!beginAdminAction('toggleEnabled', summary || `Toggled enabled state for page #${pageId}`)) return;
            SendMessageComposer(new CatalogAdminSetPageEnabledComposer(pageId, enabled, currentType));
        },
        [currentType, beginAdminAction]
    );

    const togglePageVisible = useCallback(
        (pageId: number, visible: boolean, summary?: string) => {
            if (!beginAdminAction('toggleVisible', summary || `Toggled visibility for page #${pageId}`)) return;
            SendMessageComposer(new CatalogAdminSetPageVisibleComposer(pageId, visible, currentType));
        },
        [currentType, beginAdminAction]
    );

    const publishCatalog = useCallback(() => {
        if (!beginAdminAction('publish', 'Published catalog')) return;
        SendMessageComposer(new CatalogAdminPublishComposer());
    }, [beginAdminAction]);

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
                lastError,
                hasPendingChanges,
                pendingChanges,
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
