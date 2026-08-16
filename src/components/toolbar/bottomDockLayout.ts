export interface BottomDockMeasurements {
    viewportWidth: number;
    leftEdge: number;
    rightEdge: number;
    chatWidth?: number;
}

export interface BottomDockLayout {
    chatRaised: boolean;
    chatBottom: number;
    /** null keeps the frame's own centering; a number pins the frame's left edge. */
    chatLeft: number | null;
}

const AIR_CHAT_WIDTH = 466;
const AIR_RAIL_CLEARANCE = 8;
const AIR_DOCKED_CHAT_BOTTOM = 7;
const AIR_RAISED_CHAT_BOTTOM = 65;
const AIR_FRIEND_TAB_WIDTH = 127;
const AIR_FRIEND_BAR_EDGE_PADDING = 16;

export const resolveBottomDockLayout = (measurements: BottomDockMeasurements): BottomDockLayout => {
    const chatWidth = Math.max(1, measurements.chatWidth ?? AIR_CHAT_WIDTH);
    const centeredLeft = (measurements.viewportWidth - chatWidth) / 2;
    const centeredRight = centeredLeft + chatWidth;
    const availableWidth = Math.max(0, measurements.rightEdge - measurements.leftEdge);
    const canCenter =
        centeredLeft >= measurements.leftEdge + AIR_RAIL_CLEARANCE &&
        centeredRight <= measurements.rightEdge - AIR_RAIL_CLEARANCE;

    if (canCenter) {
        return { chatRaised: false, chatBottom: AIR_DOCKED_CHAT_BOTTOM, chatLeft: null };
    }

    if (availableWidth >= chatWidth + (AIR_RAIL_CLEARANCE * 2)) {
        const minLeft = measurements.leftEdge + AIR_RAIL_CLEARANCE;
        const maxLeft = measurements.rightEdge - AIR_RAIL_CLEARANCE - chatWidth;

        return {
            chatRaised: false,
            chatBottom: AIR_DOCKED_CHAT_BOTTOM,
            chatLeft: Math.round(Math.min(Math.max(centeredLeft, minLeft), maxLeft))
        };
    }

    return {
        chatRaised: true,
        chatBottom: AIR_RAISED_CHAT_BOTTOM,
        chatLeft: null
    };
};

export const resolveAirFriendTabCapacity = (availableWidth: number, toolsWidth = 0, spacing = 1): number => {
    const usableWidth = Math.max(0, availableWidth - toolsWidth - AIR_FRIEND_BAR_EDGE_PADDING);

    return Math.max(1, Math.floor(usableWidth / (AIR_FRIEND_TAB_WIDTH + Math.max(0, spacing))));
};
