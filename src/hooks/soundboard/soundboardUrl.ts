import { GetConfigurationValue } from '../../api';

export const resolveSoundboardUrl = (url: string): string => {
    if (!url) return '';

    // Explicit schemes remain untouched so the renderer can enforce its URL policy.
    if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')) return url;

    const base = (GetConfigurationValue<string>('soundboard.url.prefix') || GetConfigurationValue<string>('asset.url') || '').replace(/\/+$/, '');

    return base ? `${base}/${url.replace(/^\/+/, '')}` : url;
};
