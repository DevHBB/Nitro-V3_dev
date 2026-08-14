import { ICatalogPage } from '../../../../../api';
import { FC } from 'react';
import { CatalogLayoutProps } from './CatalogLayout.types';
import { CatalogLayoutBadgeDisplayView } from './CatalogLayoutBadgeDisplayView';
import { CatalogLayoutBcInfoView } from './CatalogLayoutBcInfoView';
import { CatalogLayoutBuildersClubBuyView } from './CatalogLayoutBuildersClubBuyView';
import { CatalogLayoutColorGroupingView } from './CatalogLayoutColorGroupingView';
import { CatalogLayoutDefaultView } from './CatalogLayoutDefaultView';
import { CatalogLayouGuildCustomFurniView } from './CatalogLayoutGuildCustomFurniView';
import { CatalogLayouGuildForumView } from './CatalogLayoutGuildForumView';
import { CatalogLayouGuildFrontpageView } from './CatalogLayoutGuildFrontpageView';
import { CatalogLayoutInfoLoyaltyView } from './CatalogLayoutInfoLoyaltyView';
import { CatalogLayoutPets2View } from './CatalogLayoutPets2View';
import { CatalogLayoutPets3View } from './CatalogLayoutPets3View';
import { CatalogLayoutPetCustomizationView } from './CatalogLayoutPetCustomizationView';
import { CatalogLayoutRoomAdsView } from './CatalogLayoutRoomAdsView';
import { CatalogLayoutRoomBundleView } from './CatalogLayoutRoomBundleView';
import { CatalogLayoutSingleBundleView } from './CatalogLayoutSingleBundleView';
import { CatalogLayoutSoundMachineView } from './CatalogLayoutSoundMachineView';
import { CatalogLayoutSpacesView } from './CatalogLayoutSpacesView';
import { CatalogLayoutTrophiesView } from './CatalogLayoutTrophiesView';
import { CatalogLayoutUnavailableView } from './CatalogLayoutUnavailableView';
import { CatalogLayoutVipBuyView } from './CatalogLayoutVipBuyView';
import { CatalogLayoutFrontpage4View } from './frontpage4/CatalogLayoutFrontpage4View';
import { CatalogLayoutMarketplaceOwnItemsView } from './marketplace/CatalogLayoutMarketplaceOwnItemsView';
import { CatalogLayoutMarketplacePublicItemsView } from './marketplace/CatalogLayoutMarketplacePublicItemsView';
import { CatalogLayoutPetView } from './pets/CatalogLayoutPetView';
import { CatalogLayoutVipGiftsView } from './vip-gifts/CatalogLayoutVipGiftsView';
import { CatalogLayoutRenderer, getCatalogLayoutDefinition } from './catalogLayoutRegistry';

const layoutRenderers: Record<CatalogLayoutRenderer, FC<CatalogLayoutProps>> = {
    badgeDisplay: CatalogLayoutBadgeDisplayView,
    buildersClubBuy: CatalogLayoutBuildersClubBuyView,
    clubGifts: CatalogLayoutVipGiftsView,
    colorGrouping: CatalogLayoutColorGroupingView,
    default: CatalogLayoutDefaultView,
    frontpage: CatalogLayoutFrontpage4View,
    guildCustomFurni: CatalogLayouGuildCustomFurniView,
    guildForum: CatalogLayouGuildForumView,
    guildFrontpage: CatalogLayouGuildFrontpageView,
    info: CatalogLayoutBcInfoView,
    infoLoyalty: CatalogLayoutInfoLoyaltyView,
    marketplaceOwnItems: CatalogLayoutMarketplaceOwnItemsView,
    marketplacePublicItems: CatalogLayoutMarketplacePublicItemsView,
    petCustomization: CatalogLayoutPetCustomizationView,
    pets: CatalogLayoutPetView,
    pets2: CatalogLayoutPets2View,
    pets3: CatalogLayoutPets3View,
    roomAds: CatalogLayoutRoomAdsView,
    roomBundle: CatalogLayoutRoomBundleView,
    singleBundle: CatalogLayoutSingleBundleView,
    soundMachine: CatalogLayoutSoundMachineView,
    spaces: CatalogLayoutSpacesView,
    trophies: CatalogLayoutTrophiesView,
    unavailable: CatalogLayoutUnavailableView,
    vipBuy: CatalogLayoutVipBuyView
};

export const GetCatalogLayout = (page: ICatalogPage, hideNavigation: () => void) => {
    if (!page) return null;

    const layoutProps: CatalogLayoutProps = { page, hideNavigation };
    const definition = getCatalogLayoutDefinition(page.layoutCode);
    const LayoutView = definition ? layoutRenderers[definition.renderer] : CatalogLayoutUnavailableView;

    return <LayoutView {...layoutProps} />;
};
