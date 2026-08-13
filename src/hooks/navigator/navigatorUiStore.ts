import { createNitroStore } from '../../state/createNitroStore';

const QUICK_LINKS_STORAGE_KEY = 'nitro.navigator.air.quickLinksOpen';
const COLLAPSED_RESULTS_STORAGE_KEY = 'nitro.navigator.air.collapsedResults';
const EXPANDED_RESULTS_STORAGE_KEY = 'nitro.navigator.air.expandedResults';
const RESULT_VIEW_MODES_STORAGE_KEY = 'nitro.navigator.air.resultViewModes';

const persistBooleanPreference = (key: string, value: boolean) => {
    try {
        window.localStorage.setItem(key, value ? '1' : '0');
    } catch {}
};

const readBooleanPreference = (key: string, fallback: boolean) => {
    try {
        const value = window.localStorage.getItem(key);

        return value === null ? fallback : value !== '0';
    } catch {
        return fallback;
    }
};

const readResultCodeList = (key: string): string[] => {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) ?? '[]');

        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const persistResultCodeList = (key: string, codes: string[]) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(codes));
    } catch {}
};

const readResultViewModes = (): Record<string, number> => {
    try {
        const value = JSON.parse(window.localStorage.getItem(RESULT_VIEW_MODES_STORAGE_KEY) ?? '{}');

        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

        return Object.entries(value).reduce<Record<string, number>>((modes, [code, mode]) => {
            if (mode === 0 || mode === 1) modes[code] = mode;

            return modes;
        }, {});
    } catch {
        return {};
    }
};

export type NavigatorUiState = {
    isVisible: boolean;
    isReady: boolean;
    isCreatorOpen: boolean;
    isRoomInfoOpen: boolean;
    isRoomLinkOpen: boolean;
    isOpenSavesSearches: boolean;
    isLoading: boolean;
    needsInit: boolean;
    needsSearch: boolean;
    currentTabCode: string;
    currentFilter: string;
    collapsedResultCodes: string[];
    expandedResultCodes: string[];
    resultViewModes: Record<string, number>;
};

export type NavigatorUiActions = {
    show(): void;
    hide(): void;
    toggle(): void;
    openCreator(): void;
    closeCreator(): void;
    setRoomInfoOpen(open: boolean): void;
    toggleRoomInfo(): void;
    setRoomLinkOpen(open: boolean): void;
    toggleRoomLink(): void;
    toggleSavesSearches(): void;
    setLoading(loading: boolean): void;
    markReady(): void;
    markInitDone(): void;
    requestSearch(): void;
    consumeSearchRequest(): void;
    setTab(code: string): void;
    setFilter(value: string): void;
    hydrateAirPreferences(): void;
    toggleResultCollapsed(code: string): void;
    setResultCollapsed(code: string, collapsed: boolean): void;
    setResultViewMode(code: string, mode: number): void;
};

export const useNavigatorUiStore = createNitroStore<NavigatorUiState & NavigatorUiActions>()((set) => ({
    isVisible: false,
    isReady: false,
    isCreatorOpen: false,
    isRoomInfoOpen: false,
    isRoomLinkOpen: false,
    isOpenSavesSearches: false,
    isLoading: false,
    needsInit: true,
    needsSearch: false,
    currentTabCode: '',
    currentFilter: '',
    collapsedResultCodes: [],
    expandedResultCodes: [],
    resultViewModes: {},

    show: () => set({ isVisible: true, needsSearch: true }),
    hide: () => set({ isVisible: false }),
    toggle: () => set((s) => (s.isVisible ? { isVisible: false } : { isVisible: true, needsSearch: true })),
    openCreator: () => set({ isVisible: true, isCreatorOpen: true }),
    closeCreator: () => set({ isCreatorOpen: false }),
    setRoomInfoOpen: (open) => set({ isRoomInfoOpen: open }),
    toggleRoomInfo: () => set((s) => ({ isRoomInfoOpen: !s.isRoomInfoOpen })),
    setRoomLinkOpen: (open) => set({ isRoomLinkOpen: open }),
    toggleRoomLink: () => set((s) => ({ isRoomLinkOpen: !s.isRoomLinkOpen })),
    toggleSavesSearches: () =>
        set((s) => {
            const isOpenSavesSearches = !s.isOpenSavesSearches;

            persistBooleanPreference(QUICK_LINKS_STORAGE_KEY, isOpenSavesSearches);

            return { isOpenSavesSearches };
        }),
    setLoading: (loading) => set({ isLoading: loading }),
    markReady: () => set({ isReady: true }),
    markInitDone: () => set({ needsInit: false }),
    requestSearch: () => set({ needsSearch: true }),
    consumeSearchRequest: () => set({ needsSearch: false }),
    setTab: (code) => set({ currentTabCode: code, currentFilter: '', isCreatorOpen: false }),
    setFilter: (value) => set({ currentFilter: value }),
    hydrateAirPreferences: () =>
        set({
            isOpenSavesSearches: readBooleanPreference(QUICK_LINKS_STORAGE_KEY, true),
            collapsedResultCodes: readResultCodeList(COLLAPSED_RESULTS_STORAGE_KEY),
            expandedResultCodes: readResultCodeList(EXPANDED_RESULTS_STORAGE_KEY),
            resultViewModes: readResultViewModes()
        }),
    toggleResultCollapsed: (code) =>
        set((state) => {
            const collapsed = !state.collapsedResultCodes.includes(code);
            const collapsedResultCodes = collapsed ? [...state.collapsedResultCodes, code] : state.collapsedResultCodes.filter((item) => item !== code);
            const expandedResultCodes = collapsed
                ? state.expandedResultCodes.filter((item) => item !== code)
                : [...state.expandedResultCodes.filter((item) => item !== code), code];

            persistResultCodeList(COLLAPSED_RESULTS_STORAGE_KEY, collapsedResultCodes);
            persistResultCodeList(EXPANDED_RESULTS_STORAGE_KEY, expandedResultCodes);

            return { collapsedResultCodes, expandedResultCodes };
        }),
    setResultCollapsed: (code, collapsed) =>
        set((state) => {
            const collapsedResultCodes = collapsed
                ? [...state.collapsedResultCodes.filter((item) => item !== code), code]
                : state.collapsedResultCodes.filter((item) => item !== code);
            const expandedResultCodes = collapsed
                ? state.expandedResultCodes.filter((item) => item !== code)
                : [...state.expandedResultCodes.filter((item) => item !== code), code];

            persistResultCodeList(COLLAPSED_RESULTS_STORAGE_KEY, collapsedResultCodes);
            persistResultCodeList(EXPANDED_RESULTS_STORAGE_KEY, expandedResultCodes);

            return { collapsedResultCodes, expandedResultCodes };
        }),
    setResultViewMode: (code, mode) =>
        set((state) => {
            const resultViewModes = { ...state.resultViewModes, [code]: mode === 1 ? 1 : 0 };

            try {
                window.localStorage.setItem(RESULT_VIEW_MODES_STORAGE_KEY, JSON.stringify(resultViewModes));
            } catch {}

            return { resultViewModes };
        })
}));
