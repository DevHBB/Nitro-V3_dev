import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const badgeOverlayClasses = 'absolute! bottom-0 left-1/2 z-10 mb-1 -translate-x-1/2';
const searchViewPath = 'src/components/navigator/views/search';

describe('navigator room group badge overlay', () => {
    it.each(['NavigatorSearchResultItemView.tsx', 'NavigatorSearchResultItemInfoView.tsx'])('keeps the badge over the bottom center in %s', (fileName) => {
        const source = readFileSync(join(process.cwd(), searchViewPath, fileName), 'utf8');

        expect(source).toContain(`className="${badgeOverlayClasses}"`);
        expect(source).not.toContain('className="absolute top-0 inset-s-0 m-1"');
    });
});
