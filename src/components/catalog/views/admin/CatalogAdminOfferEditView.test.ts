import { describe, expect, it } from 'vitest';
import * as OfferEditor from './CatalogAdminOfferEditView';

describe('catalog admin offer form state', () => {
    it('uses the complete authoritative offer response including bundle quantities', () => {
        const createFormState = (OfferEditor as any).createCatalogAdminOfferFormState;
        const state = createFormState({
            offerId: 99,
            pageId: 42,
            itemIds: '100:2;200:5',
            catalogName: 'quantity_bundle',
            costCredits: 25,
            costPoints: 10,
            pointsType: 5,
            amount: 1,
            clubOnly: true,
            extradata: 'extra',
            haveOffer: false,
            offerIdGroup: 77,
            limitedStack: 100,
            limitedSells: 12,
            orderNumber: 4,
            catalogMode: 'NORMAL'
        });

        expect(state).toMatchObject({
            offerId: 99,
            pageId: 42,
            itemIds: '100:2;200:5',
            catalogName: 'quantity_bundle',
            costCredits: 25,
            costPoints: 10,
            pointsType: 5,
            amount: 1,
            clubOnly: '1',
            extradata: 'extra',
            haveOffer: '0',
            offerId_group: 77,
            limitedStack: 100,
            orderNumber: 4
        });
    });

    it('validates bundle syntax and limited stock before sending an offer', () => {
        const validate = (OfferEditor as any).validateCatalogAdminOfferForm;
        const valid = {
            pageId: 42,
            itemIds: '100:2;200:5',
            catalogName: 'quantity_bundle',
            costCredits: 25,
            costPoints: 0,
            pointsType: 0,
            amount: 1,
            clubOnly: '0',
            extradata: '',
            haveOffer: '1',
            offerId_group: 0,
            limitedStack: 100,
            orderNumber: 4
        };

        expect(validate(valid, false, 12)).toBeNull();
        expect(validate({ ...valid, itemIds: '100:0' }, false, 12)).toMatch(/item ids/i);
        expect(validate({ ...valid, limitedStack: 5 }, false, 12)).toMatch(/sold/i);
        expect(validate({ ...valid, catalogName: '   ' }, false, 12)).toMatch(/name/i);
    });
});
