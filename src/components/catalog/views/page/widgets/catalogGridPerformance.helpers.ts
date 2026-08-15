export const CATALOG_GRID_VIRTUALIZATION_THRESHOLD = 90;

export const shouldVirtualizeCatalogOffers = (offerCount: number, adminMode: boolean): boolean =>
    !adminMode && offerCount > CATALOG_GRID_VIRTUALIZATION_THRESHOLD;
