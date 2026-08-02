import type { ICatalogNode } from '../../../../api';
import { describe, expect, it } from 'vitest';
import type { CatalogStudioPageSnapshot } from '../../admin/studio/CatalogStudioTypes';
import { buildCatalogAdminDraftTree } from './CatalogAdminDraftTree';

const liveNode = (pageId: number, parent: ICatalogNode | null = null): ICatalogNode => ({
    activate: () => undefined,
    deactivate: () => undefined,
    open: () => undefined,
    close: () => undefined,
    addChild: () => undefined,
    depth: parent ? parent.depth + 1 : 0,
    isBranch: false,
    isLeaf: true,
    localization: pageId < 0 ? 'Root' : `Live ${pageId}`,
    pageId,
    parentId: parent?.pageId ?? -1,
    pageName: pageId < 0 ? 'root' : `live-${pageId}`,
    iconId: 0,
    children: [],
    offerIds: [],
    parent: parent as ICatalogNode,
    isVisible: true,
    isActive: false,
    isOpen: false
});

const page = (pageId: number, parentId: number, orderNum: number): CatalogStudioPageSnapshot => ({
    catalogType: 'NORMAL',
    pageId,
    parentId,
    captionSave: `page-${pageId}`,
    caption: `Page ${pageId}`,
    pageLayout: 'default_3x3',
    iconColor: 0,
    iconImage: 0,
    minRank: 1,
    orderNum,
    visible: true,
    enabled: true,
    clubOnly: false,
    catalogMode: 'NORMAL',
    vipOnly: false,
    pageHeadline: '',
    pageTeaser: '',
    pageSpecial: '',
    pageText1: '',
    pageText2: '',
    pageTextDetails: '',
    pageTextTeaser: '',
    roomId: 0,
    includes: ''
});

describe('buildCatalogAdminDraftTree', () => {
    it('uses the shared draft parent and order instead of the live catalog tree', () => {
        const root = liveNode(-1);
        const draft = buildCatalogAdminDraftTree(root, [ page(1, -1, 1), page(2, -1, 0), page(3, 2, 0) ], 'NORMAL');

        expect(draft?.children.map((node) => node.pageId)).toEqual([ 2, 1 ]);
        expect(draft?.children[0].children.map((node) => node.pageId)).toEqual([ 3 ]);
        expect(draft?.children[0].children[0].parent.pageId).toBe(2);
    });

    it('includes categories created only in the shared draft', () => {
        const draft = buildCatalogAdminDraftTree(liveNode(-1), [ page(99, -1, 0) ], 'NORMAL');

        expect(draft?.children[0].pageId).toBe(99);
        expect(draft?.children[0].localization).toBe('Page 99');
    });
});
