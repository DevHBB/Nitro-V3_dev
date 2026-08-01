export type SoundboardCatalogFilter = 'all' | 'enabled' | 'disabled';

export interface SoundboardCatalogSoundLike {
    id: number;
    name: string;
    url: string;
    enabled: boolean;
    sortOrder: number;
    minRank: number;
}

export interface SoundboardCatalogDraft {
    id: number;
    name: string;
    url: string;
    enabled: boolean;
    minRank: number;
}

export interface SoundboardCatalogValidation {
    valid: boolean;
    errors: Partial<Record<'name' | 'url' | 'minRank', 'invalid_name' | 'invalid_url' | 'invalid_rank'>>;
}

export const filterCatalogSounds = <T extends SoundboardCatalogSoundLike>(
    sounds: T[],
    query: string,
    filter: SoundboardCatalogFilter
): T[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return sounds.filter((sound) => {
        if (filter === 'enabled' && !sound.enabled) return false;
        if (filter === 'disabled' && sound.enabled) return false;

        return !normalizedQuery || sound.name.toLocaleLowerCase().includes(normalizedQuery) || sound.id.toString().includes(normalizedQuery);
    });
};

const isAllowedCatalogUrl = (value: string): boolean => {
    const url = value?.trim() ?? '';
    if (!url || url.length > 255 || /[\u0000-\u0020]/.test(url)) return false;

    try {
        const parsed = new URL(url, 'https://nitro.invalid');

        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const validateCatalogDraft = (draft: SoundboardCatalogDraft): SoundboardCatalogValidation => {
    const errors: SoundboardCatalogValidation['errors'] = {};
    const name = draft.name?.trim() ?? '';

    if (!name || name.length > 64) errors.name = 'invalid_name';
    if (!isAllowedCatalogUrl(draft.url)) errors.url = 'invalid_url';
    if (!Number.isInteger(draft.minRank) || draft.minRank < 1) errors.minRank = 'invalid_rank';

    return { valid: Object.keys(errors).length === 0, errors };
};

export const reorderCatalog = (ids: number[], movedId: number, targetId: number): number[] => {
    const uniqueIds = [...new Set(ids)];
    const movedIndex = uniqueIds.indexOf(movedId);
    const targetIndex = uniqueIds.indexOf(targetId);

    if (movedIndex < 0 || targetIndex < 0 || movedId === targetId) return uniqueIds;

    const result = [...uniqueIds];
    result.splice(movedIndex, 1);
    result.splice(result.indexOf(targetId), 0, movedId);

    return result;
};
