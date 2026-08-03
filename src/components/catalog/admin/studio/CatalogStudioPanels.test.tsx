/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogStudioBulkPanel } from './CatalogStudioBulkPanel';
import { CatalogStudioImportExportPanel } from './CatalogStudioImportExportPanel';
import { CatalogStudioPreview } from './CatalogStudioPreview';
import { useCatalogStudio } from './useCatalogStudio';

vi.mock('./useCatalogStudio', () => ({ useCatalogStudio: vi.fn() }));

const studio = {
    loading: false,
    preview: null,
    documentResult: null,
    requestPreview: vi.fn(),
    dryRunDocument: vi.fn(),
    applyDocument: vi.fn(),
    acquireLock: vi.fn(),
    exportDocument: vi.fn()
};

describe('Catalog Studio advanced panels', () => {
    beforeEach(() => {
        Object.values(studio).forEach(value => typeof value === 'function' && value.mockClear());
        vi.mocked(useCatalogStudio).mockReturnValue(studio as any);
    });

    it('submits the simulated customer persona to the server preview', () => {
        render(<CatalogStudioPreview />);
        fireEvent.change(screen.getByLabelText('Rank'), { target: { value: '7' } });
        fireEvent.click(screen.getByLabelText('Builders Club'));
        fireEvent.click(screen.getByText('Refresh preview'));

        expect(studio.requestPreview).toHaveBeenCalledWith(expect.objectContaining({ rank: 7, buildersClub: true }));
    });

    it('always dry-runs a bulk operation before enabling apply', () => {
        render(<CatalogStudioBulkPanel />);
        fireEvent.change(screen.getByLabelText('Entity IDs'), { target: { value: '10, 11' } });
        fireEvent.click(screen.getByText('Dry-run'));

        expect(studio.dryRunDocument).toHaveBeenCalledWith('BULK', expect.stringContaining('"entityIds":[10,11]'));
        expect(screen.getByText(/^Apply/)).toBeDisabled();
    });

    it('keeps JSONC as the default transfer format and validates original text', () => {
        render(<CatalogStudioImportExportPanel />);
        fireEvent.change(screen.getByLabelText('JSONC catalog document'), { target: { value: '{ // note\n}' } });
        fireEvent.click(screen.getByText('Validate and dry-run'));

        expect(studio.dryRunDocument).toHaveBeenCalledWith('JSONC', '{ // note\n}');
    });
});
