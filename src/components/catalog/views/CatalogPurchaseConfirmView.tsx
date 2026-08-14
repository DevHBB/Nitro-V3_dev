import { FC, KeyboardEvent, useEffect, useRef } from 'react';
import { IPurchasableOffer, LocalizeText } from '../../../api';
import { LayoutCurrencyIcon } from '../../../common';

interface CatalogPurchaseConfirmViewProps {
    offer: IPurchasableOffer;
    quantity: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export const CatalogPurchaseConfirmView: FC<CatalogPurchaseConfirmViewProps> = (props) => {
    const { offer = null, quantity = 1, onConfirm = null, onCancel = null } = props;
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        dialogRef.current?.focus();

        return () => {
            if (previousActiveElement?.isConnected) previousActiveElement.focus();
        };
    }, []);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onCancel?.();

            return;
        }

        if (event.key !== 'Tab' || !dialogRef.current) return;

        const focusableElements = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        );

        if (!focusableElements.length) {
            event.preventDefault();

            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    if (!offer) return null;

    const credits = offer.priceInCredits * quantity;
    const activityPoints = offer.priceInActivityPoints * quantity;
    const title = LocalizeText('catalog.purchase_confirmation.title');
    const iconUrl = typeof offer.product?.getIconUrl === 'function' ? offer.product.getIconUrl(offer) : null;

    return (
        <div className="nitro-catalog-purchase-confirm-backdrop" role="presentation">
            <div
                ref={dialogRef}
                aria-labelledby="catalog-purchase-confirm-title"
                aria-modal="true"
                className="nitro-catalog-purchase-confirm"
                role="dialog"
                tabIndex={-1}
                onKeyDown={onKeyDown}
            >
                <div className="nitro-catalog-purchase-confirm-title" id="catalog-purchase-confirm-title">
                    {title}
                </div>
                <div className="nitro-catalog-purchase-confirm-content">
                    <div className="nitro-catalog-purchase-confirm-preview">{!!iconUrl && <img alt={offer.localizationName} src={iconUrl} />}</div>
                    <div className="nitro-catalog-purchase-confirm-properties">
                        <div className="nitro-catalog-purchase-confirm-product">
                            <strong>{offer.localizationName}</strong>
                            {!!offer.localizationDescription && <span>{offer.localizationDescription}</span>}
                        </div>
                        <div className="nitro-catalog-purchase-confirm-quantity">
                            <span>{LocalizeText('catalog.bundlewidget.quantity')}</span>
                            <strong>× {quantity}</strong>
                        </div>
                        {offer.product?.isUniqueLimitedItem && (
                            <div className="nitro-catalog-purchase-confirm-limited">
                                <span>{LocalizeText('catalog.limited.items.left')}</span>
                                <strong>
                                    {offer.product.uniqueLimitedItemsLeft} / {offer.product.uniqueLimitedItemSeriesSize}
                                </strong>
                            </div>
                        )}
                        <div className="nitro-catalog-purchase-confirm-summary">
                            {credits > 0 && (
                                <span className="nitro-catalog-purchase-confirm-price">
                                    <strong>{credits}</strong>
                                    <LayoutCurrencyIcon type={-1} />
                                </span>
                            )}
                            {activityPoints > 0 && (
                                <span className="nitro-catalog-purchase-confirm-price">
                                    <strong>{activityPoints}</strong>
                                    <LayoutCurrencyIcon type={offer.activityPointType} />
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="nitro-catalog-purchase-confirm-actions">
                    <button className="nitro-catalog-swf-button" type="button" onClick={onCancel}>
                        {LocalizeText('generic.cancel')}
                    </button>
                    <button className="nitro-catalog-swf-button nitro-catalog-swf-buy-button" type="button" onClick={onConfirm}>
                        {LocalizeText(`catalog.purchase_confirmation.${offer.isRentOffer ? 'rent' : 'buy'}`)}
                    </button>
                </div>
            </div>
        </div>
    );
};
