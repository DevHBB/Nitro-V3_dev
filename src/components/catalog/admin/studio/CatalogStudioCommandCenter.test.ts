import { describe, expect, it } from 'vitest';
import * as CommandCenter from './CatalogStudioCommandCenter';

const { getCatalogStudioCommandState } = CommandCenter;

describe('Catalog Studio command center state', () => {
    it('requires current validation before publishing pending changes', () => {
        const state = getCatalogStudioCommandState({
            sessionReady: true,
            pendingCount: 3,
            actorCount: 2,
            lockCount: 1,
            validationCurrent: false,
            validationIssueCount: 0,
            loading: false
        });

        expect(state.phase).toBe('draft');
        expect(state.canValidate).toBe(true);
        expect(state.canPublish).toBe(false);
        expect(state.pendingLabel).toBe('3 pending changes');
    });

    it('enables publication only for a validated clean draft', () => {
        const state = getCatalogStudioCommandState({
            sessionReady: true,
            pendingCount: 1,
            actorCount: 1,
            lockCount: 0,
            validationCurrent: true,
            validationIssueCount: 0,
            loading: false
        });

        expect(state.phase).toBe('ready');
        expect(state.canPublish).toBe(true);
    });

    it('blocks publication when validation found issues', () => {
        const state = getCatalogStudioCommandState({
            sessionReady: true,
            pendingCount: 2,
            actorCount: 1,
            lockCount: 0,
            validationCurrent: true,
            validationIssueCount: 4,
            loading: false
        });

        expect(state.phase).toBe('blocked');
        expect(state.canPublish).toBe(false);
        expect(state.validationLabel).toBe('4 validation issues');
    });

    it('uses the catalog type when resolving a page lock', () => {
        const getPageLockKey = (CommandCenter as any).getCatalogStudioPageLockKey;

        expect(getPageLockKey(976, 'NORMAL')).toBe('PAGE:976');
        expect(getPageLockKey(976, 'BUILDERS_CLUB')).toBe('BUILDER:PAGE:976');
        expect(getPageLockKey(976, 'BUILDER')).toBe('BUILDER:PAGE:976');
    });
});
