import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalogProductMetadata } from '../../../../../hooks';
import { CatalogProductDetailsView } from './CatalogProductDetailsView';

vi.mock('../../../../../api', () => ({
    LocalizeText: (key: string) => key
}));

vi.mock('../../../../../hooks', () => ({
    useCatalogProductMetadata: vi.fn(),
    useCatalogUiState: () => ({ currentType: 'NORMAL' })
}));

beforeEach(() => {
    vi.mocked(useCatalogProductMetadata).mockReturnValue(null);
});

describe('catalog product details', () => {
    it('shows the localized identity and useful purchase capabilities', () => {
        const offer = {
            localizationName: 'Lampada lunare',
            localizationDescription: 'Illumina la stanza con una luce soffusa.',
            offerId: 71,
            page: { pageId: 17 },
            giftable: true,
            clubLevel: 1,
            pricingModel: 'single',
            product: {
                productCount: 1,
                isUniqueLimitedItem: true,
                uniqueLimitedItemsLeft: 7,
                uniqueLimitedItemSeriesSize: 100
            }
        } as any;

        render(<CatalogProductDetailsView offer={offer} />);

        expect(screen.getByRole('group', { name: 'Lampada lunare' })).toBeInTheDocument();
        expect(screen.getByText('Illumina la stanza con una luce soffusa.')).toBeInTheDocument();
        expect(screen.queryByText('7 / 100')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('shows capabilities only after optional DB metadata is available', () => {
        vi.mocked(useCatalogProductMetadata).mockReturnValue([
            { itemBaseId: 4, offerId: 71, productClassId: 9, recyclable: true, tradeable: false }
        ]);
        const offer = {
            localizationDescription: '',
            localizationName: 'Sedia',
            offerId: 71,
            page: { pageId: 17 },
            product: { productData: { name: 'Sedia' } }
        } as any;

        render(<CatalogProductDetailsView offer={offer} />);

        expect(screen.getByRole('listitem', { name: 'shop.marketplace.item.not.tradeable' })).toHaveClass('is-disabled');
        expect(screen.getByRole('listitem', { name: 'inventory.furni.preview.recyclable_amount' })).not.toHaveClass('is-disabled');
    });
});
