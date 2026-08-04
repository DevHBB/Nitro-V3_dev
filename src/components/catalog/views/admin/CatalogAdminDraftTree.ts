import type { NodeData } from '@nitrots/nitro-renderer';
import { CatalogNode } from '../../../../api/catalog/CatalogNode';
import type { ICatalogNode } from '../../../../api/catalog/ICatalogNode';
import type { CatalogStudioCatalogType, CatalogStudioPageSnapshot } from '../../admin/studio/CatalogStudioTypes';

const toStudioCatalogType = (catalogType: string): CatalogStudioCatalogType =>
    catalogType === 'BUILDERS_CLUB' || catalogType === 'BUILDER' ? 'BUILDER' : 'NORMAL';

const collectLiveNodes = (node: ICatalogNode | null, result: Map<number, ICatalogNode>) => {
    if (!node) return;
    result.set(node.pageId, node);
    node.children.forEach((child) => collectLiveNodes(child, result));
};

const nodeData = (
    page: CatalogStudioPageSnapshot,
    liveNode: ICatalogNode | undefined
): NodeData => ({
    visible: page.visible,
    icon: page.iconImage,
    pageId: page.pageId,
    parentId: page.parentId,
    pageName: page.captionSave || liveNode?.pageName || `page-${page.pageId}`,
    localization: page.caption || liveNode?.localization || page.captionSave || `Page ${page.pageId}`,
    children: [],
    offerIds: liveNode?.offerIds ?? []
} as unknown as NodeData);

const rootData = (root: ICatalogNode): NodeData => ({
    visible: true,
    icon: root.iconId,
    pageId: root.pageId,
    parentId: root.parentId,
    pageName: root.pageName || 'root',
    localization: root.localization,
    children: [],
    offerIds: root.offerIds
} as unknown as NodeData);

export const buildCatalogAdminDraftTree = (
    liveRoot: ICatalogNode | null,
    pages: CatalogStudioPageSnapshot[],
    catalogType: string
): ICatalogNode | null => {
    if (!liveRoot) return null;

    const scopedPages = pages.filter((page) => page.catalogType === toStudioCatalogType(catalogType));
    if (!scopedPages.length) return liveRoot;

    const liveNodes = new Map<number, ICatalogNode>();
    collectLiveNodes(liveRoot, liveNodes);

    const pageIds = new Set(scopedPages.map((page) => page.pageId));
    const childrenByParent = new Map<number, CatalogStudioPageSnapshot[]>();
    const roots: CatalogStudioPageSnapshot[] = [];

    for (const page of scopedPages) {
        if (!pageIds.has(page.parentId)) {
            roots.push(page);
            continue;
        }

        const siblings = childrenByParent.get(page.parentId) ?? [];
        siblings.push(page);
        childrenByParent.set(page.parentId, siblings);
    }

    const sortPages = (items: CatalogStudioPageSnapshot[]) =>
        items.sort((left, right) => left.orderNum - right.orderNum || left.pageId - right.pageId);

    sortPages(roots);
    childrenByParent.forEach(sortPages);

    const draftRoot = new CatalogNode(rootData(liveRoot), 0, null);
    const visited = new Set<number>();

    const append = (page: CatalogStudioPageSnapshot, parent: ICatalogNode, depth: number): ICatalogNode | null => {
        if (visited.has(page.pageId)) return null;
        visited.add(page.pageId);

        const node = new CatalogNode(nodeData(page, liveNodes.get(page.pageId)), depth, parent);
        for (const child of childrenByParent.get(page.pageId) ?? []) {
            append(child, node, depth + 1);
        }
        parent.addChild(node);
        return node;
    };

    roots.forEach((page) => append(page, draftRoot, 1));
    scopedPages.forEach((page) => {
        if (!visited.has(page.pageId)) append(page, draftRoot, 1);
    });

    return draftRoot;
};
