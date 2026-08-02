import { FC, useMemo, useState } from 'react';
import { DEFAULT_CATALOG_PREVIEW_PERSONA } from './CatalogPreviewPersona';
import { useCatalogStudio } from './useCatalogStudio';

export const CatalogStudioPreview: FC = () => {
    const studio = useCatalogStudio();
    const [persona, setPersona] = useState(DEFAULT_CATALOG_PREVIEW_PERSONA);
    const pages = studio.preview?.pages ?? [];
    const offersByPage = useMemo(() => new Map(pages.map(page => [ `${page.catalogType}:${page.pageId}`,
        (studio.preview?.offers ?? []).filter(entry => entry.offer.catalogType === page.catalogType && entry.offer.pageId === page.pageId)
    ])), [pages, studio.preview?.offers]);

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
        <div className="nitro-catalog-admin-preview-pages">
            {pages.map(page => <section key={`${page.catalogType}:${page.pageId}`} className="nitro-catalog-admin-preview-page">
                <header><strong>{page.caption}</strong><span>{page.catalogType} · #{page.pageId} · {page.pageLayout}</span></header>
                <div className="nitro-catalog-admin-preview-offers">
                    {(offersByPage.get(`${page.catalogType}:${page.pageId}`) ?? []).map(entry => <div key={entry.offer.offerId} className={`nitro-catalog-admin-preview-offer ${entry.eligible ? 'is-eligible' : 'is-blocked'}`}>
                        <strong>{entry.offer.catalogName}</strong>
                        <span>{entry.offer.costCredits} credits{entry.offer.costPoints > 0 ? ` + ${entry.offer.costPoints} currency ${entry.offer.pointsType}` : ''}</span>
                        {!entry.eligible && <small>{entry.reasons.join(', ')}</small>}
                    </div>)}
                </div>
            </section>)}
        </div>
    </div>;
};
