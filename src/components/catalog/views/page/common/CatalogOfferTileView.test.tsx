import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogOfferTileView } from './CatalogOfferTileView';

const offer = (getIconUrl?: () => string) =>
    ({
        offerId: 90,
        localizationName: 'Sedia classica',
        priceInCredits: 4,
        priceInActivityPoints: 0,
        clubLevel: 0,
        pricingModel: 'single',
        product: {
            productType: 's',
            productClassId: 12,
            productCount: 1,
            furnitureData: { className: '' },
            getIconUrl
        }
    }) as any;

describe('catalog offer tile', () => {
    it('is keyboard selectable and does not expose technical ids to shoppers', () => {
        const selectOffer = vi.fn();
        const item = offer(() => 'icon.png');

        render(<CatalogOfferTileView offer={item} selectOffer={selectOffer} />);

        const tile = screen.getByRole('option', { name: 'Sedia classica' });
        expect(tile).not.toHaveAttribute('title', expect.stringContaining('Offer'));

        fireEvent.keyDown(tile, { key: 'Enter' });
        expect(selectOffer).toHaveBeenCalledWith(item);
    });

    it('keeps rendering when an imported product has no getIconUrl method', () => {
        expect(() => render(<CatalogOfferTileView offer={offer()} selectOffer={() => undefined} />)).not.toThrow();
    });

    it('shows the AIR club-level marker on restricted grid offers', () => {
        const clubOffer = { ...offer(), clubLevel: 1 };

        render(<CatalogOfferTileView offer={clubOffer} selectOffer={() => undefined} />);

        expect(screen.getByLabelText('Habbo Club')).toBeInTheDocument();
    });
});
