import { describe, expect, it } from 'vitest';
import * as PageEditor from './CatalogAdminPageEditView';

describe('catalog admin page form state', () => {
    it('uses the authoritative database values returned for the selected page', () => {
        const createFormState = (PageEditor as any).createCatalogAdminPageFormState;
        const state = createFormState({
            pageId: 42,
            caption: 'Guild shop',
            captionSave: 'guild_shop',
            parentId: 7,
            catalogMode: 'BOTH',
            layout: 'guild_furni',
            iconColor: 3,
            iconImage: 145,
            minRank: 5,
            orderNum: 9,
            visible: true,
            enabled: false,
            clubOnly: true,
            vipOnly: false,
            headline: 'headline',
            teaser: 'teaser',
            special: 'special',
            textOne: 'text one',
            textTwo: 'text two',
            textDetails: 'details',
            textTeaser: 'teaser text',
            roomId: 123,
            includes: '1;2;3'
        });

        expect(state).toMatchObject({
            caption: 'Guild shop',
            captionSave: 'guild_shop',
            parentId: 7,
            catalogMode: 'BOTH',
            pageLayout: 'guild_furni',
            iconColor: 3,
            iconImage: 145,
            minRank: 5,
            orderNum: 9,
            visible: '1',
            enabled: '0',
            clubOnly: '1',
            vipOnly: '0',
            pageHeadline: 'headline',
            pageTeaser: 'teaser',
            pageSpecial: 'special',
            pageText1: 'text one',
            pageText2: 'text two',
            pageTextDetails: 'details',
            pageTextTeaser: 'teaser text',
            roomId: 123,
            includes: '1;2;3'
        });
    });

    it('creates a new-page form without writing a placeholder page first', () => {
        const createNewFormState = (PageEditor as any).createCatalogAdminNewPageFormState;

        expect(createNewFormState(7, 'NORMAL')).toMatchObject({
            pageId: undefined,
            caption: '',
            captionSave: '',
            parentId: 7,
            catalogMode: 'NORMAL',
            pageLayout: 'default_3x3',
            iconImage: 0,
            minRank: 1,
            orderNum: 0,
            visible: '1',
            enabled: '1'
        });
    });

    it('validates required page fields and included page ids', () => {
        const validate = (PageEditor as any).validateCatalogAdminPageForm;
        const valid = (PageEditor as any).createCatalogAdminNewPageFormState(7, 'NORMAL');

        expect(validate({ ...valid, caption: 'New page', includes: '1;2,3' })).toBeNull();
        expect(validate(valid)).toMatch(/caption/i);
        expect(validate({ ...valid, caption: 'New page', includes: '1;abc' })).toMatch(/included/i);
        expect(validate({ ...valid, caption: 'New page', minRank: 0 })).toMatch(/rank/i);
    });
});
