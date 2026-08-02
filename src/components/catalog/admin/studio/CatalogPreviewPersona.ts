export interface CatalogPreviewPersona {
    rank: number;
    hc: boolean;
    vip: boolean;
    buildersClub: boolean;
    showHidden: boolean;
    credits: number;
    currencies: Record<number, number>;
}

export const DEFAULT_CATALOG_PREVIEW_PERSONA: CatalogPreviewPersona = {
    rank: 1,
    hc: false,
    vip: false,
    buildersClub: false,
    showHidden: false,
    credits: 100,
    currencies: {}
};
