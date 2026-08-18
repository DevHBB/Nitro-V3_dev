import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CatalogLayoutSoundMachineView dedicated layout', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/catalog/views/page/layout/CatalogLayoutSoundMachineView.tsx'), 'utf8');

    it('keeps the dedicated product, listening, grid and purchase regions', () => {
        expect(source).toContain('nitro-catalog-sound-layout');
        expect(source).toContain('nitro-catalog-sound-listen-panel');
        expect(source).toContain('disabled={songId <= 0 || songLength === null}');
        expect(source).toContain('<CatalogItemGridWidgetView');
        expect(source).toContain('getCatalogGridMetrics(density)');
        expect(source).toContain('nitro-catalog-grid-density-${density}');
        expect(source).toContain('<CatalogPurchaseWidgetView');
        expect(source).toContain('previewSong(songId)');
        expect(source).toContain('SongInfoReceivedEvent.SIR_TRAX_SONG_INFO_RECEIVED');
        expect(source).toContain('<LayoutFurniImageView');
        expect(source).not.toContain('getIconUrl(currentOffer)');
        expect(source).not.toContain('nitro-catalog-sound-description');
        expect(source).not.toContain('{songId > 0 && (');
        expect(source).not.toContain('<CatalogLayoutDefaultView');
    });
});
