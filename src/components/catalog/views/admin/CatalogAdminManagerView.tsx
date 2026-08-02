import { FC, useCallback, useEffect, useState } from 'react';
import {
    FaArrowDown,
    FaArrowsAlt,
    FaArrowUp,
    FaChevronDown,
    FaChevronRight,
    FaCheckCircle,
    FaClock,
    FaCloudUploadAlt,
    FaEdit,
    FaExclamationTriangle,
    FaEye,
    FaEyeSlash,
    FaHistory,
    FaLock,
    FaPlus,
    FaSearch,
    FaSitemap,
    FaTrash,
    FaUsers
} from 'react-icons/fa';
import { GetConfigurationValue, ICatalogNode, IPurchasableOffer, LocalizeText, ProductTypeEnum } from '../../../../api';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../../../common';
import { useCatalogActions, useCatalogData, useCatalogUiState } from '../../../../hooks';
import { replaceCatalogPageOffers } from '../../../../hooks/catalog/useCatalog.helpers';
import { CATALOG_ROOT_LOCK_ID, useCatalogAdmin } from '../../CatalogAdminContext';
import { getCatalogStudioCommandState, getCatalogStudioPageLockKey } from '../../admin/studio/CatalogStudioCommandCenter';
import { CatalogStudioBulkPanel } from '../../admin/studio/CatalogStudioBulkPanel';
import { CatalogStudioImportExportPanel } from '../../admin/studio/CatalogStudioImportExportPanel';
import { CatalogStudioPreview } from '../../admin/studio/CatalogStudioPreview';
import { useCatalogStudio } from '../../admin/studio/useCatalogStudio';
import { parseCatalogTabLabel } from '../../useCatalogWindowWidth';
import { CatalogIconView } from '../catalog-icon/CatalogIconView';
import { CatalogAdminOfferPriceView } from './CatalogAdminOfferPriceView';

type CatalogAdminOffer = Parameters<NonNullable<ReturnType<typeof useCatalogAdmin>>['setEditingOffer']>[0];
type ManagerTab = 'pages' | 'preview' | 'bulk' | 'transfer' | 'activity' | 'publish';

const stripSwfSuffix = (label: string) => (label || '').replace(/\s*\(\D[^)]*\)\s*$/g, '').trim();
const nodeName = (node: ICatalogNode) => stripSwfSuffix(parseCatalogTabLabel(node.localization).name) || node.pageName;

const findNodeByPageId = (node: ICatalogNode | null, pageId: number): ICatalogNode | null => {
    if (!node) return null;
    if (node.pageId === pageId) return node;

    for (const child of node.children) {
        const found = findNodeByPageId(child, pageId);
        if (found) return found;
    }

    return null;
};

const subtreeMatches = (node: ICatalogNode, query: string): boolean => {
    if (!query) return true;
    if (nodeName(node).toLowerCase().includes(query)) return true;

    return node.children.some((child) => subtreeMatches(child, query));
};

const getOfferIconUrl = (offer: IPurchasableOffer): string | null => {
    const product = offer.product;
    if (!product) return null;

    if (product.productType === ProductTypeEnum.FLOOR || product.productType === ProductTypeEnum.WALL) {
        const className = product.furnitureData?.className;

        if (className?.length) {
            let param = '';

            if (product.productType === ProductTypeEnum.WALL && product.extraParam?.length) {
                param = `_${product.extraParam}`;
            } else if (product.productType === ProductTypeEnum.FLOOR && product.furnitureData?.hasIndexedColor && product.furnitureData.colorIndex > 0) {
                param = `_${product.furnitureData.colorIndex}`;
            }

            const configuredIconUrl = GetConfigurationValue<string>('furni.asset.icon.url', '');
            if (configuredIconUrl?.length) return configuredIconUrl.replace('%libname%', className).replace('%param%', param);
        }
    }

    return product.getIconUrl(offer) ?? null;
};

