import { describe, expect, it } from 'vitest';
import { GetCatalogLayout } from './GetCatalogLayout';
import { CatalogLayoutPetCustomizationView } from './CatalogLayoutPetCustomizationView';

const page = (layoutCode: string) =>
    ({
        pageId: 10,
        layoutCode,
        offers: [],
        localization: { getImage: () => '', getText: () => '' }
    }) as any;

describe('catalog layout resolution', () => {
    it('renders a usable layout for the featured front page', () => {
        expect(GetCatalogLayout(page('frontpage_featured'), () => undefined)).not.toBeNull();
    });

    it('keeps an unknown server layout usable through the default layout', () => {
        expect(GetCatalogLayout(page('future_layout'), () => undefined)).not.toBeNull();
    });

    it('uses the AIR pet customization renderer instead of the generic furniture layout', () => {
        expect(GetCatalogLayout(page('petcustomization'), () => undefined)?.type).toBe(CatalogLayoutPetCustomizationView);
    });
});
