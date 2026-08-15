import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('club membership catalog layout', () => {
    it('keeps the compact intro and integrated offer actions', () => {
        const css = readFileSync(join(process.cwd(), 'src/css/catalog/CatalogVipBuyView.css'), 'utf8');
        const teaser = css.match(/\.nitro-club-teaser\s*\{([^}]+)\}/)?.[1] ?? '';
        const introCopy = css.match(/\.nitro-club-vip-copy\s*\{([^}]+)\}/)?.[1] ?? '';
        const offers = css.match(/\.nitro-club-vip-offers\s*\{([^}]+)\}/)?.[1] ?? '';
        const wideOffer = css.match(/\.nitro-club-offer\.is-wide\s*\{([^}]+)\}/)?.[1] ?? '';

        expect(teaser).toContain('left: 36px');
        expect(teaser).toContain('width: 103px');
        expect(teaser).toContain('height: 167px');
        expect(introCopy).toContain('left: 172px');
        expect(offers).toContain('left: 28px');
        expect(offers).toContain('top: 176px');
        expect(wideOffer).toContain('width: 318px');
        expect(wideOffer).toContain('height: 75px');
        expect(css).toContain('grid-template-columns: 90px 90px');
    });
});
