import {
    ClubOfferData,
    CreateLinkEvent,
    GiftReceiverNotFoundEvent,
    PurchaseFromCatalogAsGiftComposer,
    PurchaseFromCatalogComposer
} from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogPurchaseState, LocalizeText, SendMessageComposer } from '../../../../../api';
import { Button, Flex, LayoutCurrencyIcon, LayoutLoadingSpinnerView } from '../../../../../common';
import { CatalogEvent, CatalogPurchasedEvent, CatalogPurchaseFailureEvent } from '../../../../../events';
import {
    useCatalogData,
    useCatalogSkipPurchaseConfirmation,
    useClubOffers,
    useMessageEvent,
    usePurse,
    useUiEvent,
    useUserDataSnapshot
} from '../../../../../hooks';
import { CatalogLayoutProps } from './CatalogLayout.types';
import { getClubMembershipSummary, groupClubOffers } from './clubPurchase.helpers';

const CLUB_WINDOW_ID = 1;

export const CatalogLayoutVipBuyView: FC<CatalogLayoutProps> = ({ page = null }) => {
    const [pendingOffer, setPendingOffer] = useState<ClubOfferData | null>(null);
    const [purchaseState, setPurchaseState] = useState(CatalogPurchaseState.NONE);
    const [catalogSkipPurchaseConfirmation] = useCatalogSkipPurchaseConfirmation();
    const [giftMode, setGiftMode] = useState(false);
    const [giftRecipient, setGiftRecipient] = useState('');
    const [giftError, setGiftError] = useState<string | null>(null);
    const [giftSuccess, setGiftSuccess] = useState(false);
    const { currentPage = null } = useCatalogData();
    const { purse = null, getCurrencyAmount = null } = usePurse();
    const { data: offers = null } = useClubOffers(CLUB_WINDOW_ID);
    const { userName: ownUserName = '' } = useUserDataSnapshot();
    const isPurchasingRef = useRef(false);
    const wasGiftPurchaseRef = useRef(false);
    const giftSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pageData = currentPage ?? page;
    const layoutCode = pageData?.layoutCode ?? 'club_buy';
    const offerGroups = useMemo(() => groupClubOffers(layoutCode, offers ?? []), [layoutCode, offers]);
    const membership = useMemo(() => getClubMembershipSummary(purse), [purse]);
    const isSelfGift = giftMode && !!ownUserName && giftRecipient.trim().toLowerCase() === ownUserName.toLowerCase();

    const onCatalogEvent = useCallback((event: CatalogEvent) => {
        switch (event.type) {
            case CatalogPurchasedEvent.PURCHASE_SUCCESS:
                isPurchasingRef.current = false;
                setPurchaseState(CatalogPurchaseState.NONE);
                setGiftError(null);
                if (wasGiftPurchaseRef.current) {
                    wasGiftPurchaseRef.current = false;
                    setGiftRecipient('');
                    setGiftMode(false);
                    setGiftSuccess(true);
                    if (giftSuccessTimerRef.current) clearTimeout(giftSuccessTimerRef.current);
                    giftSuccessTimerRef.current = setTimeout(() => setGiftSuccess(false), 3500);
                }
                return;
            case CatalogPurchaseFailureEvent.PURCHASE_FAILED:
                isPurchasingRef.current = false;
                wasGiftPurchaseRef.current = false;
                setPurchaseState(CatalogPurchaseState.FAILED);
                return;
        }
    }, []);

    useUiEvent(CatalogPurchasedEvent.PURCHASE_SUCCESS, onCatalogEvent);
    useUiEvent(CatalogPurchaseFailureEvent.PURCHASE_FAILED, onCatalogEvent);

    useEffect(
        () => () => {
            if (giftSuccessTimerRef.current) clearTimeout(giftSuccessTimerRef.current);
        },
        []
    );

    const handleGiftReceiverNotFound = useCallback(() => {
        if (!isPurchasingRef.current) return;

        isPurchasingRef.current = false;
        setPurchaseState(CatalogPurchaseState.NONE);
        setGiftError(LocalizeText('catalog.gift_wrapping.receiver_not_found.title'));
    }, []);

    useMessageEvent<GiftReceiverNotFoundEvent>(GiftReceiverNotFoundEvent, handleGiftReceiverNotFound);

    const getOfferText = useCallback((offer: ClubOfferData) => {
        const parts: string[] = [];

        if (offer.months > 0) {
            parts.push(LocalizeText('catalog.vip.item.header.months', ['num_months'], [offer.months.toString()]));
        }

        if (offer.extraDays > 0) {
            parts.push(LocalizeText('catalog.vip.item.header.days', ['num_days'], [offer.extraDays.toString()]));
        }

        return parts.join(' ');
    }, []);

    const setOffer = useCallback((offer: ClubOfferData | null) => {
        if (isPurchasingRef.current) return;

        setPurchaseState(CatalogPurchaseState.NONE);
        setPendingOffer(offer);
        setGiftError(null);
        setGiftSuccess(false);
        if (!offer?.giftable) setGiftMode(false);
    }, []);

    useEffect(() => {
        if (!offerGroups.visible.length) {
            if (pendingOffer) setOffer(null);
            return;
        }

        if (!pendingOffer || !offerGroups.visible.some((offer) => offer.offerId === pendingOffer.offerId)) {
            setOffer(offerGroups.visible[0]);
        }
    }, [offerGroups.visible, pendingOffer, setOffer]);

    const getPurchaseHeader = useCallback(() => {
        if (!pendingOffer) return '';

        const extensionOrSubscription = membership.active ? 'extension.' : 'subscription.';
        const daysOrMonths = pendingOffer.months === 0 ? 'days' : 'months';
        const value = pendingOffer.months === 0 ? pendingOffer.extraDays : pendingOffer.months;

        return LocalizeText(`catalog.vip.buy.confirm.${extensionOrSubscription}${daysOrMonths}`).replace(
            `%NUM_${daysOrMonths.toUpperCase()}%`,
            value.toString()
        );
    }, [membership.active, pendingOffer]);

    const getPurchaseValidUntil = useCallback(() => {
        if (!pendingOffer) return '';

        return LocalizeText('catalog.vip.buy.confirm.end_date')
            .replace('%month%', pendingOffer.month.toString())
            .replace('%day%', pendingOffer.day.toString())
            .replace('%year%', pendingOffer.year.toString());
    }, [pendingOffer]);

    const purchaseSubscription = useCallback(() => {
        if (!pageData || !pendingOffer || isPurchasingRef.current) return;
        if (giftMode && !giftRecipient.trim()) return;
        if (isSelfGift) return;

        isPurchasingRef.current = true;
        wasGiftPurchaseRef.current = giftMode;
        setPurchaseState(CatalogPurchaseState.PURCHASE);
        setGiftError(null);
        setGiftSuccess(false);

        if (giftMode) {
            SendMessageComposer(
                new PurchaseFromCatalogAsGiftComposer(
                    pageData.pageId,
                    pendingOffer.offerId,
                    '',
                    giftRecipient.trim(),
                    '',
                    0,
                    0,
                    0,
                    false
                )
            );
        } else {
            SendMessageComposer(new PurchaseFromCatalogComposer(pageData.pageId, pendingOffer.offerId, null, 1));
        }
    }, [giftMode, giftRecipient, isSelfGift, pageData, pendingOffer]);

    const getPurchaseButton = useCallback(() => {
        if (!pendingOffer) return null;

        const credits = getCurrencyAmount?.(-1) ?? 0;
        const activityPoints = getCurrencyAmount?.(pendingOffer.priceActivityPointsType) ?? 0;

        if (pendingOffer.priceCredits > credits) {
            return (
                <Button fullWidth variant="danger">
                    {LocalizeText('catalog.alert.notenough.title')}
                </Button>
            );
        }

        if (pendingOffer.priceActivityPoints > activityPoints) {
            return (
                <Button fullWidth variant="danger">
                    {LocalizeText(`catalog.alert.notenough.activitypoints.title.${pendingOffer.priceActivityPointsType}`)}
                </Button>
            );
        }

        const giftBlocked = giftMode && (!giftRecipient.trim() || isSelfGift);
        const buyLabel = giftMode ? LocalizeText('catalog.gift_wrapping.give_gift') : LocalizeText('buy');

        switch (purchaseState) {
            case CatalogPurchaseState.CONFIRM:
                return (
                    <Button disabled={giftBlocked} fullWidth variant="warning" onClick={purchaseSubscription}>
                        {LocalizeText('catalog.marketplace.confirm_title')}
                    </Button>
                );
            case CatalogPurchaseState.PURCHASE:
                return (
                    <Button disabled fullWidth variant="primary">
                        <LayoutLoadingSpinnerView />
                    </Button>
                );
            case CatalogPurchaseState.FAILED:
                return (
                    <Button disabled fullWidth variant="danger">
                        {LocalizeText('generic.failed')}
                    </Button>
                );
            default:
                return (
                    <Button
                        disabled={giftBlocked}
                        fullWidth
                        variant="success"
                        onClick={() =>
                            catalogSkipPurchaseConfirmation
                                ? purchaseSubscription()
                                : setPurchaseState(CatalogPurchaseState.CONFIRM)
                        }
                    >
                        {buyLabel}
                    </Button>
                );
        }
    }, [
        catalogSkipPurchaseConfirmation,
        getCurrencyAmount,
        giftMode,
        giftRecipient,
        isSelfGift,
        pendingOffer,
        purchaseState,
        purchaseSubscription
    ]);

    const renderOffer = (offer: ClubOfferData) => {
        const isActive = pendingOffer?.offerId === offer.offerId;

        return (
            <button
                key={offer.offerId}
                className={`nitro-vip-buy-offer${isActive ? ' active' : ''}`}
                data-offer-id={offer.offerId}
                aria-pressed={isActive}
                disabled={purchaseState === CatalogPurchaseState.PURCHASE}
                type="button"
                onClick={() => setOffer(offer)}
            >
                <span className={`vip-offer-banner${offer.vip ? ' is-vip' : ' is-hc'}`}>
                    {offer.vip ? <span>VIP</span> : <i className="nitro-icon icon-hc-banner nitro-catalog-vip-hc-banner" />}
                </span>
                <span className="vip-offer-title">{getOfferText(offer)}</span>
                <span className="vip-offer-prices">
                    {offer.priceCredits > 0 && (
                        <span className="vip-offer-price">
                            <span>{offer.priceCredits}</span>
                            <LayoutCurrencyIcon type={-1} />
                        </span>
                    )}
                    {offer.priceActivityPoints > 0 && (
                        <span className="vip-offer-price">
                            <span>{offer.priceActivityPoints}</span>
                            <LayoutCurrencyIcon type={offer.priceActivityPointsType} />
                        </span>
                    )}
                </span>
            </button>
        );
    };

    const renderOfferGroup = (titleKey: string, groupOffers: ClubOfferData[]) => groupOffers.length ? (
        <section className="nitro-club-offer-group">
            <h3>{LocalizeText(titleKey)}</h3>
            <div className="nitro-catalog-layout-vip-buy-grid">
                {groupOffers.map(renderOffer)}
            </div>
        </section>
    ) : null;

    const membershipKey = {
        hc: 'catalog.club.buy.header.hc',
        none: 'catalog.club.buy.header.none',
        vip: 'catalog.club.buy.header.vip'
    }[membership.tier];
    const teaserImage = pageData?.localization.getImage(1) ?? '';

    return (
        <div className={`nitro-club-purchase-layout ${layoutCode === 'vip_buy' ? 'is-vip-page' : 'is-club-page'}`}>
            <header className="nitro-club-membership-header">
                <strong>{LocalizeText(membershipKey)}</strong>
                {membership.active && <span>{LocalizeText('catalog.vip.extend.info', ['days'], [membership.totalDays.toString()])}</span>}
            </header>

            <div className="nitro-club-purchase-content">
                {layoutCode === 'vip_buy' && teaserImage && <img alt="" className="nitro-club-teaser" src={teaserImage} />}
                <div className="nitro-club-offers-column">
                    {layoutCode === 'club_buy' && renderOfferGroup('catalog.club.hc', offerGroups.hc)}
                    {renderOfferGroup('catalog.club.vip', offerGroups.vip)}
                </div>
            </div>

            <button className="nitro-club-center-link" type="button" onClick={() => CreateLinkEvent('habboUI/open/hccenter')}>
                {LocalizeText('generic.hccenter')}
            </button>

            {pendingOffer && (
                <div className="nitro-club-purchase-panel">
                    <Flex alignItems="end">
                        <div className="nitro-club-purchase-summary">
                            <strong>{giftMode ? LocalizeText('catalog.purchase_confirmation.gift') : getPurchaseHeader()}</strong>
                            <span>{getPurchaseValidUntil()}</span>
                        </div>
                        <div className="nitro-club-purchase-price">
                            {pendingOffer.priceCredits > 0 && (
                                <span>
                                    {pendingOffer.priceCredits} <LayoutCurrencyIcon type={-1} />
                                </span>
                            )}
                            {pendingOffer.priceActivityPoints > 0 && (
                                <span>
                                    {pendingOffer.priceActivityPoints}{' '}
                                    <LayoutCurrencyIcon type={pendingOffer.priceActivityPointsType} />
                                </span>
                            )}
                        </div>
                    </Flex>

                    {pendingOffer.giftable && (
                        <div className="nitro-club-gift-options">
                            <label>
                                <input
                                    checked={giftMode}
                                    type="checkbox"
                                    onChange={(event) => {
                                        setGiftMode(event.target.checked);
                                        setGiftError(null);
                                        setGiftSuccess(false);
                                    }}
                                />
                                <span>{LocalizeText('catalog.purchase_confirmation.gift')}</span>
                            </label>
                            {giftMode && (
                                <input
                                    placeholder={LocalizeText('catalog.gift_wrapping.receiver')}
                                    type="text"
                                    value={giftRecipient}
                                    onChange={(event) => {
                                        setGiftRecipient(event.target.value);
                                        setGiftError(null);
                                        setGiftSuccess(false);
                                    }}
                                />
                            )}
                            {giftMode && isSelfGift && <span className="nitro-club-purchase-error">{LocalizeText('catalog.gift_wrapping.receiver_not_found.info')}</span>}
                            {giftMode && giftError && !isSelfGift && <span className="nitro-club-purchase-error">{giftError}</span>}
                            {giftSuccess && <span className="nitro-club-purchase-success">{LocalizeText('generic.ok')}</span>}
                        </div>
                    )}

                    {getPurchaseButton()}
                </div>
            )}
        </div>
    );
};
