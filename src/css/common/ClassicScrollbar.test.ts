import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('interface scrollbar theme', () => {
    it('is enabled globally with compact control dimensions', () => {
        const entry = readFileSync(join(process.cwd(), 'src/index.tsx'), 'utf8');
        const css = readFileSync(join(process.cwd(), 'src/css/common/ClassicScrollbar.css'), 'utf8');
        const scrollbar = css.match(/\.has-classic-scrollbar \*::\-webkit-scrollbar,([\s\S]*?)\{([^}]+)\}/)?.[2] ?? '';
        const thumb = css.match(/\.has-classic-scrollbar \*::\-webkit-scrollbar-thumb:vertical,([\s\S]*?)\{([^}]+)\}/)?.[2] ?? '';
        const upButton =
            css.match(
                /\.has-classic-scrollbar \*::\-webkit-scrollbar-button:single-button:vertical:decrement,([\s\S]*?)\{([^}]+)\}/
            )?.[2] ?? '';

        expect(entry).toContain("document.documentElement.classList.add('has-classic-scrollbar')");
        expect(css).toContain('scrollbar-color: #d9d9d9 #bdbbb3');
        expect(scrollbar).toContain('width: 17px');
        expect(scrollbar).toContain('height: 17px');
        expect(thumb).toContain('min-height: 12px');
        expect(upButton).toContain('width: 17px');
        expect(upButton).toContain('height: 16px');
    });
});
