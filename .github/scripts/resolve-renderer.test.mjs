import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveRenderer } from './resolve-renderer.mjs';

const baseInput = {
    eventName: 'pull_request',
    baseRef: 'Dev',
    refName: '384/merge',
    repositoryOwner: 'duckietm',
    upstreamRepository: 'duckietm/Nitro_Render_V3',
    headOwner: 'simoleo89',
    headRef: 'codex/global-classic-scrollbars',
    inputRepository: '',
    inputRef: '',
    variableRepository: '',
    variableRef: '',
};

const refLookup = (availableRefs) => async (repository, ref) => availableRefs.has(`${repository}@${ref}`);

describe('renderer resolution', () => {
    it('uses upstream Dev when a fork only has a stale generic Dev branch', async () => {
        const hasRef = refLookup(
            new Set(['simoleo89/Nitro_Render_V3@Dev', 'duckietm/Nitro_Render_V3@Dev'])
        );

        assert.deepEqual(await resolveRenderer(baseInput, hasRef), {
            repository: 'duckietm/Nitro_Render_V3',
            ref: 'Dev',
        });
    });

    it('uses the fork when it provides the exact companion branch', async () => {
        const hasRef = refLookup(
            new Set([
                'simoleo89/Nitro_Render_V3@codex/global-classic-scrollbars',
                'simoleo89/Nitro_Render_V3@Dev',
                'duckietm/Nitro_Render_V3@Dev',
            ])
        );

        assert.deepEqual(await resolveRenderer(baseInput, hasRef), {
            repository: 'simoleo89/Nitro_Render_V3',
            ref: 'codex/global-classic-scrollbars',
        });
    });

    it('preserves explicit workflow dispatch pairing', async () => {
        const hasRef = refLookup(new Set(['custom/renderer@release-candidate']));

        assert.deepEqual(
            await resolveRenderer(
                {
                    ...baseInput,
                    inputRepository: 'custom/renderer',
                    inputRef: 'release-candidate',
                },
                hasRef
            ),
            {
                repository: 'custom/renderer',
                ref: 'release-candidate',
            }
        );
    });
});
