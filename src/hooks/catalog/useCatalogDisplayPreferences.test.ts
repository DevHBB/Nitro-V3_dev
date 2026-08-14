import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCatalogGridMetrics } from './useCatalogDisplayPreferences';

describe('catalog grid personalization', () => {
    it('offers compact, AIR and large layouts without changing offer data', () => {
        expect(getCatalogGridMetrics('compact')).toEqual({ columnCount: 7, columnMinHeight: 64, columnMinWidth: 45 });
        expect(getCatalogGridMetrics('air')).toEqual({ columnCount: 6, columnMinHeight: 74, columnMinWidth: 53 });
        expect(getCatalogGridMetrics('large')).toEqual({ columnCount: 5, columnMinHeight: 92, columnMinWidth: 68 });
    });

    it('falls back to the AIR density for invalid stored values', () => {
        expect(getCatalogGridMetrics('invalid' as any)).toEqual({ columnCount: 6, columnMinHeight: 74, columnMinWidth: 53 });
    });

    it('keeps the official AIR tile width while allowing the React density variants', () => {
        const css = readFileSync(resolve(process.cwd(), 'src/css/catalog/CatalogExperience.css'), 'utf8');

        expect(css).toContain('grid-template-columns: repeat(6, 53px)');
        expect(css).toContain('nitro-catalog-grid-density-compact');
        expect(css).toContain('nitro-catalog-grid-density-large');
    });
});
