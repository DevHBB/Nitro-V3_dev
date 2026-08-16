import { FC } from 'react';
import { GetConfigurationValue, LocalizeText, ProductTypeEnum, SanitizeHtml } from '../../../../../api';
import { Text } from '../../../../../common';
import { getCatalogGridMetrics, useCatalogData, useCatalogDisplayPreferences } from '../../../../../hooks';
import { CatalogHeaderView } from '../../catalog-header/CatalogHeaderView';
import { CatalogAddOnBadgeWidgetView } from '../widgets/CatalogAddOnBadgeWidgetView';
import { CatalogItemGridWidgetView } from '../widgets/CatalogItemGridWidgetView';
import { CatalogLimitedItemWidgetView } from '../widgets/CatalogLimitedItemWidgetView';
import { CatalogPreviewControls } from '../widgets/CatalogPreviewControls';
import { CatalogProductDetailsView } from '../widgets/CatalogProductDetailsView';
import { CatalogPurchaseSelectionPrompt } from '../widgets/CatalogPurchaseSelectionPrompt';
import { CatalogPurchaseWidgetView } from '../widgets/CatalogPurchaseWidgetView';
import { CatalogSpinnerWidgetView } from '../widgets/CatalogSpinnerWidgetView';
import { CatalogTotalPriceWidget } from '../widgets/CatalogTotalPriceWidget';
import { CatalogViewProductWidgetView } from '../widgets/CatalogViewProductWidgetView';
import { CatalogLayoutProps } from './CatalogLayout.types';

export const CatalogLayoutDefaultView: FC<CatalogLayoutProps> = (props) => {
    const { page = null } = props;
    const { currentOffer = null, currentPage = null, roomPreviewer = null } = useCatalogData();
    const { density = 'standard', showTilePrices = true } = useCatalogDisplayPreferences();
    const gridMetrics = getCatalogGridMetrics(density);

    return (
        <div className="nitro-catalog-default-layout flex flex-col h-full gap-2">
            <div className="nitro-catalog-product-view">
                {currentOffer && (
                    <div className="nitro-catalog-offer-panel flex gap-0">
                        <div
                            className={`nitro-catalog-offer-preview relative flex items-center justify-center ${currentOffer.product.productType === ProductTypeEnum.BADGE ? 'is-badge' : ''}`}
                        >
                            <div className="nitro-catalog-preview-details">
                                <CatalogProductDetailsView offer={currentOffer} />
                            </div>
                            <div className="nitro-catalog-preview-limited">
                                <CatalogLimitedItemWidgetView />
                            </div>
                            {currentOffer.product.productType !== ProductTypeEnum.BADGE && (
                                <>
                                    <CatalogPreviewControls productType={currentOffer.product.productType} roomPreviewer={roomPreviewer} />
                                    <CatalogViewProductWidgetView />
                                    <CatalogAddOnBadgeWidgetView className="bg-muted rounded bottom-1 right-1 absolute" />
                                </>
                            )}
                            {currentOffer.product.productType === ProductTypeEnum.BADGE && <CatalogAddOnBadgeWidgetView className="scale-200" />}
                        </div>
                    </div>
                )}

                {!currentOffer && (
                    <div className="nitro-catalog-welcome flex items-center gap-3">
                        {!!page.localization.getImage(1) && (
                            <img alt="" className="w-[70px] h-[70px] object-contain rounded shrink-0" src={page.localization.getImage(1)} />
                        )}
                        <Text className="text-[11px]! text-muted" dangerouslySetInnerHTML={{ __html: SanitizeHtml(page.localization.getText(0)) }} />
                    </div>
                )}
            </div>

            <div className="nitro-catalog-grid-shell flex-1 overflow-auto min-h-0">
                {GetConfigurationValue('catalog.headers') && <CatalogHeaderView imageUrl={currentPage.localization.getImage(0)} />}
                <CatalogItemGridWidgetView
                    className={`nitro-catalog-grid nitro-catalog-grid-density-${density}`}
                    showPrices={showTilePrices}
                    {...gridMetrics}
                />
            </div>

            {currentOffer && (
                <div className="nitro-catalog-price-row flex items-center justify-between gap-2">
                    <div className="nitro-catalog-spinner-slot">
                        <CatalogSpinnerWidgetView />
                    </div>
                    <div className="nitro-catalog-total-price-slot">
                        <span className="nitro-catalog-total-price-label">{LocalizeText('catalog.bundlewidget.price')}</span>
                        <CatalogTotalPriceWidget />
                    </div>
                </div>
            )}

            <div className="nitro-catalog-purchase-row flex items-start justify-end">
                {currentOffer ? (
                    <div className="nitro-catalog-offer-actions flex gap-1.5">
                        <CatalogPurchaseWidgetView />
                    </div>
                ) : (
                    <CatalogPurchaseSelectionPrompt />
                )}
            </div>
        </div>
    );
};
