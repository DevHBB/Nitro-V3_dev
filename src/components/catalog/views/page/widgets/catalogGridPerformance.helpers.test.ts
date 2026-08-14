import { describe, expect, it } from 'vitest';
import { shouldVirtualizeCatalogOffers } from './catalogGridPerformance.helpers';

describe('catalog grid performance policy', () => {
    it('virtualizes the large pages that exist in the live catalog', () => {
        expect(shouldVirtualizeCatalogOffers(240, false)).toBe(true);
        expect(shouldVirtualizeCatalogOffers(101, false)).toBe(true);
        expect(shouldVirtualizeCatalogOffers(90, false)).toBe(false);
    });

    it('keeps the complete grid mounted while Catalog Studio reorder is active', () => {
        expect(shouldVirtualizeCatalogOffers(240, true)).toBe(false);
    });
});
