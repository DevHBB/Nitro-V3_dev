import { GetAvatarRenderManager, GetSessionDataManager, Vector3d } from '@nitrots/nitro-renderer';
import { FC, useEffect } from 'react';
import { FurniCategory, Offer, ProductTypeEnum } from '../../../../../api';
import { AutoGrid, Column, LayoutGridItem, LayoutRoomPreviewerView } from '../../../../../common';
import { useCatalogData, useCatalogUiState } from '../../../../../hooks';

export const CatalogViewProductWidgetView: FC<{ height?: number }> = (props) => {
    const { height = 240 } = props;
    const { currentOffer = null, roomPreviewer = null } = useCatalogData();
    const { purchaseOptions = null } = useCatalogUiState();
    const { previewStuffData = null } = purchaseOptions;

    useEffect(() => {
        if (!currentOffer || currentOffer.pricingModel === Offer.PRICING_MODEL_BUNDLE || !roomPreviewer) return;

        const product = currentOffer.product;

        if (!product) return;

        roomPreviewer.reset(false);
        roomPreviewer.centerWallItems = true;
        roomPreviewer.setAutomaticStateChange(false);
        roomPreviewer.updateObjectRoom('111', '217', '1.1');
        roomPreviewer.updateRoomWallsAndFloorVisibility(true, true);

        let animateFurnitureState = false;

        const populate = () => {
            switch (product.productType) {
                case ProductTypeEnum.FLOOR: {
                    if (!product.furnitureData) return;

                    const furniData = GetSessionDataManager().getFloorItemData(product.furnitureData.id);
                    const isPurchasableClothing = product.furnitureData.specialType === FurniCategory.FIGURE_PURCHASABLE_SET;

                    if (isPurchasableClothing) {
                        const sessionDataManager = GetSessionDataManager();
                        const avatarRenderManager = GetAvatarRenderManager();
                        const customParams = furniData?.customParams ?? product.furnitureData.customParams ?? '';
                        const customParts = customParams
                            .split(',')
                            .map((value) => value.trim())
                            .filter((value) => /^\d+$/.test(value))
                            .map(Number);
                        const figureSets: number[] = [];

                        for (const part of customParts) {
                            if (!Number.isSafeInteger(part) || part <= 0) continue;

                            if (avatarRenderManager.isValidFigureSetForGender(part, sessionDataManager.gender)) figureSets.push(part);
                        }

                        const figureString = avatarRenderManager.getFigureStringWithFigureIds(sessionDataManager.figure, sessionDataManager.gender, figureSets);

                        roomPreviewer.addAvatarIntoRoom(figureString || sessionDataManager.figure, 0);
                        roomPreviewer.zoomIn();
                    } else {
                        roomPreviewer.addFurnitureIntoRoom(product.productClassId, new Vector3d(90), previewStuffData, product.extraParam);
                        animateFurnitureState = true;
                    }
                    return;
                }
                case ProductTypeEnum.WALL: {
                    if (!product.furnitureData) return;

                    roomPreviewer.updateRoomWallsAndFloorVisibility(true, true);

                    switch (product.furnitureData.specialType) {
                        case FurniCategory.FLOOR:
                            roomPreviewer.updateObjectRoom(product.extraParam);
                            return;
                        case FurniCategory.WALL_PAPER:
                            roomPreviewer.updateObjectRoom(null, product.extraParam);
                            return;
                        case FurniCategory.LANDSCAPE: {
                            roomPreviewer.updateObjectRoom(null, null, product.extraParam);

                            const furniData = GetSessionDataManager().getWallItemDataByName('window_double_default');

                            if (furniData) roomPreviewer.addWallItemIntoRoom(furniData.id, new Vector3d(90), furniData.customParams);
                            return;
                        }
                        default:
                            roomPreviewer.updateObjectRoom('101', '101', '1.1');
                            roomPreviewer.addWallItemIntoRoom(product.productClassId, new Vector3d(90), product.extraParam);
                            animateFurnitureState = true;
                            return;
                    }
                }
                case ProductTypeEnum.ROBOT:
                    roomPreviewer.addAvatarIntoRoom(product.extraParam, 0);
                    roomPreviewer.zoomIn();
                    return;
                case ProductTypeEnum.EFFECT:
                    roomPreviewer.addAvatarIntoRoom(GetSessionDataManager().figure, product.productClassId);
                    roomPreviewer.zoomIn();
                    return;
            }
        };

        populate();
        roomPreviewer.setAutomaticStateChange(animateFurnitureState);
    }, [currentOffer, previewStuffData, roomPreviewer]);

    if (!currentOffer) return null;

    if (currentOffer.pricingModel === Offer.PRICING_MODEL_BUNDLE) {
        return (
            <Column fit className="bg-muted p-2 rounded" overflow="hidden">
                <AutoGrid fullWidth className="nitro-catalog-layout-bundle-grid" columnCount={4}>
                    {currentOffer.products.length > 0 &&
                        currentOffer.products.map((product, index) => {
                            return <LayoutGridItem key={index} itemCount={product.productCount} itemImage={product.getIconUrl(currentOffer)} />;
                        })}
                </AutoGrid>
            </Column>
        );
    }

    return <LayoutRoomPreviewerView key={currentOffer?.offerId} height={height} roomPreviewer={roomPreviewer} />;
};
