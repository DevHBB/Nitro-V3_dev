import { beforeEach, describe, expect, it } from 'vitest';
import { readCatalogIndexCache, writeCatalogIndexCache } from './useCatalogIndexCache';

const emptyRoot = {
    visible: true,
    icon: 0,
    pageId: -1,
    parentId: -1,
    pageName: 'root',
    localization: '',
    offerIds: [],
    children: []
};

describe('catalog index cache', () => {
    beforeEach(() => sessionStorage.clear());

    it('rejects a previously cached catalog with no root pages', () => {
        sessionStorage.setItem(
            'nitro-catalog-index:v1:NORMAL',
            JSON.stringify({
                version: 1,
                catalogType: 'NORMAL',
                savedAt: 1,
                root: emptyRoot
            })
        );

        expect(readCatalogIndexCache('NORMAL')).toBeNull();
    });

    it('does not persist a catalog with no root pages', () => {
        writeCatalogIndexCache('NORMAL', emptyRoot as never);

        expect(sessionStorage.length).toBe(0);
    });
});
