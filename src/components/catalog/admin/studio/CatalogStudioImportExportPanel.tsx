import { FC, useEffect, useState } from 'react';
import { useCatalogStudio } from './useCatalogStudio';

export const CatalogStudioImportExportPanel: FC = () => {
    const studio = useCatalogStudio();
    const [format, setFormat] = useState<'JSONC' | 'SQL'>('JSONC');
    const [document, setDocument] = useState('');
    const result = studio.documentResult?.format === format ? studio.documentResult : null;

    useEffect(() => {
        if(result?.code === 'EXPORTED' && result.document) setDocument(result.document);
    }, [result?.operationId]);

    return <div className="nitro-catalog-admin-import-export">
        <div className="nitro-catalog-admin-section-head"><div><strong>Import / export</strong><span>JSONC comments stay supported; SQL is parsed and never executed directly</span></div></div>
        <div className="nitro-catalog-admin-import-toolbar">
            <select aria-label="Transfer format" value={format} onChange={event => setFormat(event.target.value as 'JSONC' | 'SQL')}><option>JSONC</option><option>SQL</option></select>
            <button className="nitro-catalog-admin-btn" disabled={studio.loading} onClick={() => studio.exportDocument(format)}>Export draft</button>
            <button className="nitro-catalog-admin-btn" disabled={studio.loading || !document.trim()} onClick={() => studio.dryRunDocument(format, document)}>Validate and dry-run</button>
            <button className="nitro-catalog-admin-btn is-publish" disabled={studio.loading || result?.code !== 'DRY_RUN_READY'}
                onClick={() => result && studio.applyDocument(format, document, result.fingerprint, `Import ${format}`)}>Apply {result?.changedEntities ?? 0} changes</button>
        </div>
        <textarea value={document} onChange={event => setDocument(event.target.value)} spellCheck={false} aria-label={`${format} catalog document`} />
        {result && <div role="status" className={`nitro-catalog-admin-publish-status ${result.success ? 'is-ready' : 'is-blocked'}`}>{result.message} · {result.changedEntities} change(s)</div>}
    </div>;
};
