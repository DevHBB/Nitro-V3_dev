import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogProductDetailsView } from './CatalogProductDetailsView';

describe('catalog product details', () => {
    it('shows the localized identity and useful purchase capabilities', () => {
        const offer = {
            localizationName: 'Lampada lunare',
            localizationDescription: 'Illumina la stanza con una luce soffusa.',
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
    });
});
