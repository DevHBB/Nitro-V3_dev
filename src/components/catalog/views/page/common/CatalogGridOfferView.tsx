import { FC } from 'react';
import { IPurchasableOffer } from '../../../../../api';
import { LayoutGridItemProps } from '../../../../../common';
import { useCatalogActions, useCatalogUiState, useInventoryFurni } from '../../../../../hooks';
import { CatalogOfferTileView } from './CatalogOfferTileView';

interface CatalogGridOfferViewProps extends LayoutGridItemProps {
    offer: IPurchasableOffer;
    selectOffer: (offer: IPurchasableOffer) => void;
    tintColor?: string;
}

export const CatalogGridOfferView: FC<CatalogGridOfferViewProps> = (props) => {
    const { requestOfferToMover = null } = useCatalogActions();
    const { currentType } = useCatalogUiState();
    const { isVisible: inventoryVisible = false } = useInventoryFurni();

    return (
        <CatalogOfferTileView
            {...props}
            requestOfferToMover={requestOfferToMover}
            currentType={currentType}
            inventoryVisible={inventoryVisible}
        />
    );
};
