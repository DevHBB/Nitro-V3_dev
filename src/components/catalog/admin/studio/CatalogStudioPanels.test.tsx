/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogStudioBulkPanel } from './CatalogStudioBulkPanel';
import { CatalogStudioImportExportPanel } from './CatalogStudioImportExportPanel';
import { CatalogStudioPreview } from './CatalogStudioPreview';
import { useCatalogStudio } from './useCatalogStudio';

vi.mock('./useCatalogStudio', () => ({ useCatalogStudio: vi.fn() }));

const studio = {
    loading: false,
    preview: null,
    documentResult: null,
    requestPreview: vi.fn(),
    dryRunDocument: vi.fn(),
    applyDocument: vi.fn(),
    acquireLock: vi.fn(),
    exportDocument: vi.fn()
};

describe('Catalog Studio advanced panels', () => {
    afterEach(cleanup);

    beforeEach(() => {
        Object.values(studio).forEach(value => typeof value === 'function' && value.mockClear());
        (studio as any).preview = null;
        vi.mocked(useCatalogStudio).mockReturnValue(studio as any);
    });

    it('submits the simulated customer persona to the server preview', () => {
        render(<CatalogStudioPreview />);
        fireEvent.change(screen.getByLabelText('Rank'), { target: { value: '7' } });
        fireEvent.click(screen.getByLabelText('Builders Club'));
        fireEvent.click(screen.getByText('Refresh preview'));

        expect(studio.requestPreview).toHaveBeenCalledWith(expect.objectContaining({ rank: 7, buildersClub: true }));
    });

    it('renders draft offers with the real catalog tile presentation', () => {
        (studio as any).preview = {
            revision: 7,
            pages: [{
                catalogType: 'NORMAL', pageId: 17, parentId: -1, captionSave: 'front_page', caption: 'Front Page',
                pageLayout: 'default_3x3', iconColor: 0, iconImage: 1, minRank: 1, orderNum: 0,
                visible: true, enabled: true, clubOnly: false, catalogMode: 'NORMAL', vipOnly: false,
                pageHeadline: '', pageTeaser: '', pageSpecial: '', pageText1: '', pageText2: '',
                pageTextDetails: '', pageTextTeaser: '', roomId: 0, includes: ''
            }],
            offers: [{
                offer: {
                    catalogType: 'NORMAL', offerId: 42, itemIds: '12', pageId: 17, catalogName: 'chair',
                    costCredits: 5, costPoints: 0, pointsType: 0, amount: 1, limitedStack: 0,
                    orderNumber: 1, offerIdClient: -1, songId: 0, extradata: '', haveOffer: true, clubOnly: false
                },
                products: [{
                    productType: 'S', productClassId: 456, extraParam: '', productCount: 1,
                    uniqueLimitedItem: false, uniqueLimitedSeriesSize: 0, uniqueLimitedItemsLeft: 0
                }],
                giftable: true,
                eligible: true,
                reasons: []
            }]
        };

        render(<CatalogStudioPreview />);

        expect(screen.getByTitle('ID: 456 | Offer: 42')).toBeInTheDocument();
    });

    it('previews one selected catalog page at a time', () => {
        const page = (pageId: number, caption: string) => ({
            catalogType: 'NORMAL', pageId, parentId: -1, captionSave: caption.toLowerCase().replace(' ', '_'), caption,
            pageLayout: 'default_3x3', iconColor: 0, iconImage: 1, minRank: 1, orderNum: pageId,
            visible: true, enabled: true, clubOnly: false, catalogMode: 'NORMAL', vipOnly: false,
            pageHeadline: '', pageTeaser: '', pageSpecial: '', pageText1: '', pageText2: '',
            pageTextDetails: '', pageTextTeaser: '', roomId: 0, includes: ''
        });
        const previewOffer = (offerId: number, pageId: number, productClassId: number) => ({
            offer: {
                catalogType: 'NORMAL', offerId, itemIds: `${productClassId}`, pageId, catalogName: `offer_${offerId}`,
                costCredits: 5, costPoints: 0, pointsType: 0, amount: 1, limitedStack: 0,
                orderNumber: 1, offerIdClient: -1, songId: 0, extradata: '', haveOffer: true, clubOnly: false
            },
            products: [{
                productType: 'S', productClassId, extraParam: '', productCount: 1,
                uniqueLimitedItem: false, uniqueLimitedSeriesSize: 0, uniqueLimitedItemsLeft: 0
            }],
            giftable: true,
            eligible: true,
            reasons: []
        });
        (studio as any).preview = {
            revision: 7,
            pages: [page(17, 'First Page'), page(18, 'Second Page')],
            offers: [previewOffer(42, 17, 456), previewOffer(43, 18, 789)]
        };

        render(<CatalogStudioPreview />);

        expect(screen.getByTitle('ID: 456 | Offer: 42')).toBeInTheDocument();
        expect(screen.queryByTitle('ID: 789 | Offer: 43')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Second Page' }));
        expect(screen.getByTitle('ID: 789 | Offer: 43')).toBeInTheDocument();
        expect(screen.queryByTitle('ID: 456 | Offer: 42')).not.toBeInTheDocument();
    });

    it('always dry-runs a bulk operation before enabling apply', () => {
        render(<CatalogStudioBulkPanel />);
        expect(screen.queryByText('Acquire apply lock')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Entity IDs'), { target: { value: '10, 11' } });
        fireEvent.click(screen.getByText('Dry-run'));

        expect(studio.dryRunDocument).toHaveBeenCalledWith('BULK', expect.stringContaining('"entityIds":[10,11]'));
        expect(screen.getByText(/^Apply/)).toBeDisabled();
    });

    it('keeps JSONC as the default transfer format and validates original text', () => {
        render(<CatalogStudioImportExportPanel />);
        fireEvent.change(screen.getByLabelText('JSONC catalog document'), { target: { value: '{ // note\n}' } });
        fireEvent.click(screen.getByText('Validate and dry-run'));

        expect(studio.dryRunDocument).toHaveBeenCalledWith('JSONC', '{ // note\n}');
    });
});
