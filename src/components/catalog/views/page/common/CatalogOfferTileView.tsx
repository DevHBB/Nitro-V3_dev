import { MouseEventType } from '@nitrots/nitro-renderer';
import { FC, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogType, GetConfigurationValue, IPurchasableOffer, Offer, ProductTypeEnum } from '../../../../../api';
import { LayoutAvatarImageView, LayoutGridItem, LayoutGridItemProps } from '../../../../../common';

export interface CatalogOfferTileViewProps extends LayoutGridItemProps {
    offer: IPurchasableOffer;
    selectOffer: (offer: IPurchasableOffer) => void;
    requestOfferToMover?: (offer: IPurchasableOffer) => void;
    currentType?: string;
    inventoryVisible?: boolean;
    readOnly?: boolean;
    tintColor?: string;
    showTechnicalDetails?: boolean;
    showPrices?: boolean;
}

export const CatalogOfferTileView: FC<CatalogOfferTileViewProps> = (props) => {
    const {
        offer = null,
        selectOffer = null,
        requestOfferToMover = null,
        currentType = CatalogType.NORMAL,
        inventoryVisible = false,
        readOnly = false,
        itemActive = false,
        tintColor = null,
        showTechnicalDetails = false,
        showPrices = true,
        ...rest
    } = props;
    const [isMouseDown, setMouseDown] = useState(false);
    const tileRef = useRef<HTMLDivElement>(null);
    const [iconVisible, setIconVisible] = useState(false);

    useEffect(() => {
        const element = tileRef.current;
        if (!element) return;
        if (typeof IntersectionObserver === 'undefined') {
            setIconVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIconVisible(true);
                    observer.disconnect();
                }
            },
            { root: element.closest('.nitro-catalog-default-layout, .nitro-catalog-window') ?? null, rootMargin: '120px' }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [offer?.offerId]);

    const resolvedIconUrl = useMemo(() => {
        if (!offer || offer.pricingModel === Offer.PRICING_MODEL_BUNDLE) return null;
        const product = offer.product;
        if (!product) return null;
        if (product.productType === ProductTypeEnum.FLOOR || product.productType === ProductTypeEnum.WALL) {
            const className = product.furnitureData?.className;
            if (className?.length) {
                let param = '';
                if (product.productType === ProductTypeEnum.WALL && product.extraParam?.length) param = `_${product.extraParam}`;
                else if (product.productType === ProductTypeEnum.FLOOR && product.furnitureData?.hasIndexedColor && product.furnitureData.colorIndex > 0) {
                    param = `_${product.furnitureData.colorIndex}`;
                }
                const configuredIconUrl = GetConfigurationValue<string>('furni.asset.icon.url', '');
                if (configuredIconUrl?.length) return configuredIconUrl.replace('%libname%', className).replace('%param%', param);
            }
        }
        return typeof product.getIconUrl === 'function' ? (product.getIconUrl(offer) ?? null) : null;
    }, [offer]);

    const prices = useMemo(() => {
        if (!offer) return [];
        const values: { amount: number; type: number }[] = [];
        if (offer.priceInCredits > 0) values.push({ amount: offer.priceInCredits, type: -1 });
        if (offer.priceInActivityPoints > 0) values.push({ amount: offer.priceInActivityPoints, type: offer.activityPointType });
        return values;
    }, [offer]);

    const getCurrencyIconUrl = (type: number) => (GetConfigurationValue<string>('currency.asset.icon.url', '') || '').replace('%type%', type.toString());

    const onMouseEvent = (event: MouseEvent) => {
        switch (event.type) {
            case MouseEventType.MOUSE_DOWN:
                selectOffer?.(offer);
                setMouseDown(true);
                return;
            case MouseEventType.MOUSE_UP:
                setMouseDown(false);
                return;
            case MouseEventType.ROLL_OUT:
                if (readOnly || !isMouseDown || !itemActive || currentType === CatalogType.BUILDER || !inventoryVisible) return;
                requestOfferToMover?.(offer);
                return;
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        selectOffer?.(offer);
    };

    if (!offer?.product) return null;
    const product = offer.product;
    const iconUrl = iconVisible ? resolvedIconUrl : null;

    return (
        <div
            ref={tileRef}
            aria-label={offer.localizationName || product.furnitureData?.name || ''}
            aria-selected={itemActive}
            role="option"
            tabIndex={0}
            title={showTechnicalDetails ? `ID: ${product.productClassId} | Offer: ${offer.offerId}` : offer.localizationName}
            onKeyDown={onKeyDown}
        >
            <LayoutGridItem
                className={`group/tile relative ${itemActive ? 'is-active' : ''}`}
                gap={1}
                itemActive={itemActive}
                itemCount={offer.pricingModel === Offer.PRICING_MODEL_MULTI ? product.productCount : 1}
                itemUniqueNumber={product.uniqueLimitedItemSeriesSize}
                itemUniqueSoldout={!!product.uniqueLimitedItemSeriesSize && !product.uniqueLimitedItemsLeft}
                onMouseDown={onMouseEvent}
                onMouseOut={onMouseEvent}
                onMouseUp={onMouseEvent}
                {...rest}
            >
                {iconUrl && product.productType !== ProductTypeEnum.ROBOT && (
                    <img
                        className="nitro-catalog-grid-offer-icon"
                        src={iconUrl}
                        draggable={false}
                        style={tintColor ? { filter: 'url(#guild-furni-recolor)', transform: 'translateZ(0)' } : undefined}
                        onError={(event) => {
                            const fallbackIconUrl = typeof product.getIconUrl === 'function' ? product.getIconUrl(offer) : null;
                            if (fallbackIconUrl && event.currentTarget.src !== fallbackIconUrl) event.currentTarget.src = fallbackIconUrl;
                        }}
                    />
                )}
                {product.productType === ProductTypeEnum.ROBOT && <LayoutAvatarImageView direction={2} figure={product.extraParam} fit />}
                {offer.clubLevel > 0 && (
                    <span aria-label="Habbo Club" className="nitro-catalog-grid-club-level" title="Habbo Club">
                        <i aria-hidden="true" className="nitro-icon icon-catalogue-hc_small" />
                    </span>
                )}
                {showPrices && prices.length > 0 && (
                    <span className={`nitro-catalog-grid-price ${prices.length > 1 ? 'is-multi-price' : 'is-single-price'}`}>
                        {prices.map((price, index) => (
                            <span key={`${price.type}-${index}`} className="nitro-catalog-grid-price-entry">
                                {index > 0 && <span className="nitro-catalog-grid-price-plus">+</span>}
                                <span className="nitro-catalog-grid-price-amount">{price.amount}</span>
                                {!!getCurrencyIconUrl(price.type) && (
                                    <img className="nitro-catalog-grid-price-currency" src={getCurrencyIconUrl(price.type)} draggable={false} />
                                )}
                            </span>
                        ))}
                    </span>
                )}
            </LayoutGridItem>
        </div>
    );
};
