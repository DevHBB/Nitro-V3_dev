import { AnimatePresence, motion, Variants } from 'framer-motion';
import { FC, useLayoutEffect, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { LocalizeText, localizeWithFallback, MessengerFriend } from '../../../../api';
import { resolveAirFriendTabCapacity } from '../../../toolbar/bottomDockLayout';
import { FriendBarItemView } from './FriendBarItemView';

// AIR uses 127px friend tabs and derives the visible count from the actual
// width left after the toolbar controls.
const AIR_TAB_WIDTH = 127;
const AIR_TAB_SPACING = 6;
const ARROWS_WIDTH = 52; // two w-[20px] arrows, each + 6px gap
const BASE_PAD = 8; // container px-[2px] + a little slack
const RIGHT_SAFE = 24; // right inset (right-0/right-3) + pr-3 safety margin

// Mirrored from Toolbar to keep physics identical
const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
    exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 22 } },
    exit: { opacity: 0, y: 6, scale: 0.85, transition: { duration: 0.1 } }
};

export const FriendBarView: FC<{ onlineFriends: MessengerFriend[]; requestsCount?: number }> = (props) => {
    const { onlineFriends = [], requestsCount = 0 } = props;
    const [indexOffset, setIndexOffset] = useState(0);
    const [maxVisible, setMaxVisible] = useState(1);
    const elementRef = useRef<HTMLDivElement>(null);

    // Auto-fit the visible friend count to the room actually available between
    // the bar's left edge and the right side of the viewport. The bar lives in
    // a `overflow-x: clip` toolbar slot, so anything that doesn't fit would be
    // silently cut off (the scroll arrow / search button disappear). The bar's
    // left edge is stable (it sits after fixed-width toolbar icons), so growing
    // or shrinking the chip count never moves it — no measurement feedback loop.
    useLayoutEffect(() => {
        const element = elementRef.current;

        if (!element) return;

        const measure = () => {
            const left = element.getBoundingClientRect().left;
            const available = window.innerWidth - left - RIGHT_SAFE;
            const searchAndRequestWidth = AIR_TAB_WIDTH + BASE_PAD + (requestsCount > 0 ? (AIR_TAB_WIDTH + AIR_TAB_SPACING) : 0);
            const capacityWithoutArrows = resolveAirFriendTabCapacity(available, searchAndRequestWidth, AIR_TAB_SPACING);
            const friendCount = onlineFriends.filter(Boolean).length;
            const needsArrows = friendCount > capacityWithoutArrows;
            const next = resolveAirFriendTabCapacity(
                available,
                searchAndRequestWidth + (needsArrows ? ARROWS_WIDTH : 0),
                AIR_TAB_SPACING
            );

            setMaxVisible((prev) => (prev === next ? prev : next));
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(document.documentElement);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [requestsCount, onlineFriends.length]);

    // `safeOffset` is the offset clamped to the current list/fit. Every read
    // below uses it, so a stale `indexOffset` (after the list shrinks or the fit
    // grows) renders correctly and self-corrects on the next arrow click — no
    // write-back effect needed.
    // Defensive: never let a null/undefined slip into the friend map. The
    // legacy bar padded empty slots with `null` and rendered each as a
    // FriendBarItemView (which falls back to the "find friends" chip), so an
    // empty list produced THREE "Trova Amici" buttons. Filtering here makes the
    // search chip below the ONLY source of that affordance — exactly one, always.
    const validFriends = onlineFriends.filter(Boolean);
    const maxOffset = Math.max(0, validFriends.length - maxVisible);
    const safeOffset = Math.min(indexOffset, maxOffset);
    const canScrollLeft = safeOffset > 0;
    const canScrollRight = safeOffset < maxOffset;
    const showArrows = maxOffset > 0;
    const visibleFriends = validFriends.slice(safeOffset, safeOffset + maxVisible);

    return (
        <motion.div
            ref={elementRef}
            className="friend-bar flex h-[40px] items-center gap-[6px] px-[2px] py-[3px]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            {requestsCount > 0 && (
                <motion.div variants={itemVariants}>
                    <div className="friend-bar-item friend-bar-request find-friends-active flex h-[34px] items-center px-[10px] text-[0.83rem] whitespace-nowrap text-white">
                        {requestsCount} {LocalizeText('friendbar.requests.title')}
                    </div>
                </motion.div>
            )}
            {showArrows && (
                <motion.div variants={itemVariants}>
                    <button
                        type="button"
                        disabled={!canScrollLeft}
                        aria-label={localizeWithFallback('friendbar.scroll.left', 'Previous friends')}
                        className={`friend-bar-button left flex h-[34px] w-[20px] items-center justify-center text-white/80 transition-opacity ${!canScrollLeft ? 'is-disabled opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-white'}`}
                        onClick={() => setIndexOffset(safeOffset - 1)}
                    >
                        <FaChevronLeft className="friend-bar-chevron text-white/70 text-sm drop-shadow-[1px_1px_0_#000]" />
                    </button>
                </motion.div>
            )}

            <AnimatePresence mode="popLayout">
                {visibleFriends.map((friend) => (
                    <motion.div key={friend.id} variants={itemVariants} layout initial="hidden" animate="visible" exit="exit">
                        <FriendBarItemView friend={friend} />
                    </motion.div>
                ))}
                <motion.div key="friend-search" variants={itemVariants} layout initial="hidden" animate="visible" exit="exit">
                    <FriendBarItemView friend={null} />
                </motion.div>
            </AnimatePresence>

            {showArrows && (
                <motion.div variants={itemVariants}>
                    <button
                        type="button"
                        disabled={!canScrollRight}
                        aria-label={localizeWithFallback('friendbar.scroll.right', 'Next friends')}
                        className={`friend-bar-button right flex h-[34px] w-[20px] items-center justify-center text-white/80 transition-opacity ${!canScrollRight ? 'is-disabled opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-white'}`}
                        onClick={() => setIndexOffset(safeOffset + 1)}
                    >
                        <FaChevronRight className="friend-bar-chevron text-white/70 text-sm drop-shadow-[1px_1px_0_#000]" />
                    </button>
                </motion.div>
            )}
        </motion.div>
    );
};
