import { RoomPreviewer } from '@nitrots/nitro-renderer';
import { FC, MouseEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ProductTypeEnum } from '../../../../../api';

interface CatalogPreviewControlsProps {
    productType: string;
    roomPreviewer: RoomPreviewer | null;
}

type DirectionalRoomPreviewer = RoomPreviewer & {
    changeRoomObjectDirection(clockwise?: boolean): void;
    cycleAvatarAction?(): void;
    getPreviewCapabilities?(): PreviewCapabilities;
    subscribePreviewCapabilities?(listener: () => void): () => void;
};

interface PreviewCapabilities {
    mode: 'none' | 'floor' | 'wall' | 'avatar' | 'pet';
    canRotate: boolean;
    canChangeState: boolean;
    canUseAvatarActions: boolean;
    canZoomIn: boolean;
    canZoomOut: boolean;
}

const CatalogPreviewArrowIcon: FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
    <svg aria-hidden="true" className="nitro-catalog-preview-arrow" shapeRendering="crispEdges" viewBox="0 0 13 13">
        <path
            d="M6 0h1v4h6v5H7v4H6v-1H5v-1H4v-1H3V9H2V8H1V7H0V6h1V5h1V4h1V3h1V2h1V1h1Z"
            transform={direction === 'right' ? 'translate(13 0) scale(-1 1)' : undefined}
        />
    </svg>
);

const getFallbackCapabilities = (productType: string): PreviewCapabilities => {
    if (productType === ProductTypeEnum.FLOOR || productType === ProductTypeEnum.WALL) {
        return {
            mode: productType === ProductTypeEnum.FLOOR ? 'floor' : 'wall',
            canRotate: true,
            canChangeState: true,
            canUseAvatarActions: false,
            canZoomIn: false,
            canZoomOut: false
        };
    }

    if (productType === ProductTypeEnum.EFFECT || productType === ProductTypeEnum.ROBOT) {
        return {
            mode: 'avatar',
            canRotate: true,
            canChangeState: false,
            canUseAvatarActions: true,
            canZoomIn: true,
            canZoomOut: true
        };
    }

    if (productType === ProductTypeEnum.PET) {
        return {
            mode: 'pet',
            canRotate: false,
            canChangeState: false,
            canUseAvatarActions: false,
            canZoomIn: true,
            canZoomOut: true
        };
    }

    return {
        mode: 'none',
        canRotate: false,
        canChangeState: false,
        canUseAvatarActions: false,
        canZoomIn: false,
        canZoomOut: false
    };
};

const CatalogPreviewControlsContent: FC<Required<CatalogPreviewControlsProps>> = ({ productType, roomPreviewer }) => {
    const directionalPreviewer = roomPreviewer as DirectionalRoomPreviewer;
    const [avatarZoomed, setAvatarZoomed] = useState(true);
    const fallbackCapabilities = useMemo(() => getFallbackCapabilities(productType), [productType]);
    const subscribe = useCallback(
        (listener: () => void) => directionalPreviewer.subscribePreviewCapabilities?.(listener) ?? (() => undefined),
        [directionalPreviewer]
    );
    const getSnapshot = useCallback(
        () => directionalPreviewer.getPreviewCapabilities?.() ?? fallbackCapabilities,
        [directionalPreviewer, fallbackCapabilities]
    );
    const capabilities = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const isAvatarPreview = capabilities.mode === 'avatar';
    const showRotationControls = isAvatarPreview || capabilities.mode === 'floor' || (capabilities.mode === 'wall' && capabilities.canRotate);
    const canToggleZoom = isAvatarPreview && (capabilities.canZoomIn || capabilities.canZoomOut);
    const canChangeAvatarAction = isAvatarPreview && capabilities.canUseAvatarActions && !!directionalPreviewer.cycleAvatarAction;

    useEffect(() => setAvatarZoomed(true), [directionalPreviewer, productType]);

    if (!showRotationControls && !canToggleZoom && !canChangeAvatarAction) return null;

    const runPreviewAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    return (
        <div className={`nitro-catalog-preview-controls is-${capabilities.mode}`} role="toolbar" aria-label="Product preview">
            {showRotationControls && (
                <>
                    <button
                        aria-label="Rotate left"
                        className="nitro-catalog-preview-btn is-left"
                        disabled={!capabilities.canRotate}
                        type="button"
                        onClick={(event) => runPreviewAction(event, () => directionalPreviewer.changeRoomObjectDirection(false))}
                    >
                        <CatalogPreviewArrowIcon direction="left" />
                    </button>
                    <button
                        aria-label="Rotate right"
                        className="nitro-catalog-preview-btn is-right"
                        disabled={!capabilities.canRotate}
                        type="button"
                        onClick={(event) => runPreviewAction(event, () => directionalPreviewer.changeRoomObjectDirection(true))}
                    >
                        <CatalogPreviewArrowIcon direction="right" />
                    </button>
                </>
            )}
            {canToggleZoom && (
                <button
                    aria-label="Toggle zoom"
                    aria-pressed={avatarZoomed}
                    className="nitro-catalog-preview-region nitro-catalog-preview-zoom-btn"
                    type="button"
                    onClick={(event) => runPreviewAction(event, () => setAvatarZoomed((value) => !value))}
                >
                    <i aria-hidden="true" className="nitro-icon icon-zoom-more" />
                </button>
            )}
            {isAvatarPreview && (
                <button
                    aria-label="Change avatar action"
                    className="nitro-catalog-preview-region nitro-catalog-preview-action-btn"
                    disabled={!canChangeAvatarAction}
                    type="button"
                    onClick={(event) => runPreviewAction(event, () => directionalPreviewer.cycleAvatarAction?.())}
                >
                    <span aria-hidden="true" className="nitro-catalog-preview-action-icon" />
                </button>
            )}
        </div>
    );
};

export const CatalogPreviewControls: FC<CatalogPreviewControlsProps> = ({ productType, roomPreviewer }) => {
    if (!roomPreviewer || productType === ProductTypeEnum.BADGE) return null;

    return <CatalogPreviewControlsContent productType={productType} roomPreviewer={roomPreviewer} />;
};
