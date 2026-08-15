import { useSharedHook } from '@/state/useSharedHook';
import { useNavigatorStore } from './useNavigatorStore';

export const useNavigatorData = () => {
    const { categories, eventCategories, topLevelContext, topLevelContexts, navigatorSearches, navigatorData } = useSharedHook(useNavigatorStore);

    return {
        categories,
        eventCategories,
        topLevelContext,
        topLevelContexts,
        navigatorSearches,
        navigatorData
    };
};
