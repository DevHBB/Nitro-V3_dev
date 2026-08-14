import { FC } from 'react';
import { IPurchasableOffer } from '../../../../../api';

export const CatalogProductDetailsView: FC<{ offer: IPurchasableOffer }> = ({ offer }) => {
    if (!offer) return null;

    const product = offer.product;
    const name = offer.localizationName || product?.productData?.name || '';
    const description = offer.localizationDescription || product?.productData?.description || '';
    return (
        <div aria-label={name} className="nitro-catalog-product-details" role="group">
            <strong className="nitro-catalog-product-details-name">{name}</strong>
            {!!description && <span className="nitro-catalog-product-details-description">{description}</span>}
        </div>
    );
};
