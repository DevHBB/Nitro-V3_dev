export interface CatalogScrollbarMetrics {
    overflow: boolean;
    thumbSize: number;
    thumbOffset: number;
}

export const getCatalogScrollbarMetrics = (
    scrollHeight: number,
    clientHeight: number,
    trackHeight: number,
    scrollTop: number
): CatalogScrollbarMetrics => {
    if (scrollHeight <= clientHeight || clientHeight <= 0 || trackHeight <= 0) {
        return { overflow: false, thumbSize: Math.max(0, trackHeight), thumbOffset: 0 };
    }

    const thumbSize = Math.max(12, Math.min(trackHeight, Math.round((trackHeight * clientHeight) / scrollHeight)));
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbOffset = trackHeight - thumbSize;
    const normalizedScrollTop = Math.max(0, Math.min(maxScroll, scrollTop));

    return {
        overflow: true,
        thumbSize,
        thumbOffset: Math.round((normalizedScrollTop / maxScroll) * maxThumbOffset)
    };
};
