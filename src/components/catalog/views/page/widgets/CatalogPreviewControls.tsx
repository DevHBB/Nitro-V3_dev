import { IRoomPreviewCapabilities, RoomPreviewer } from '@nitrots/nitro-renderer';
import { FC, MouseEvent, useCallback, useMemo, useSyncExternalStore } from 'react';
import { FaExchangeAlt, FaRedo, FaSearchMinus, FaSearchPlus, FaUndo } from 'react-icons/fa';
import { ProductTypeEnum } from '../../../../../api';

interface CatalogPreviewControlsProps {
    productType: string;
    roomPreviewer: RoomPreviewer | null;
}

type DirectionalRoomPreviewer = RoomPreviewer & {
    changeRoomObjectDirection(clockwise?: boolean): void;
    getPreviewCapabilities?(): IRoomPreviewCapabilities;
    subscribePreviewCapabilities?(listener: () => void): () => void;
};

const getFallbackCapabilities = (productType: string): IRoomPreviewCapabilities => {
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
            canRotate: false,
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

    if (!capabilities.canRotate && !capabilities.canChangeState && !capabilities.canZoomIn && !capabilities.canZoomOut) return null;

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
            {capabilities.canChangeState && (
                <button
                    aria-label="Change state"
                    className="nitro-catalog-preview-btn"
                    type="button"
                    onClick={(event) => runPreviewAction(event, () => roomPreviewer.changeRoomObjectState())}
                >
                    <FaExchangeAlt aria-hidden="true" />
                </button>
            )}
            <button
                aria-label="Zoom in"
                className="nitro-catalog-preview-btn"
                disabled={!capabilities.canZoomIn}
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.zoomIn())}
            >
                <FaSearchPlus aria-hidden="true" />
            </button>
            <button
                aria-label="Zoom out"
                className="nitro-catalog-preview-btn"
                disabled={!capabilities.canZoomOut}
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.zoomOut())}
            >
                <FaSearchMinus aria-hidden="true" />
            </button>
        </div>
    );
};

export const CatalogPreviewControls: FC<CatalogPreviewControlsProps> = ({ productType, roomPreviewer }) => {
    if (!roomPreviewer || productType === ProductTypeEnum.BADGE) return null;

    return <CatalogPreviewControlsContent productType={productType} roomPreviewer={roomPreviewer} />;
};
