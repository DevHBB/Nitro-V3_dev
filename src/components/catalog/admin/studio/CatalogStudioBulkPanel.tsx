import { FC, useMemo, useState } from 'react';
import { useCatalogStudio } from './useCatalogStudio';

type BulkOperation = 'PRICE_PERCENT' | 'REPLACE_CURRENCY' | 'SET_VISIBILITY' | 'SET_MIN_RANK' | 'REPARENT';

export const CatalogStudioBulkPanel: FC = () => {
    const studio = useCatalogStudio();
    const [operation, setOperation] = useState<BulkOperation>('PRICE_PERCENT');
    const [catalogType, setCatalogType] = useState<'NORMAL' | 'BUILDER'>('NORMAL');
    const [ids, setIds] = useState('');
    const [intValue, setIntValue] = useState(0);
    const [booleanValue, setBooleanValue] = useState(false);
    const request = useMemo(() => JSON.stringify({
        operation, catalogType,
        entityIds: ids.split(',').map(value => Number(value.trim())).filter(value => value > 0),
        intValue, booleanValue
    }), [operation, catalogType, ids, intValue, booleanValue]);
    const dryRun = studio.documentResult?.format === 'BULK' && studio.documentResult.code === 'DRY_RUN_READY' ? studio.documentResult : null;

    return <div className="nitro-catalog-admin-bulk">
        <div className="nitro-catalog-admin-section-head"><div><strong>Bulk operations</strong><span>Dry-run first, then one atomic and reversible apply</span></div></div>
        <div className="nitro-catalog-admin-bulk-grid">
            <label>Catalog<select value={catalogType} onChange={event => setCatalogType(event.target.value as 'NORMAL' | 'BUILDER')}><option>NORMAL</option><option>BUILDER</option></select></label>
            <label>Operation<select value={operation} onChange={event => setOperation(event.target.value as BulkOperation)}>
                <option value="PRICE_PERCENT">Adjust price %</option><option value="REPLACE_CURRENCY">Replace currency</option>
                <option value="SET_VISIBILITY">Set visibility</option><option value="SET_MIN_RANK">Set minimum rank</option><option value="REPARENT">Move pages</option>
            </select></label>
            <label>Entity IDs<input value={ids} onChange={event => setIds(event.target.value)} placeholder="10, 11, 12" /></label>
            {operation === 'SET_VISIBILITY'
                ? <label><input type="checkbox" checked={booleanValue} onChange={event => setBooleanValue(event.target.checked)} /> Visible</label>
                : <label>Value<input type="number" value={intValue} onChange={event => setIntValue(Number(event.target.value))} /></label>}
        </div>
        <div className="nitro-catalog-admin-publish-actions">
            <button className="nitro-catalog-admin-btn" disabled={studio.loading} onClick={() => studio.dryRunDocument('BULK', request)}>Dry-run</button>
            <button className="nitro-catalog-admin-btn is-publish" disabled={!dryRun || studio.loading}
                onClick={() => dryRun && studio.applyDocument('BULK', request, dryRun.fingerprint, `Bulk ${operation}`)}>Apply {dryRun?.changedEntities ?? 0} changes</button>
        </div>
    </div>;
};
