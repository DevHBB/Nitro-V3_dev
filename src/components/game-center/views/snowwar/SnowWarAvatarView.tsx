import { AvatarAction, AvatarScaleType, AvatarSetType, GetAvatarRenderManager } from '@nitrots/nitro-renderer';
import { CSSProperties, FC, useEffect, useRef, useState } from 'react';
import { LayoutAvatarImageView } from '../../../../common';

const WALK_FRAME_COUNT = 4;
const WALK_FRAME_MS = 120;

// figure|gender|direction -> { walk: 4 posture frames, throwFrames: 2 arm poses }
const POSE_CACHE: Map<string, { walk: string[]; throwFrames: string[] }> = new Map();
const POSE_CACHE_MAX = 64;

interface SnowWarAvatarViewProps
{
    figure: string;
    gender: string;
    direction: number;
    walking: boolean;
    throwing?: boolean;
    // 0..1 across the throw window; drives a single arm-up -> arm-down motion.
    throwProgress?: number;
    frameNow: number;
    scale?: number;
}

/**
 * Arena avatar with a real walk cycle and a throw arm-cycle. Throwing cycles
 * two right-hand poses (SnowWarThrow 'swthrow' = arm cocked, SnowWarPick
 * 'swpick' = arm forward) off the arena's rAF clock, the same way walking
 * cycles the 'mv' posture frames; standing falls back to the shared static
 * LayoutAvatarImageView, whose canvas geometry is identical so switching poses
 * never shifts the sprite.
 */
export const SnowWarAvatarView: FC<SnowWarAvatarViewProps> = (props) =>
{
    const { figure, gender, direction, walking, throwing = false, throwProgress = 0, frameNow, scale = 1 } = props;
    const [pose, setPose] = useState<{ walk: string[]; throwFrames: string[] }>(null);
    const isDisposed = useRef(false);
    const requestIdRef = useRef(0);

    useEffect(() =>
    {
        isDisposed.current = false;

        const requestId = ++requestIdRef.current;
        const cacheKey = [figure, gender, direction].join('|');

        const cached = POSE_CACHE.get(cacheKey);
        if (cached)
        {
            setPose(cached);
            return;
        }

        // Keep the previous frames visible while the new direction regenerates
        // (don't blank to null) so a throw's facing change can't drop the avatar
        // back to the static standing image mid-animation.

        // Same reset/retry contract as LayoutAvatarImageView: the first pass
        // may render placeholders while figure assets download; resetFigure
        // fires again once they land and the real frames replace them.
        const renderFrames = (renderFigure: string) =>
        {
            if (isDisposed.current || (requestIdRef.current !== requestId)) return;

            const avatarImage = GetAvatarRenderManager().createAvatarImage(renderFigure, AvatarScaleType.LARGE, gender, {
                resetFigure: (updatedFigure: string) => renderFrames(updatedFigure),
                dispose: null,
                disposed: false
            });

            if (!avatarImage) return;

            // Renders one still with the given action appended over the default
            // stand. initActionAppends clears the prior pass's actions; the
            // default (std, main) posture still supplies the body. `param` is
            // the item-id for CARRY_OBJECT/USE_OBJECT (which actually raise the
            // right arm, unlike the swthrow posture whose frame-0 sits at rest),
            // or undefined for a plain POSTURE like std.
            const renderPose = (actionType: string, param?: string): string =>
            {
                avatarImage.initActionAppends();
                avatarImage.setDirection(AvatarSetType.FULL, direction);
                if (param !== undefined) avatarImage.appendAction(actionType, param);
                else avatarImage.appendAction(AvatarAction.POSTURE, actionType);
                avatarImage.resetAnimationFrameCounter();
                avatarImage.updateAnimationByFrames(0);
                return avatarImage.processAsImageUrl(AvatarSetType.FULL);
            };

            // Walk cycle: 'mv' posture across WALK_FRAME_COUNT frames.
            avatarImage.initActionAppends();
            avatarImage.setDirection(AvatarSetType.FULL, direction);
            avatarImage.appendAction(AvatarAction.POSTURE, AvatarAction.POSTURE_WALK);

            const walk: string[] = [];

            for (let frame = 0; frame < WALK_FRAME_COUNT; frame++)
            {
                avatarImage.resetAnimationFrameCounter();
                avatarImage.updateAnimationByFrames(frame);
                walk.push(avatarImage.processAsImageUrl(AvatarSetType.FULL));
            }

            // Throw poses: [0] arm up (CarryItem raises the right arm - STATIC,
            // frame 0 already arm-up), [1] arm down (std). Item id '999999999'
            // maps to carry value -1, which has no held sprite in any direction
            // (h_crr_ri_-1_* doesn't exist), so the arm raises with an empty
            // hand - no leftover cup/can. Selected by throwProgress for a single
            // up->down motion (not a loop).
            const throwFrames = [renderPose(AvatarAction.CARRY_OBJECT, '999999999'), renderPose(AvatarAction.POSTURE_STAND)];

            const isPlaceholder = avatarImage.isPlaceholder();

            avatarImage.dispose();

            if (isDisposed.current || (requestIdRef.current !== requestId)) return;
            if (walk.some(url => !url) || throwFrames.some(url => !url)) return;

            const rendered = { walk, throwFrames };

            if (!isPlaceholder)
            {
                if (POSE_CACHE.size >= POSE_CACHE_MAX)
                {
                    const firstKey = POSE_CACHE.keys().next().value;
                    POSE_CACHE.delete(firstKey);
                }

                POSE_CACHE.set(cacheKey, rendered);
            }

            setPose(rendered);
        };

        renderFrames(figure);

        return () =>
        {
            isDisposed.current = true;
        };
    }, [figure, gender, direction]);

    // Standing (and while frames still download) uses the shared static imager.
    if ((!walking && !throwing) || !pose)
    {
        return <LayoutAvatarImageView direction={direction} figure={figure} gender={gender} scale={scale} />;
    }

    const frameUrl = throwing
        ? pose.throwFrames[throwProgress < 0.5 ? 0 : 1] // single arm-up -> arm-down
        : pose.walk[Math.floor(frameNow / WALK_FRAME_MS) % WALK_FRAME_COUNT];

    const style: CSSProperties = { backgroundImage: `url('${frameUrl}')` };

    if (scale !== 1)
    {
        style.transform = `scale(${scale})`;
        if (!(scale % 1)) style.imageRendering = 'pixelated';
    }

    return <div className="avatar-image relative w-[90px] h-[130px] bg-no-repeat left-[-2px] pointer-events-none" style={style} />;
};