export const CatalogAdminManagerView: FC<{}> = () => {
    const { rootNode = null, currentPage = null } = useCatalogData();
    const { setCurrentPage, currentType } = useCatalogUiState();
    const { activateNode = null } = useCatalogActions();
    const catalogAdmin = useCatalogAdmin();
    const studio = useCatalogStudio();
    const [activeTab, setActiveTab] = useState<ManagerTab>('pages');
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState('');
    const [dragOverPageId, setDragOverPageId] = useState<number | null>(null);
    const [dragOverOfferIndex, setDragOverOfferIndex] = useState<number | null>(null);

    const query = search.trim().toLowerCase();
    const selectedPageId = currentPage?.pageId ?? -1;
    const selectedNode = findNodeByPageId(rootNode, selectedPageId);
    const offers = currentPage?.offers ?? [];
    const categoryCount = rootNode?.children.length ?? 0;
    const validationCurrent = studio.validation
        ? studio.validation.current && studio.validation.revision === studio.revision
        : studio.session?.validationCurrent ?? false;
    const validationIssueCount = studio.validation?.issues.length ?? studio.session?.validationIssueCount ?? 0;
    const commandState = getCatalogStudioCommandState({
        sessionReady: !!studio.session,
        pendingCount: studio.pendingCount,
        actorCount: studio.session?.actors.length ?? 0,
        lockCount: Object.keys(studio.locks).length,
        validationCurrent,
        validationIssueCount,
        loading: studio.loading || !!catalogAdmin?.loading
    });

    useEffect(() => {
        if (activeTab !== 'activity' || !catalogAdmin?.adminMode || !studio.session) return;
        studio.loadHistory();
    }, [activeTab, catalogAdmin?.adminMode, studio.session?.draftVersionId, studio.loadHistory]);

    useEffect(() => {
        if (!catalogAdmin?.adminMode || !studio.session) return;
        studio.loadHistory();
    }, [catalogAdmin?.adminMode, studio.session?.draftVersionId, studio.loadHistory]);

    const handlePageDragStart = useCallback((event: React.DragEvent, node: ICatalogNode) => {
        event.stopPropagation();
        event.dataTransfer.setData('text/plain', JSON.stringify({ pageId: node.pageId, parentId: node.parent?.pageId ?? -1 }));
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const handlePageDragOver = useCallback((event: React.DragEvent, node: ICatalogNode) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDragOverPageId(node.pageId);
    }, []);

    const handlePageDragLeave = useCallback(() => {
        setDragOverPageId(null);
    }, []);

    const handlePageDrop = useCallback(
        (event: React.DragEvent, node: ICatalogNode) => {
            event.preventDefault();
            event.stopPropagation();
            setDragOverPageId(null);

            if (!catalogAdmin) return;

            try {
                const data = JSON.parse(event.dataTransfer.getData('text/plain'));

                if (!data.pageId || data.pageId === node.pageId) return;

                const targetParentId = node.isBranch ? node.pageId : (node.parent?.pageId ?? -1);
                const targetIndex = node.isBranch ? 0 : (node.parent?.children?.indexOf(node) ?? 0);

                catalogAdmin.reorderPage(data.pageId, targetParentId, targetIndex, `Moved page #${data.pageId} under ${nodeName(node)}`);
            } catch {
                // Invalid drag payload
            }
        },
        [catalogAdmin]
    );

    const reorderOffersToIndex = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (!catalogAdmin || !currentPage) return;
            if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= offers.length || toIndex >= offers.length) return;

            const reordered = [...offers];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            setCurrentPage(replaceCatalogPageOffers(currentPage, reordered));

            const pageLabel = selectedNode ? nodeName(selectedNode) : 'page';
            catalogAdmin.reorderOffers(
                reordered.map((offer, i) => ({ id: offer.offerId, orderNumber: i })),
                `Reordered offers on "${pageLabel}"`,
                currentPage.pageId
            );
        },
        [catalogAdmin, currentPage, offers, selectedNode, setCurrentPage]
    );

    const handleOfferDragStart = useCallback((event: React.DragEvent, index: number) => {
        event.stopPropagation();
        event.dataTransfer.setData('application/x-catalog-admin-offer', JSON.stringify({ index }));
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleOfferDragOver = useCallback((event: React.DragEvent, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDragOverOfferIndex(index);
    }, []);

    const handleOfferDragLeave = useCallback(() => {
        setDragOverOfferIndex(null);
    }, []);

    const handleOfferDrop = useCallback(
        (event: React.DragEvent, dropIndex: number) => {
            event.preventDefault();
            event.stopPropagation();
            setDragOverOfferIndex(null);

            try {
                const data = JSON.parse(event.dataTransfer.getData('application/x-catalog-admin-offer'));
                if (typeof data.index !== 'number') return;

                reorderOffersToIndex(data.index, dropIndex);
            } catch {
                // Invalid drag payload
            }
        },
        [reorderOffersToIndex]
    );

    if (!catalogAdmin?.adminMode) return null;

    const hasPendingChanges = studio.pendingCount > 0;

    const toggleExpand = (pageId: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(pageId) ? next.delete(pageId) : next.add(pageId);

            return next;
        });
    };

    const selectNode = (node: ICatalogNode) => {
        if (node.children.length) setExpanded((prev) => new Set(prev).add(node.pageId));
        if (node.pageId > -1) {
        if (selectedPageId > 0 && selectedPageId !== node.pageId) studio.releaseLock('PAGE', selectedPageId, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');
        studio.acquireLock('PAGE', node.pageId, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');
            activateNode?.(node);
        }
    };

    const editPage = (node: ICatalogNode | null, isRoot: boolean) => {
        if (node && node.pageId > 0) studio.acquireLock('PAGE', node.pageId, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');
        catalogAdmin.setCreatingPage(false);
        catalogAdmin.setEditingPageNode(isRoot ? null : node);
        catalogAdmin.setEditingRootPage(isRoot);
        catalogAdmin.setEditingPageData(true);
    };

    const createCategory = (parent: ICatalogNode) => {
        studio.acquireLock('PAGE', parent.pageId > 0 ? parent.pageId : CATALOG_ROOT_LOCK_ID, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');
        catalogAdmin.setCreatingPage(true);
        catalogAdmin.setEditingRootPage(false);
        catalogAdmin.setEditingPageNode(parent);
        catalogAdmin.setEditingPageData(true);
    };

    const deletePage = (node: ICatalogNode) => {
        if (confirm(LocalizeText('catalog.admin.delete.category.confirm', ['name'], [nodeName(node)]))) {
            catalogAdmin.deletePage(node.pageId, `Deleted page: ${nodeName(node)}`);
        }
    };

    const movePage = (node: ICatalogNode, direction: -1 | 1) => {
        const parent = node.parent;
        if (!parent) return;

        const siblings = parent.children;
        const index = siblings.indexOf(node);
        const target = index + direction;
        if (target < 0 || target >= siblings.length) return;

        catalogAdmin.reorderPage(node.pageId, parent.pageId, target, `Moved page: ${nodeName(node)}`);
    };

    const newOffer = () => {
        if (!currentPage) return;

        studio.acquireLock('PAGE', currentPage.pageId, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');

        catalogAdmin.setEditingOffer({
            offerId: -1,
            product: { productClassId: 0, productType: 'i', productCount: 1, extraParam: '' }
        } as CatalogAdminOffer);
    };

    const deleteOffer = (offer: IPurchasableOffer) => {
        const label = offer.localizationName || `#${offer.offerId}`;
        if (confirm(`Delete offer "${label}"?`)) catalogAdmin.deleteOffer(offer.offerId, `Deleted offer: ${label}`);
    };

    const moveOffer = (index: number, direction: -1 | 1) => {
        reorderOffersToIndex(index, index + direction);
    };

    const renderNode = (node: ICatalogNode, depth: number) => {
        if (!subtreeMatches(node, query)) return null;

        const isOpen = query ? true : expanded.has(node.pageId);
        const isSelected = node.pageId === selectedPageId && selectedPageId > -1;
        const isHidden = !node.isVisible;
        const hasChildren = node.children.length > 0;

        return (
            <div key={node.pageId} className="nitro-catalog-admin-tree-branch">
                <div
                    className={`nitro-catalog-admin-tree-row ${isSelected ? 'is-selected' : ''} ${isHidden ? 'is-hidden' : ''} ${dragOverPageId === node.pageId ? 'is-drag-over' : ''}`}
                    draggable
                    style={{ paddingLeft: `${4 + depth * 14}px` }}
                    onClick={() => selectNode(node)}
                    onDragLeave={handlePageDragLeave}
                    onDragOver={(event) => handlePageDragOver(event, node)}
                    onDragStart={(event) => handlePageDragStart(event, node)}
                    onDrop={(event) => handlePageDrop(event, node)}
                >
                    <FaArrowsAlt className="nitro-catalog-admin-tree-drag" title="Drag to reorder or reparent" />
                    <span className="nitro-catalog-admin-tree-caret">
                        {hasChildren ? (
                            <button
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggleExpand(node.pageId);
                                }}
                            >
                                {isOpen ? <FaChevronDown /> : <FaChevronRight />}
                            </button>
                        ) : (
                            <span className="nitro-catalog-admin-tree-caret-spacer" />
                        )}
                    </span>
                    <span className="nitro-catalog-admin-tree-icon">
                        {node.iconId > 0 ? <CatalogIconView icon={node.iconId} /> : <span className="nitro-catalog-admin-tree-icon-empty" />}
                    </span>
                    <span className="nitro-catalog-admin-tree-label">{nodeName(node)}</span>
                    <span className="nitro-catalog-admin-tree-count">{node.pageId}</span>
                </div>
                {isOpen && hasChildren && <div className="nitro-catalog-admin-tree-children">{node.children.map((child) => renderNode(child, depth + 1))}</div>}
            </div>
        );
    };

    const renderDetail = () => {
        if (!selectedNode) {
            return <div className="nitro-catalog-admin-placeholder">Select a page from the tree to edit</div>;
        }

        const siblings = selectedNode.parent?.children ?? [];
        const index = siblings.indexOf(selectedNode);
        const isHidden = !selectedNode.isVisible;

        return (
            <div className="nitro-catalog-admin-detail-inner">
                <div className="nitro-catalog-admin-detail-head">
                    <span className="nitro-catalog-admin-detail-icon">
                        {selectedNode.iconId > 0 ? <CatalogIconView icon={selectedNode.iconId} /> : <span className="nitro-catalog-admin-tree-icon-empty" />}
                    </span>
                    <div className="nitro-catalog-admin-detail-titles">
                        <span className="nitro-catalog-admin-detail-title">{nodeName(selectedNode)}</span>
                        <span className="nitro-catalog-admin-detail-sub">
                            Page ID {selectedNode.pageId} · {selectedNode.children.length} sub-page(s) · {offers.length} offer(s)
                        </span>
                    </div>
                </div>

                <div className="nitro-catalog-admin-detail-actions">
                    <button className="nitro-catalog-admin-btn is-primary" onClick={() => editPage(selectedNode, false)}>
                        <FaEdit /> <span>Edit page</span>
                    </button>
                    <button className="nitro-catalog-admin-btn" onClick={() => createCategory(selectedNode)}>
                        <FaPlus /> <span>Add sub-page</span>
                    </button>
                    <button
                        className="nitro-catalog-admin-btn"
                        onClick={() =>
                            catalogAdmin.togglePageVisible(selectedNode.pageId, isHidden, `${isHidden ? 'Showed' : 'Hidden'} page: ${nodeName(selectedNode)}`)
                        }
                    >
                        {isHidden ? <FaEye /> : <FaEyeSlash />} <span>{isHidden ? 'Show' : 'Hide'}</span>
                    </button>
                    <button className="nitro-catalog-admin-btn" disabled={index <= 0} onClick={() => movePage(selectedNode, -1)}>
                        <FaArrowUp /> <span>Move up</span>
                    </button>
                    <button className="nitro-catalog-admin-btn" disabled={index < 0 || index >= siblings.length - 1} onClick={() => movePage(selectedNode, 1)}>
                        <FaArrowDown /> <span>Move down</span>
                    </button>
                    <button className="nitro-catalog-admin-btn is-danger" onClick={() => deletePage(selectedNode)}>
                        <FaTrash /> <span>Delete</span>
                    </button>
                </div>

                <div className="nitro-catalog-admin-offers">
                    <div className="nitro-catalog-admin-offers-head">
                        <span className="nitro-catalog-admin-offers-title">Offers ({offers.length})</span>
                        <button className="nitro-catalog-admin-btn is-primary" disabled={!currentPage} onClick={newOffer}>
                            <FaPlus /> <span>New offer</span>
                        </button>
                    </div>
                    <div className="nitro-catalog-admin-offers-list">
                        {!currentPage && <div className="nitro-catalog-admin-placeholder is-small">Loading offers…</div>}
                        {currentPage && offers.length === 0 && <div className="nitro-catalog-admin-placeholder is-small">No offers on this page</div>}
                        {offers.map((offer, index) => {
                            const iconUrl = getOfferIconUrl(offer);

                            return (
                                <div
                                    key={offer.offerId}
                                    className={`nitro-catalog-admin-offer-row ${dragOverOfferIndex === index ? 'is-drag-over' : ''}`}
                                    draggable
                                    onDragLeave={handleOfferDragLeave}
                                    onDragOver={(event) => handleOfferDragOver(event, index)}
                                    onDragStart={(event) => handleOfferDragStart(event, index)}
                                    onDrop={(event) => handleOfferDrop(event, index)}
                                >
                                    <span className="nitro-catalog-admin-offer-drag" title="Drag to reorder">
                                        <FaArrowsAlt />
                                    </span>
                                    <div className="nitro-catalog-admin-manager-reorder">
                                        <button disabled={index === 0} title="Move up" onClick={() => moveOffer(index, -1)}>
                                            <FaArrowUp />
                                        </button>
                                        <button disabled={index === offers.length - 1} title="Move down" onClick={() => moveOffer(index, 1)}>
                                            <FaArrowDown />
                                        </button>
                                    </div>
                                    <span className="nitro-catalog-admin-offer-icon">
                                        {iconUrl ? (
                                            <img
                                                alt=""
                                                draggable={false}
                                                src={iconUrl}
                                                onError={(event) => {
                                                    const fallback = offer.product?.getIconUrl(offer);
                                                    if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                                                    else event.currentTarget.style.visibility = 'hidden';
                                                }}
                                            />
                                        ) : (
                                            <span className="nitro-catalog-admin-offer-icon-empty" />
                                        )}
                                    </span>
                                    <span className="nitro-catalog-admin-offer-name" title={offer.localizationName}>
                                        {offer.localizationName || `#${offer.offerId}`}
                                    </span>
                                    <CatalogAdminOfferPriceView
                                        credits={offer.priceInCredits}
                                        points={offer.priceInActivityPoints}
                                        pointsType={offer.activityPointType}
                                    />
                                    <div className="nitro-catalog-admin-manager-controls">
                                        <button title="Edit offer" onClick={() => {
        studio.acquireLock('OFFER', offer.offerId, currentType === 'BUILDERS_CLUB' || currentType === 'BUILDER' ? 'BUILDER' : 'NORMAL');
                                            catalogAdmin.setEditingOffer(offer);
                                        }}>
                                            <FaEdit />
                                        </button>
                                        <button className="danger" title="Delete offer" onClick={() => deleteOffer(offer)}>
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderInspector = () => {
        if (!selectedNode) {
            return <aside className="nitro-catalog-admin-inspector"><div className="nitro-catalog-admin-placeholder is-small">No page selected</div></aside>;
        }

        const lock = studio.locks[getCatalogStudioPageLockKey(selectedNode.pageId, currentType)];

        return (
            <aside className="nitro-catalog-admin-inspector">
                <div className="nitro-catalog-admin-inspector-head">
                    <strong>Inspector</strong>
                    <span>Page #{selectedNode.pageId}</span>
                </div>
                <dl className="nitro-catalog-admin-inspector-data">
                    <div><dt>Name</dt><dd title={nodeName(selectedNode)}>{nodeName(selectedNode)}</dd></div>
                    <div><dt>Sub-pages</dt><dd>{selectedNode.children.length}</dd></div>
                    <div><dt>Offers</dt><dd>{offers.length}</dd></div>
                    <div><dt>Visibility</dt><dd className={selectedNode.isVisible ? 'is-positive' : 'is-muted'}>{selectedNode.isVisible ? 'Visible' : 'Hidden'}</dd></div>
                    <div><dt>Revision</dt><dd>{studio.revision}</dd></div>
                </dl>
                <div className={`nitro-catalog-admin-lock-state ${lock ? 'is-owned' : ''}`}>
                    <FaLock />
                    <div>
                        <strong>{lock ? `Locked by ${lock.ownerName}` : 'Read-only until locked'}</strong>
                        <span>{lock ? `Lease expires ${formatChangeTime(lock.expiresAt)}` : 'Select or edit the page to acquire its lease.'}</span>
                    </div>
                </div>
                <div className="nitro-catalog-admin-inspector-actions">
                    <button className="nitro-catalog-admin-btn is-primary" onClick={() => editPage(selectedNode, false)}>
                        <FaEdit /> Edit
                    </button>
                    <button className="nitro-catalog-admin-btn" onClick={() => createCategory(selectedNode)}>
                        <FaPlus /> Sub-page
                    </button>
                    <button className="nitro-catalog-admin-btn" onClick={newOffer}>
                        <FaPlus /> Offer
                    </button>
                </div>
            </aside>
        );
    };

    const renderChangesDrawer = () => (
        <div className="nitro-catalog-admin-changes-drawer">
            <div className="nitro-catalog-admin-changes-title">
                <FaHistory />
                <div><strong>Draft changes</strong><span>{commandState.pendingLabel}</span></div>
            </div>
            <div className="nitro-catalog-admin-changes-feed">
                {studio.history.length === 0 && <span>No changes recorded.</span>}
                {studio.history.slice(0, 3).map((group) => (
                    <button key={group.id} title="Open activity" onClick={() => setActiveTab('activity')}>
                        <strong>{group.summary}</strong>
                        <span>r{group.revision} · {group.actorName || `#${group.actorId}`}</span>
                    </button>
                ))}
            </div>
            <button className="nitro-catalog-admin-btn is-small" onClick={() => setActiveTab('activity')}>Open history</button>
        </div>
    );

    const renderPagesTab = () => (
        <div className="nitro-catalog-admin-pages">
            <div className="nitro-catalog-admin-sidebar">
                <div className="nitro-catalog-admin-search-row">
                    <span className="nitro-catalog-admin-search">
                        <FaSearch />
                        <input placeholder="Search pages..." value={search} onChange={(event) => setSearch(event.target.value)} />
                    </span>
                    <button
                        className="nitro-catalog-admin-add"
                        disabled={!rootNode}
                        title="New root category"
                        onClick={() => rootNode && createCategory(rootNode)}
                    >
                        <FaPlus />
                    </button>
                </div>
                <div className="nitro-catalog-admin-tree">
                    {!rootNode || rootNode.children.length === 0 ? (
                        <div className="nitro-catalog-admin-placeholder is-small">No categories</div>
                    ) : (
                        rootNode.children.map((child) => renderNode(child, 0))
                    )}
                </div>
            </div>
            <div className="nitro-catalog-admin-detail">{renderDetail()}</div>
            {renderInspector()}
            {renderChangesDrawer()}
        </div>
    );

    const formatChangeTime = (at: number | string) => new Date(at).toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const renderActivityTab = () => (
        <div className="nitro-catalog-admin-activity">
            <div className="nitro-catalog-admin-section-head">
                <div>
                    <strong>Shared draft activity</strong>
                    <span>{studio.historyTotalCount} recorded change group(s)</span>
                </div>
                <button className="nitro-catalog-admin-btn" disabled={studio.loading} onClick={() => studio.loadHistory()}>
                    <FaHistory /> <span>Refresh</span>
                </button>
            </div>
            <div className="nitro-catalog-admin-history-list">
                {studio.history.length === 0 && (
                    <div className="nitro-catalog-admin-placeholder is-small">No draft activity has been recorded yet.</div>
                )}
                {studio.history.map((group) => (
                    <div key={group.id} className="nitro-catalog-admin-history-row">
                        <div className="nitro-catalog-admin-history-main">
                            <span className="nitro-catalog-admin-history-summary">{group.summary}</span>
                            <span className="nitro-catalog-admin-history-meta">
                                Revision {group.revision} · {group.actorName || `User #${group.actorId}`} · {group.source}
                            </span>
                        </div>
                        <div className="nitro-catalog-admin-history-side">
                            <span>{formatChangeTime(group.createdAt)}</span>
                            <button
                                className="nitro-catalog-admin-btn is-small"
                                disabled={studio.loading}
                                title="Undo this change group in the shared draft"
                                onClick={() => confirm(`Undo "${group.summary}"?`) && studio.undo(group.id)}
                            >
                                Undo
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderPublishTab = () => (
        <div className="nitro-catalog-admin-publish">
            <div className={`nitro-catalog-admin-publish-status is-${commandState.phase}`}>
                {commandState.phase === 'clean' && 'The published catalog and shared draft are aligned.'}
                {commandState.phase === 'draft' && 'The draft has unpublished changes and must be validated.'}
                {commandState.phase === 'blocked' && `${commandState.validationLabel} must be resolved before publication.`}
                {commandState.phase === 'ready' && 'The draft is validated and ready to publish.'}
                {commandState.phase === 'offline' && 'Catalog Studio session is not ready.'}
            </div>
            <p className="nitro-catalog-admin-publish-text">
                Publication validates the current revision, replaces the live catalog atomically and creates the next shared draft.
            </p>

            {studio.validation?.issues.length > 0 && (
                <div className="nitro-catalog-admin-validation-list">
                    <div className="nitro-catalog-admin-publish-changes-head">Validation issues</div>
                    {studio.validation.issues.map((issue, index) => (
                        <div key={`${issue.code}-${issue.entityType}-${issue.entityId}-${index}`} className="nitro-catalog-admin-validation-row">
                            <FaExclamationTriangle />
                            <div>
                                <strong>{issue.message}</strong>
                                <span>{issue.entityType} #{issue.entityId} · {issue.field} · {issue.code}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="nitro-catalog-admin-publish-actions">
                <button
                    className="nitro-catalog-admin-btn"
                    disabled={!commandState.canValidate}
                    onClick={() => studio.validate()}
                >
                    <FaCheckCircle /> <span>{studio.loading ? 'Working…' : 'Validate draft'}</span>
                </button>
                <button
                    className={`nitro-catalog-admin-btn is-publish ${commandState.canPublish ? 'has-pending' : ''}`}
                    disabled={!commandState.canPublish}
                    onClick={() => catalogAdmin.publishCatalog()}
                >
                    <FaCloudUploadAlt /> <span>{studio.loading ? 'Publishing…' : 'Publish catalog'}</span>
                </button>
            </div>

            {studio.session?.publishedVersions.length > 0 && (
                <div className="nitro-catalog-admin-versions">
                    <div className="nitro-catalog-admin-publish-changes-head">Published versions</div>
                    {studio.session.publishedVersions.map((version) => (
                        <div key={version.id} className="nitro-catalog-admin-version-row">
                            <div>
                                <strong>{version.label || `Version #${version.id}`}</strong>
                                <span>{formatChangeTime(version.publishedAt)}</span>
                            </div>
                            <button
                                className="nitro-catalog-admin-btn is-small"
                                disabled={studio.loading || version.id === studio.session?.activeVersionId}
                                onClick={() => confirm(`Restore version #${version.id} into the shared draft?`) && studio.restore(version.id)}
                            >
                                Restore to draft
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const tabs = [
        { id: 'pages' as ManagerTab, label: 'Pages', icon: <FaSitemap />, count: categoryCount },
        { id: 'preview' as ManagerTab, label: 'Preview', icon: <FaEye />, count: studio.preview?.pages.length ?? 0 },
        { id: 'bulk' as ManagerTab, label: 'Bulk', icon: <FaArrowsAlt />, count: 0 },
        { id: 'transfer' as ManagerTab, label: 'JSONC / SQL', icon: <FaEdit />, count: 0 },
        { id: 'activity' as ManagerTab, label: 'Activity', icon: <FaHistory />, count: studio.historyTotalCount },
        { id: 'publish' as ManagerTab, label: 'Publish', icon: <FaCloudUploadAlt />, count: studio.pendingCount }
    ];

    return (
        <NitroCardView classNames={['nitro-catalog-admin-manager']} uniqueKey="catalog-admin-manager">
            <NitroCardHeaderView headerText="Catalog Admin Editor" onCloseClick={() => catalogAdmin.setAdminMode(false)} />
            <NitroCardContentView classNames={['nitro-catalog-admin-manager-body']}>
                <div aria-live="polite" className={`nitro-catalog-admin-command-bar is-${commandState.phase}`}>
                    <div className="nitro-catalog-admin-command-title">
                        <strong>Catalog Studio</strong>
                        <span>Shared draft command center</span>
                    </div>
                    <div className="nitro-catalog-admin-command-stats">
                        <span className="is-revision"><FaClock /> Revision {studio.revision}</span>
                        <span className={hasPendingChanges ? 'has-pending' : ''}>
                            <FaCloudUploadAlt /> {commandState.pendingLabel}
                        </span>
                        <span className="is-actors"><FaUsers /> {commandState.actorLabel}</span>
                        <span className="is-locks"><FaLock /> {commandState.lockLabel}</span>
                        <span className={validationIssueCount > 0 ? 'has-error' : validationCurrent ? 'is-valid' : 'has-warning'}>
                            {validationCurrent && validationIssueCount === 0 ? <FaCheckCircle /> : <FaExclamationTriangle />}
                            {commandState.validationLabel}
                        </span>
                    </div>
                </div>
                <div className="nitro-catalog-admin-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`nitro-catalog-admin-tab ${activeTab === tab.id ? 'is-active' : ''} ${
                                tab.id === 'publish' && hasPendingChanges ? 'has-pending' : ''
                            }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count > 0 && <span className="nitro-catalog-admin-tab-count">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                <div className="nitro-catalog-admin-panel">
                    {activeTab === 'pages' && renderPagesTab()}
                    {activeTab === 'preview' && <CatalogStudioPreview />}
                    {activeTab === 'bulk' && <CatalogStudioBulkPanel />}
                    {activeTab === 'transfer' && <CatalogStudioImportExportPanel />}
                    {activeTab === 'activity' && renderActivityTab()}
                    {activeTab === 'publish' && renderPublishTab()}
                </div>
            </NitroCardContentView>
        </NitroCardView>
    );
};
