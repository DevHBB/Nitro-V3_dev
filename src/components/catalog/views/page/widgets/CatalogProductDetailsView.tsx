import { FC } from 'react';
import { FaExchangeAlt, FaRecycle } from 'react-icons/fa';
import { IPurchasableOffer, LocalizeText } from '../../../../../api';
import { useCatalogProductMetadata, useCatalogUiState } from '../../../../../hooks';

export const CatalogProductDetailsView: FC<{ offer: IPurchasableOffer }> = ({ offer }) => {
    const { currentType = 'NORMAL' } = useCatalogUiState();
    const metadata = useCatalogProductMetadata(offer?.page?.pageId ?? 0, currentType);

    if (!offer) return null;

    const product = offer.product;
    const name = offer.localizationName || product?.productData?.name || '';
    const description = offer.localizationDescription || product?.productData?.description || '';
    const offerMetadata = metadata?.filter((entry) => entry.offerId === offer.offerId) ?? [];
    const hasMetadata = offerMetadata.length > 0;
    const tradeable = hasMetadata && offerMetadata.every((entry) => entry.tradeable);
    const recyclable = hasMetadata && offerMetadata.every((entry) => entry.recyclable);
    const tradeableLabel = LocalizeText(
        tradeable ? 'inventory.furni.preview.tradeable_amount' : 'shop.marketplace.item.not.tradeable'
    );
    const recyclableLabel = LocalizeText(
        recyclable ? 'inventory.furni.preview.recyclable_amount' : 'recycler.alert.non.recyclable'
    );

    return (
        <div aria-label={name} className="nitro-catalog-product-details" role="group">
            <strong className="nitro-catalog-product-details-name">{name}</strong>
            {!!description && <span className="nitro-catalog-product-details-description">{description}</span>}
            {hasMetadata && (
                <div className="nitro-catalog-product-details-badges" role="list">
                    <span
                        aria-label={tradeableLabel}
                        className={`nitro-catalog-product-capability${tradeable ? '' : ' is-disabled'}`}
                        data-capability="tradeable"
                        role="listitem"
                        title={tradeableLabel}
                    >
                        <FaExchangeAlt aria-hidden />
                    </span>
                    <span
                        aria-label={recyclableLabel}
                        className={`nitro-catalog-product-capability${recyclable ? '' : ' is-disabled'}`}
                        data-capability="recyclable"
                        role="listitem"
                        title={recyclableLabel}
                    >
                        <FaRecycle aria-hidden />
                    </span>
                </div>
            )}
        </div>
    );
};
