import { FC, useEffect, useMemo, useState } from 'react';
import { GetFurnitureData, GetProductDataForLocalization, IProduct, IPurchasableOffer, Offer, Product } from '../../../../api';
import { CatalogOfferTileView } from '../../views/page/common/CatalogOfferTileView';
import { DEFAULT_CATALOG_PREVIEW_PERSONA } from './CatalogPreviewPersona';
import { CatalogStudioPreviewOffer } from './CatalogStudioTypes';
import { useCatalogStudio } from './useCatalogStudio';

const createCatalogOffer = (entry: CatalogStudioPreviewOffer): IPurchasableOffer => {
    const productData = GetProductDataForLocalization(entry.offer.catalogName);
    const products: IProduct[] = entry.products.map(product => new Product(
        product.productType,
        product.productClassId,
        product.extraParam,
        product.productCount,
        productData,
        GetFurnitureData(product.productClassId, product.productType),
        product.uniqueLimitedItem,
        product.uniqueLimitedSeriesSize,
        product.uniqueLimitedItemsLeft
    ));

    return new Offer(
        entry.offer.offerId,
        entry.offer.catalogName,
        false,
        entry.offer.costCredits,
        entry.offer.costPoints,
        entry.offer.pointsType,
        entry.giftable,
        entry.offer.clubOnly ? 1 : 0,
        products,
        entry.offer.haveOffer,
        entry.offer.itemIds,
        entry.offer.haveOffer
    );
};

export const CatalogStudioPreview: FC = () => {
    const studio = useCatalogStudio();
    const [persona, setPersona] = useState(DEFAULT_CATALOG_PREVIEW_PERSONA);
    const pages = studio.preview?.pages ?? [];
    const [selectedPageKey, setSelectedPageKey] = useState('');
    const offersByPage = useMemo(() => new Map(pages.map(page => [ `${page.catalogType}:${page.pageId}`,
        (studio.preview?.offers ?? [])
            .filter(entry => entry.offer.catalogType === page.catalogType && entry.offer.pageId === page.pageId)
            .map(entry => ({ entry, catalogOffer: createCatalogOffer(entry) }))
    ])), [pages, studio.preview?.offers]);
    const selectedPage = pages.find(page => `${page.catalogType}:${page.pageId}` === selectedPageKey) ?? pages[0];
    const selectedPageOffers = selectedPage ? (offersByPage.get(`${selectedPage.catalogType}:${selectedPage.pageId}`) ?? []) : [];

    useEffect(() => {
        if (!pages.length) {
            setSelectedPageKey('');

            return;
        }

        if (!pages.some(page => `${page.catalogType}:${page.pageId}` === selectedPageKey)) {
            setSelectedPageKey(`${pages[0].catalogType}:${pages[0].pageId}`);
        }
    }, [pages, selectedPageKey]);

    return <div className="nitro-catalog-admin-studio-preview">
        <div className="nitro-catalog-admin-section-head">
            <div><strong>Exact draft preview</strong><span>Server-evaluated visibility and purchase eligibility</span></div>
            <button className="nitro-catalog-admin-btn" disabled={studio.loading} onClick={() => studio.requestPreview(persona)}>Refresh preview</button>
        </div>
        <div className="nitro-catalog-admin-preview-persona">
            <label>Rank<input type="number" min={0} value={persona.rank} onChange={event => setPersona(current => ({ ...current, rank: Number(event.target.value) }))} /></label>
            <label>Credits<input type="number" min={0} value={persona.credits} onChange={event => setPersona(current => ({ ...current, credits: Number(event.target.value) }))} /></label>
            {([ 'hc', 'vip', 'buildersClub', 'showHidden' ] as const).map(field => <label key={field}>
                <input type="checkbox" checked={persona[field]} onChange={event => setPersona(current => ({ ...current, [field]: event.target.checked }))} />
                {field === 'buildersClub' ? 'Builders Club' : field === 'showHidden' ? 'Show hidden' : field.toUpperCase()}
            </label>)}
        </div>
        {!studio.preview && <div className="nitro-catalog-admin-placeholder is-small">Choose a persona and refresh the preview.</div>}
        {studio.preview && !pages.length && <div className="nitro-catalog-admin-placeholder is-small">No pages are visible to this persona.</div>}
        {!!selectedPage && <div className="nitro-catalog-admin-preview-pages">
            <nav className="nitro-catalog-admin-preview-navigation" aria-label="Draft preview pages">
                {pages.map(page => {
                    const pageKey = `${page.catalogType}:${page.pageId}`;
                    const isActive = pageKey === `${selectedPage.catalogType}:${selectedPage.pageId}`;

                    return <button
                        key={pageKey}
                        type="button"
                        className={`nitro-catalog-admin-preview-page-button ${isActive ? 'is-active' : ''}`}
                        aria-pressed={isActive}
                        onClick={() => setSelectedPageKey(pageKey)}>
                        {page.caption}
                    </button>;
                })}
            </nav>
            <section className="nitro-catalog-admin-preview-page">
                <header><strong>{selectedPage.caption}</strong><span>{selectedPage.catalogType} &middot; #{selectedPage.pageId} &middot; {selectedPage.pageLayout}</span></header>
                <div className="nitro-catalog-admin-preview-offers">
                    {selectedPageOffers.map(({ entry, catalogOffer }) => <div key={entry.offer.offerId} className={`nitro-catalog-admin-preview-offer ${entry.eligible ? 'is-eligible' : 'is-blocked'}`}>
                        <CatalogOfferTileView offer={catalogOffer} itemActive={false} readOnly selectOffer={() => undefined} />
                        <div className="nitro-catalog-admin-preview-offer-copy">
                            <strong>{entry.offer.catalogName}</strong>
                            <span>{entry.offer.costCredits} credits{entry.offer.costPoints > 0 ? ` + ${entry.offer.costPoints} currency ${entry.offer.pointsType}` : ''}</span>
                            {!entry.eligible && <small>{entry.reasons.join(', ')}</small>}
                        </div>
                    </div>)}
                </div>
            </section>
        </div>}
    </div>;
};
