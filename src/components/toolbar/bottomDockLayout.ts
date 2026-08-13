export interface BottomDockMeasurements {
    viewportWidth: number;
    leftEdge: number;
    rightEdge: number;
    chatWidth?: number;
    roomToolsBottom?: number;
}

export interface BottomDockLayout {
    chatRaised: boolean;
    chatBottom: number;
}

const AIR_CHAT_WIDTH = 466;
const AIR_DOCK_GAP = 12;
const AIR_LEFT_CHAT_SAFETY = 100;
const AIR_DOCKED_CHAT_BOTTOM = 7;
const AIR_RAISED_CHAT_BOTTOM = 66;
const AIR_FRIEND_TAB_WIDTH = 127;
const AIR_FRIEND_BAR_EDGE_PADDING = 16;

export const resolveBottomDockLayout = (measurements: BottomDockMeasurements): BottomDockLayout => {
    const chatWidth = Math.max(1, measurements.chatWidth ?? AIR_CHAT_WIDTH);
    const centeredLeft = (measurements.viewportWidth - chatWidth) / 2;
    const centeredRight = centeredLeft + chatWidth;
    const availableWidth = Math.max(0, measurements.rightEdge - measurements.leftEdge);
    const canDock =
        availableWidth > chatWidth + AIR_DOCK_GAP &&
        centeredLeft >= measurements.leftEdge + AIR_DOCK_GAP + AIR_LEFT_CHAT_SAFETY &&
        centeredRight <= measurements.rightEdge - AIR_DOCK_GAP;

    return {
        chatRaised: !canDock,
        chatBottom: canDock ? AIR_DOCKED_CHAT_BOTTOM : Math.max(AIR_RAISED_CHAT_BOTTOM, (measurements.roomToolsBottom ?? 0) + AIR_DOCK_GAP)
    };
};

export const resolveAirFriendTabCapacity = (availableWidth: number, toolsWidth = 0, spacing = 1): number => {
    const usableWidth = Math.max(0, availableWidth - toolsWidth - AIR_FRIEND_BAR_EDGE_PADDING);

    return Math.max(1, Math.floor(usableWidth / (AIR_FRIEND_TAB_WIDTH + Math.max(0, spacing))));
};
