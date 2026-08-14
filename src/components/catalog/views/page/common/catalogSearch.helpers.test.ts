import { describe, expect, it } from 'vitest';
import { CatalogType } from '../../../../../api';
import {
    CATALOG_SEARCH_DEBOUNCE_MS,
    CATALOG_SEARCH_MIN_LENGTH,
    CATALOG_SEARCH_RESULT_LIMIT,
    findCatalogFurnitureMatches,
    isCatalogSearchEnterKey,
    normalizeCatalogSearchText,
    shouldRunCatalogSearch
} from './catalogSearch.helpers';

const furniture = (overrides: Record<string, unknown> = {}) =>
    ({
        id: 1,
        name: 'Sedia classica',
        description: 'Una comoda sedia per il salotto',
        className: 'chair_classic',
        furniLine: 'Classic',
        purchaseOfferId: 42,
        rentOfferId: -1,
        availableForBuildersClub: true,
        excludeDynamic: false,
        ...overrides
    }) as any;

describe('catalog search behavior', () => {
    it('uses the official AIR threshold, timer and result limit', () => {
        expect(CATALOG_SEARCH_MIN_LENGTH).toBe(3);
        expect(CATALOG_SEARCH_DEBOUNCE_MS).toBe(50);
        expect(CATALOG_SEARCH_RESULT_LIMIT).toBe(400);
        expect(shouldRunCatalogSearch(' sè ')).toBe(false);
        expect(shouldRunCatalogSearch(' sed ')).toBe(true);
    });

    it('normalizes accents, whitespace and letter case', () => {
        expect(normalizeCatalogSearchText('  Caffè   Èlite ')).toBe('caffe elite');
    });

    it('runs a valid search immediately when the user presses Enter', () => {
        expect(isCatalogSearchEnterKey('Enter', 'sedia')).toBe(true);
        expect(isCatalogSearchEnterKey('Enter', 'se')).toBe(false);
        expect(isCatalogSearchEnterKey('Escape', 'sedia')).toBe(false);
    });

    it('matches user-facing name, description, class name and furniline', () => {
        const source = [
            furniture(),
            furniture({ id: 2, name: 'Lampada', description: 'Luce d’atmosfera', className: 'mood_lamp', furniLine: 'Neon', purchaseOfferId: 43 })
        ];

        expect(findCatalogFurnitureMatches(source, 'comodA', CatalogType.NORMAL).furniture.map((item) => item.id)).toEqual([1]);
        expect(findCatalogFurnitureMatches(source, 'mood lamp', CatalogType.NORMAL).furniture.map((item) => item.id)).toEqual([2]);
        expect(findCatalogFurnitureMatches(source, 'neon', CatalogType.NORMAL).furniture.map((item) => item.id)).toEqual([2]);
    });

    it('respects normal and Builders Club visibility rules', () => {
        const source = [
            furniture({ id: 1, excludeDynamic: true }),
            furniture({ id: 2, availableForBuildersClub: false, purchaseOfferId: 43 }),
            furniture({ id: 3, purchaseOfferId: 44 })
        ];

        expect(findCatalogFurnitureMatches(source, 'sedia', CatalogType.NORMAL).furniture.map((item) => item.id)).toEqual([2, 3]);
        expect(findCatalogFurnitureMatches(source, 'sedia', CatalogType.BUILDER).furniture.map((item) => item.id)).toEqual([1, 3]);
    });
});
