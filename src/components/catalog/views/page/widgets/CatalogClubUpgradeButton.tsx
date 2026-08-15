import { CreateLinkEvent } from '@nitrots/nitro-renderer';
import { FC } from 'react';
import { LocalizeText } from '../../../../../api';

interface CatalogClubUpgradeButtonProps {
    onOpenClubCenter?: () => void;
}

export const CatalogClubUpgradeButton: FC<CatalogClubUpgradeButtonProps> = ({ onOpenClubCenter = () => CreateLinkEvent('habboUI/open/hccenter') }) => (
    <button className="nitro-catalog-standard-button nitro-catalog-standard-buy-button" type="button" onClick={onOpenClubCenter}>
        {LocalizeText('catalog.alert.hc.required')}
    </button>
);
