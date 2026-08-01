import {
    ISoundboardCatalogSound,
    SoundboardCatalogEvent,
    SoundboardCatalogReorderComposer,
    SoundboardCatalogRequestComposer,
    SoundboardCatalogResultEvent,
    SoundboardCatalogUpsertComposer
} from '@nitrots/nitro-renderer';
import { useCallback, useState } from 'react';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../events';
import { SoundboardCatalogDraft } from './soundboardCatalogState';

export interface SoundboardCatalogOperationResult {
    operation: number;
    resultCode: number;
    soundId: number;
}

export const useSoundboardCatalog = () => {
    const [sounds, setSounds] = useState<ISoundboardCatalogSound[]>([]);
    const [lastResult, setLastResult] = useState<SoundboardCatalogOperationResult | null>(null);

    const request = useCallback(() => {
        SendMessageComposer(new SoundboardCatalogRequestComposer());
    }, []);

    const upsert = useCallback((draft: SoundboardCatalogDraft) => {
        SendMessageComposer(new SoundboardCatalogUpsertComposer(draft.id, draft.name.trim(), draft.url.trim(), draft.minRank, draft.enabled));
    }, []);

    const reorder = useCallback((orderedIds: number[]) => {
        SendMessageComposer(new SoundboardCatalogReorderComposer(orderedIds));
    }, []);

    const handleCatalog = useCallback((event: SoundboardCatalogEvent) => {
        setSounds(event.getParser().sounds);
    }, []);

    const handleResult = useCallback((event: SoundboardCatalogResultEvent) => {
        const parser = event.getParser();
        const result = { operation: parser.operation, resultCode: parser.resultCode, soundId: parser.soundId };
        setLastResult(result);

        if (result.resultCode === 0) request();
    }, [request]);

    useMessageEvent<SoundboardCatalogEvent>(SoundboardCatalogEvent, handleCatalog);
    useMessageEvent<SoundboardCatalogResultEvent>(SoundboardCatalogResultEvent, handleResult);

    return { sounds, lastResult, request, upsert, reorder };
};
