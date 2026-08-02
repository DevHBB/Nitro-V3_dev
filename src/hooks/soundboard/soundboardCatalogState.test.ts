import { describe, expect, it } from 'vitest';
import { filterCatalogSounds, reorderCatalog, validateCatalogDraft } from './soundboardCatalogState';

const sounds = [
    { id: 7, name: 'Campanella', url: '/bell.mp3', enabled: true, sortOrder: 10, minRank: 1 },
    { id: 12, name: 'Applauso', url: 'https://cdn.example/clap.mp3', enabled: false, sortOrder: 20, minRank: 5 }
];

describe('Soundboard catalog state', () => {
    it('filters by ID, name, and enabled state', () => {
        expect(filterCatalogSounds(sounds, '12', 'all').map((sound) => sound.id)).toEqual([12]);
        expect(filterCatalogSounds(sounds, 'camp', 'all').map((sound) => sound.id)).toEqual([7]);
        expect(filterCatalogSounds(sounds, '', 'enabled').map((sound) => sound.id)).toEqual([7]);
        expect(filterCatalogSounds(sounds, '', 'disabled').map((sound) => sound.id)).toEqual([12]);
    });

    it('validates server-compatible names, URLs, and ranks', () => {
        expect(validateCatalogDraft({ id: 0, name: 'Bell', url: '/sounds/bell.mp3', minRank: 1, enabled: true }).valid).toBe(true);
        expect(validateCatalogDraft({ id: 0, name: '', url: 'javascript:alert(1)', minRank: 0, enabled: true }).errors).toEqual({
            name: 'invalid_name',
            url: 'invalid_url',
            minRank: 'invalid_rank'
        });
        expect(validateCatalogDraft({ id: 0, name: 'Bell', url: 'https://cdn.example/bell.mp3', minRank: 2.5, enabled: true }).valid).toBe(false);
    });

    it('reorders without mutating the source and removes duplicate IDs', () => {
        const source = [7, 12, 9, 12];
        const result = reorderCatalog(source, 9, 7);

        expect(result).toEqual([9, 7, 12]);
        expect(source).toEqual([7, 12, 9, 12]);
        expect(new Set(result).size).toBe(result.length);
    });
});
