import { RoomPreviewer } from '@nitrots/nitro-renderer';
import { FC, MouseEvent } from 'react';
import { FaExchangeAlt, FaRedo, FaSearchMinus, FaSearchPlus, FaUndo } from 'react-icons/fa';
import { ProductTypeEnum } from '../../../../../api';

interface CatalogPreviewControlsProps {
    productType: string;
    roomPreviewer: RoomPreviewer | null;
}

export const CatalogPreviewControls: FC<CatalogPreviewControlsProps> = ({ productType, roomPreviewer }) => {
    if (!roomPreviewer || productType === ProductTypeEnum.BADGE) return null;

    const runPreviewAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        action();
    };

    return (
        <div className="nitro-catalog-preview-controls" role="toolbar" aria-label="Product preview">
            <button
                aria-label="Rotate left"
                className="nitro-catalog-preview-btn"
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.changeRoomObjectDirection(false))}
            >
                <FaUndo aria-hidden="true" />
            </button>
            <button
                aria-label="Rotate right"
                className="nitro-catalog-preview-btn"
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.changeRoomObjectDirection(true))}
            >
                <FaRedo aria-hidden="true" />
            </button>
            <button
                aria-label="Change state"
                className="nitro-catalog-preview-btn"
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.changeRoomObjectState())}
            >
                <FaExchangeAlt aria-hidden="true" />
            </button>
            <button
                aria-label="Zoom in"
                className="nitro-catalog-preview-btn"
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.zoomIn())}
            >
                <FaSearchPlus aria-hidden="true" />
            </button>
            <button
                aria-label="Zoom out"
                className="nitro-catalog-preview-btn"
                type="button"
                onClick={(event) => runPreviewAction(event, () => roomPreviewer.zoomOut())}
            >
                <FaSearchMinus aria-hidden="true" />
            </button>
        </div>
    );
};
