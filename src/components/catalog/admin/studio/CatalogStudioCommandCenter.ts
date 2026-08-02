export interface CatalogStudioCommandInput {
    sessionReady: boolean;
    pendingCount: number;
    actorCount: number;
    lockCount: number;
    validationCurrent: boolean;
    validationIssueCount: number;
    loading: boolean;
}

export interface CatalogStudioCommandState {
    phase: 'offline' | 'clean' | 'draft' | 'blocked' | 'ready';
    canValidate: boolean;
    canPublish: boolean;
    pendingLabel: string;
    actorLabel: string;
    lockLabel: string;
    validationLabel: string;
}

const quantity = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

export const getCatalogStudioCommandState = (input: CatalogStudioCommandInput): CatalogStudioCommandState => {
    const hasPending = input.pendingCount > 0;
    const hasIssues = input.validationIssueCount > 0;
    const canValidate = input.sessionReady && hasPending && !input.loading;
    const canPublish = canValidate && input.validationCurrent && !hasIssues;
    let phase: CatalogStudioCommandState['phase'] = 'offline';

    if (input.sessionReady) {
        if (!hasPending) phase = 'clean';
        else if (input.validationCurrent && hasIssues) phase = 'blocked';
        else if (canPublish) phase = 'ready';
        else phase = 'draft';
    }

    return {
        phase,
        canValidate,
        canPublish,
        pendingLabel: quantity(input.pendingCount, 'pending change', 'pending changes'),
        actorLabel: quantity(input.actorCount, 'editor online', 'editors online'),
        lockLabel: quantity(input.lockCount, 'active lock', 'active locks'),
        validationLabel: hasIssues
            ? quantity(input.validationIssueCount, 'validation issue', 'validation issues')
            : input.validationCurrent ? 'Validation current' : 'Validation required'
    };
};
