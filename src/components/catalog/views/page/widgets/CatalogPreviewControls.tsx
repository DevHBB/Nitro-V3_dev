import { RoomPreviewer } from '@nitrots/nitro-renderer';
import { FC, MouseEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { FaRedo, FaSearchMinus, FaSearchPlus, FaUndo } from 'react-icons/fa';
import { ProductTypeEnum } from '../../../../../api';

interface CatalogPreviewControlsProps {
    productType: string;
    roomPreviewer: RoomPreviewer | null;
}

type DirectionalRoomPreviewer = RoomPreviewer & {
    changeRoomObjectDirection(clockwise?: boolean): void;
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

const getFallbackCapabilities = (productType: string): PreviewCapabilities => {
    if (productType === ProductTypeEnum.FLOOR || productType === ProductTypeEnum.WALL) {
        return {
            mode: productType === ProductTypeEnum.FLOOR ? 'floor' : 'wall',
            canRotate: true,
            canChangeState: true,
            canUseAvatarActions: false,
            canZoomIn: true,
            canZoomOut: true
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
    const hasCapabilityContract = !!directionalPreviewer.getPreviewCapabilities;
    const [fallbackZoomedOut, setFallbackZoomedOut] = useState(false);
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
    const canToggleZoom = capabilities.canZoomIn || capabilities.canZoomOut;
    const shouldZoomOut = hasCapabilityContract ? capabilities.canZoomOut : !fallbackZoomedOut;

    useEffect(() => setFallbackZoomedOut(false), [directionalPreviewer, productType]);

    if (!capabilities.canRotate && !canToggleZoom) return null;

    const runPreviewAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    return (
        <div className="nitro-catalog-preview-controls" role="toolbar" aria-label="Product preview">
            {capabilities.canRotate && (
                <>
                    <button
                        aria-label="Rotate left"
                        className="nitro-catalog-preview-btn"
                        type="button"
                        onClick={(event) => runPreviewAction(event, () => directionalPreviewer.changeRoomObjectDirection(false))}
                    >
                        <FaUndo aria-hidden="true" />
                    </button>
                    <button
                        aria-label="Rotate right"
                        className="nitro-catalog-preview-btn"
                        type="button"
                        onClick={(event) => runPreviewAction(event, () => directionalPreviewer.changeRoomObjectDirection(true))}
                    >
                        <FaRedo aria-hidden="true" />
                    </button>
                </>
            )}
            {canToggleZoom && (
                <button
                    aria-label="Toggle zoom"
                    className="nitro-catalog-preview-btn"
                    type="button"
                    onClick={(event) =>
                        runPreviewAction(event, () => {
                            if (shouldZoomOut) roomPreviewer.zoomOut();
                            else roomPreviewer.zoomIn();

                            if (!hasCapabilityContract) setFallbackZoomedOut(shouldZoomOut);
                        })
                    }
                >
                    {shouldZoomOut ? <FaSearchMinus aria-hidden="true" /> : <FaSearchPlus aria-hidden="true" />}
                </button>
            )}
        </div>
    );
};

export const CatalogPreviewControls: FC<CatalogPreviewControlsProps> = ({ productType, roomPreviewer }) => {
    if (!roomPreviewer || productType === ProductTypeEnum.BADGE) return null;

    return <CatalogPreviewControlsContent productType={productType} roomPreviewer={roomPreviewer} />;
};
