import { ClubOfferData, CreateLinkEvent, PurchaseFromCatalogComposer } from '@nitrots/nitro-renderer';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { CatalogPurchaseState, DispatchUiEvent, LocalizeText, SendMessageComposer } from '../../../../../api';
import { Button, LayoutCurrencyIcon, LayoutLoadingSpinnerView } from '../../../../../common';
import { CatalogEvent, CatalogInitGiftEvent, CatalogPurchasedEvent, CatalogPurchaseFailureEvent } from '../../../../../events';
import { useCatalogData, useCatalogSkipPurchaseConfirmation, useClubOffers, usePurse, useUiEvent } from '../../../../../hooks';
import { CatalogLayoutProps } from './CatalogLayout.types';
import { getClubMembershipSummary, groupClubOffers } from './clubPurchase.helpers';

const CLUB_WINDOW_ID = 1;

export const CatalogLayoutVipBuyView: FC<CatalogLayoutProps> = ({ page = null }) => {
    const [pendingOffer, setPendingOffer] = useState<ClubOfferData | null>(null);
    const [purchaseState, setPurchaseState] = useState(CatalogPurchaseState.NONE);
    const [catalogSkipPurchaseConfirmation] = useCatalogSkipPurchaseConfirmation();
    const { currentPage = null } = useCatalogData();
    const { purse = null, getCurrencyAmount = null } = usePurse();
    const { data: offers = null } = useClubOffers(CLUB_WINDOW_ID);
    const isPurchasingRef = useRef(false);
    const pageData = currentPage ?? page;
    const layoutCode = pageData?.layoutCode ?? 'club_buy';
    const isVipPage = layoutCode === 'vip_buy';
    const offerGroups = useMemo(() => groupClubOffers(layoutCode, offers ?? []), [layoutCode, offers]);
    const membership = useMemo(() => getClubMembershipSummary(purse), [purse]);

    const onCatalogEvent = useCallback((event: CatalogEvent) => {
        switch (event.type) {
            case CatalogPurchasedEvent.PURCHASE_SUCCESS:
                isPurchasingRef.current = false;
                setPurchaseState(CatalogPurchaseState.NONE);
                setPendingOffer(null);
                return;
            case CatalogPurchaseFailureEvent.PURCHASE_FAILED:
                isPurchasingRef.current = false;
                setPurchaseState(CatalogPurchaseState.FAILED);
                return;
        }
    }, []);

    useUiEvent(CatalogPurchasedEvent.PURCHASE_SUCCESS, onCatalogEvent);
    useUiEvent(CatalogPurchaseFailureEvent.PURCHASE_FAILED, onCatalogEvent);

    const getOfferText = useCallback(
        (offer: ClubOfferData) => {
            if (!isVipPage) return LocalizeText('catalog.club.item.header', ['months'], [offer.months.toString()]);

            const parts: string[] = [];

            if (offer.months > 0) {
                parts.push(LocalizeText('catalog.vip.item.header.months', ['num_months'], [offer.months.toString()]));
            }

            if (offer.extraDays > 0) {
                parts.push(LocalizeText('catalog.vip.item.header.days', ['num_days'], [offer.extraDays.toString()]));
            }

            return parts.join(' ');
        },
        [isVipPage]
    );

    const getPurchaseHeader = useCallback(
        (offer: ClubOfferData) => {
            const extensionOrSubscription = membership.active ? 'extension.' : 'subscription.';
            const daysOrMonths = offer.months === 0 ? 'days' : 'months';
            const value = offer.months === 0 ? offer.extraDays : offer.months;

            return LocalizeText(`catalog.vip.buy.confirm.${extensionOrSubscription}${daysOrMonths}`).replace(
                `%NUM_${daysOrMonths.toUpperCase()}%`,
                value.toString()
            );
        },
        [membership.active]
    );

    const getPurchaseValidUntil = useCallback((offer: ClubOfferData) => {
        return LocalizeText('catalog.vip.buy.confirm.end_date')
            .replace('%month%', offer.month.toString())
            .replace('%day%', offer.day.toString())
            .replace('%year%', offer.year.toString());
    }, []);

    const canAfford = useCallback(
        (offer: ClubOfferData) => {
            const credits = getCurrencyAmount?.(-1) ?? 0;
            const activityPoints = getCurrencyAmount?.(offer.priceActivityPointsType) ?? 0;

            return offer.priceCredits <= credits && offer.priceActivityPoints <= activityPoints;
        },
        [getCurrencyAmount]
    );

    const submitPurchase = useCallback(
        (offer: ClubOfferData) => {
            if (!pageData || isPurchasingRef.current || !canAfford(offer)) return;

            isPurchasingRef.current = true;
            setPendingOffer(offer);
            setPurchaseState(CatalogPurchaseState.PURCHASE);
            SendMessageComposer(new PurchaseFromCatalogComposer(pageData.pageId, offer.offerId, null, 1));
        },
        [canAfford, pageData]
    );

    const startPurchase = useCallback(
        (offer: ClubOfferData) => {
            if (isPurchasingRef.current || !canAfford(offer)) return;

            if (catalogSkipPurchaseConfirmation) {
                submitPurchase(offer);
                return;
            }

            setPendingOffer(offer);
            setPurchaseState(CatalogPurchaseState.CONFIRM);
        },
        [canAfford, catalogSkipPurchaseConfirmation, submitPurchase]
    );

    const startGift = useCallback(
        (offer: ClubOfferData) => {
            if (!pageData || isPurchasingRef.current || !offer.giftable) return;

            DispatchUiEvent(new CatalogInitGiftEvent(pageData.pageId, offer.offerId, ''));
        },
        [pageData]
    );

    const renderPrice = (offer: ClubOfferData) => (
        <span className="nitro-club-offer-prices">
            {offer.priceCredits > 0 && (
                <span className="nitro-club-offer-price">
                    <span>{offer.priceCredits}</span>
                    <LayoutCurrencyIcon type={-1} />
                </span>
            )}
            {offer.priceActivityPoints > 0 && (
                <>
                    {offer.priceCredits > 0 && <span className="nitro-club-price-separator">+</span>}
                    <span className="nitro-club-offer-price">
                        <span>{offer.priceActivityPoints}</span>
                        <LayoutCurrencyIcon type={offer.priceActivityPointsType} />
                    </span>
                </>
            )}
        </span>
    );

    const renderOffer = (offer: ClubOfferData) => {
        const affordable = canAfford(offer);
        const isPending = pendingOffer?.offerId === offer.offerId;
        const actionLabel = affordable
            ? LocalizeText('buy')
            : offer.priceCredits > (getCurrencyAmount?.(-1) ?? 0)
              ? LocalizeText('catalog.alert.notenough.title')
              : LocalizeText(`catalog.alert.notenough.activitypoints.title.${offer.priceActivityPointsType}`);

        return (
            <article
                key={offer.offerId}
                className={`nitro-club-offer ${isVipPage ? 'is-wide' : 'is-compact'} ${offer.vip ? 'is-vip' : 'is-hc'}`}
                data-offer-id={offer.offerId}
            >
                <header className="nitro-club-offer-header">
                    {isVipPage || !offer.vip ? (
                        <i aria-hidden="true" className="nitro-icon icon-hc-banner nitro-club-hc-mark" />
                    ) : (
                        <span className="nitro-club-vip-mark">VIP</span>
                    )}
                    <strong>{getOfferText(offer)}</strong>
                </header>
                <div className="nitro-club-offer-footer">
                    {renderPrice(offer)}
                    <div className="nitro-club-offer-actions">
                        {isVipPage && offer.giftable && (
                            <Button
                                classNames={['nitro-club-offer-action']}
                                disabled={isPurchasingRef.current}
                                onClick={() => startGift(offer)}
                            >
                                {LocalizeText('catalog.purchase_confirmation.gift')}
                            </Button>
                        )}
                        <Button
                            classNames={['nitro-club-offer-action', 'is-buy']}
                            disabled={!affordable || isPurchasingRef.current}
                            onClick={() => startPurchase(offer)}
                        >
                            {isPending && purchaseState === CatalogPurchaseState.PURCHASE ? <LayoutLoadingSpinnerView /> : actionLabel}
                        </Button>
                    </div>
                </div>
            </article>
        );
    };

    const membershipHeaderKey = {
        hc: 'catalog.club.buy.header.hc',
        none: 'catalog.club.buy.header.none',
        vip: 'catalog.club.buy.header.vip'
    }[membership.tier];
    const membershipInfoKey = {
        hc: 'catalog.club.buy.info.hc',
        none: 'catalog.club.buy.info.none',
        vip: 'catalog.club.buy.info.vip'
    }[membership.tier];
    const remainingKey = membership.tier === 'vip' ? 'catalog.club.buy.remaining.vip' : 'catalog.club.buy.remaining.hc';
    const teaserImage = pageData?.localization.getImage(1) ?? '';
    const vipTitleKey = membership.tier === 'vip' ? 'catalog.vip.extend.title' : 'catalog.vip.buy.title';
    const vipInfo = membership.tier === 'vip'
        ? LocalizeText('catalog.vip.extend.info', ['days'], [membership.totalDays.toString()])
        : LocalizeText('catalog.vip.buy.info');

    return (
        <div className={`nitro-club-purchase-layout ${isVipPage ? 'is-vip-page' : 'is-club-page'}`}>
            {isVipPage ? (
                <>
                    <div className="nitro-club-vip-intro">
                        {teaserImage ? <img alt="" className="nitro-club-teaser" src={teaserImage} /> : <span className="nitro-club-teaser" />}
                        <div className="nitro-club-vip-copy">
                            <strong>{LocalizeText(vipTitleKey)}</strong>
                            <span>{vipInfo}</span>
                        </div>
                    </div>
                    <div className="nitro-club-vip-offers">{offerGroups.vip.map(renderOffer)}</div>
                    <button className="nitro-club-center-link" type="button" onClick={() => CreateLinkEvent('habboUI/open/hccenter')}>
                        {LocalizeText('catalog.vip.buy.hccenter')}
                    </button>
                </>
            ) : (
                <>
                    <header className="nitro-club-membership-header">
                        <strong>{LocalizeText(membershipHeaderKey)}</strong>
                    </header>
                    <p className="nitro-club-membership-info">{LocalizeText(membershipInfoKey)}</p>
                    <div className="nitro-club-emblem" aria-hidden="true">
                        <i className="nitro-icon icon-hc-banner" />
                    </div>
                    <div className="nitro-club-columns">
                        <section className="nitro-club-hc-column">
                            {offerGroups.hc.map(renderOffer)}
                            {membership.tier === 'vip' && (
                                <div className="nitro-club-info-card">
                                    <strong>{LocalizeText('catalog.club.info.header')}</strong>
                                    <span>{LocalizeText('catalog.club.info.content')}</span>
                                </div>
                            )}
                        </section>
                        <section className="nitro-club-vip-column">{offerGroups.vip.map(renderOffer)}</section>
                    </div>
                    {membership.active && (
                        <div className="nitro-club-remaining">
                            {LocalizeText(remainingKey, ['days'], [membership.totalDays.toString()])}
                        </div>
                    )}
                    <button className="nitro-club-center-link" type="button" onClick={() => CreateLinkEvent('habboUI/open/hccenter')}>
                        {LocalizeText('catalog.club.buy.link')}
                    </button>
                </>
            )}

            {pendingOffer && purchaseState !== CatalogPurchaseState.NONE && purchaseState !== CatalogPurchaseState.PURCHASE && (
                <div aria-modal="true" className="nitro-club-confirmation" role="dialog">
                    <div className="nitro-club-confirmation-card">
                        <strong>{getPurchaseHeader(pendingOffer)}</strong>
                        <span>{getPurchaseValidUntil(pendingOffer)}</span>
                        {renderPrice(pendingOffer)}
                        {purchaseState === CatalogPurchaseState.FAILED && <span>{LocalizeText('generic.failed')}</span>}
                        <div className="nitro-club-confirmation-actions">
                            <Button
                                onClick={() => {
                                    setPendingOffer(null);
                                    setPurchaseState(CatalogPurchaseState.NONE);
                                }}
                            >
                                {LocalizeText('generic.cancel')}
                            </Button>
                            <Button variant="success" onClick={() => submitPurchase(pendingOffer)}>
                                {LocalizeText('catalog.marketplace.confirm_title')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
