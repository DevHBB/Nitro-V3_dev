import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateLinkEvent } from '@nitrots/nitro-renderer';
import { SendMessageComposer } from '../../../../../api';
import { useCatalogData, useCatalogSkipPurchaseConfirmation, useClubOffers, usePurse } from '../../../../../hooks';
import { CatalogLayoutVipBuyView } from './CatalogLayoutVipBuyView';

const composerTypes = vi.hoisted(() => {
    class PurchaseFromCatalogComposer {
        public constructor(
            public readonly pageId: number,
            public readonly offerId: number,
            public readonly extraData: string | null,
            public readonly amount: number
        ) {}
    }

    class PurchaseFromCatalogAsGiftComposer {
        public constructor(..._args: unknown[]) {}
    }

    return { PurchaseFromCatalogAsGiftComposer, PurchaseFromCatalogComposer };
});

vi.mock('@nitrots/nitro-renderer', () => ({
    CreateLinkEvent: vi.fn(),
    GiftReceiverNotFoundEvent: class {},
    PurchaseFromCatalogAsGiftComposer: composerTypes.PurchaseFromCatalogAsGiftComposer,
    PurchaseFromCatalogComposer: composerTypes.PurchaseFromCatalogComposer
}));

vi.mock('../../../../../api', () => ({
    CatalogPurchaseState: { CONFIRM: 1, FAILED: 3, NONE: 0, PURCHASE: 2 },
    LocalizeText: (key: string, _names?: string[], values?: string[]) => `${key}${values?.length ? `:${values.join(',')}` : ''}`,
    SanitizeHtml: (value: string) => value,
    SendMessageComposer: vi.fn()
}));

vi.mock('../../../../../common', () => ({
    AutoGrid: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Button: ({ children, fullWidth: _fullWidth, variant: _variant, ...props }: any) => <button {...props}>{children}</button>,
    Column: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Flex: ({ alignItems: _alignItems, children, ...props }: any) => <div {...props}>{children}</div>,
    Grid: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    LayoutCurrencyIcon: () => <span />,
    LayoutLoadingSpinnerView: () => <span />,
    Text: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

vi.mock('../../../../../events', () => ({
    CatalogEvent: class {},
    CatalogPurchasedEvent: { PURCHASE_SUCCESS: 'purchase-success' },
    CatalogPurchaseFailureEvent: { PURCHASE_FAILED: 'purchase-failed' }
}));

vi.mock('../../../../../hooks', () => ({
    useCatalogData: vi.fn(),
    useCatalogSkipPurchaseConfirmation: vi.fn(),
    useClubOffers: vi.fn(),
    useMessageEvent: vi.fn(),
    usePurse: vi.fn(),
    useUiEvent: vi.fn(),
    useUserDataSnapshot: () => ({ userName: 'Owner' })
}));

const makeOffer = (offerId: number, months: number, vip: boolean) => ({
    day: 1,
    extraDays: 0,
    giftable: false,
    month: 1,
    months,
    offerId,
    priceActivityPoints: 0,
    priceActivityPointsType: 0,
    priceCredits: 10,
    vip,
    year: 2030
});

const renderLayout = (layoutCode: string) =>
    render(
        <CatalogLayoutVipBuyView
            page={{ layoutCode, localization: { getImage: () => '', getText: () => '' }, offers: [], pageId: 50 } as any}
            hideNavigation={() => undefined}
        />
    );

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCatalogData).mockImplementation(() => ({
        currentPage: (screen.queryByTestId('unused') as any) ?? null
    }) as any);
    vi.mocked(useClubOffers).mockReturnValue({ data: [makeOffer(1, 1, false), makeOffer(2, 2, true)] } as any);
    vi.mocked(useCatalogSkipPurchaseConfirmation).mockReturnValue([false] as any);
    vi.mocked(usePurse).mockReturnValue({
        getCurrencyAmount: () => 1000,
        purse: { clubDays: 0, clubPeriods: 0, isVip: false }
    } as any);
});

const setCurrentPage = (layoutCode: string) => {
    vi.mocked(useCatalogData).mockReturnValue({
        currentPage: { layoutCode, localization: { getImage: () => '', getText: () => '' }, offers: [], pageId: 50 }
    } as any);
};

describe('club purchase layout', () => {
    it('renders only VIP offers on the VIP page', () => {
        setCurrentPage('vip_buy');
        renderLayout('vip_buy');

        expect(screen.queryByText('catalog.vip.item.header.months:1')).not.toBeInTheDocument();
        expect(screen.getByText('catalog.vip.item.header.months:2')).toBeInTheDocument();
    });

    it('renders separate HC and VIP offer groups on the club page', () => {
        setCurrentPage('club_buy');
        renderLayout('club_buy');

        expect(screen.getByText('catalog.club.hc')).toBeInTheDocument();
        expect(screen.getByText('catalog.club.vip')).toBeInTheDocument();
        expect(screen.getByText('catalog.vip.item.header.months:1')).toBeInTheDocument();
        expect(screen.getByText('catalog.vip.item.header.months:2')).toBeInTheDocument();
        expect(screen.getByRole('button', { pressed: true })).toHaveAttribute('data-offer-id', '1');
    });

    it('renders safely while membership data is unavailable', () => {
        setCurrentPage('club_buy');
        vi.mocked(usePurse).mockReturnValue({ getCurrencyAmount: () => 0, purse: null } as any);

        expect(() => renderLayout('club_buy')).not.toThrow();
        expect(screen.getByText('catalog.club.buy.header.none')).toBeInTheDocument();
    });

    it('opens the club center through the existing plain-text link', () => {
        setCurrentPage('club_buy');
        renderLayout('club_buy');

        fireEvent.click(screen.getByRole('button', { name: 'generic.hccenter' }));

        expect(CreateLinkEvent).toHaveBeenCalledWith('habboUI/open/hccenter');
    });

    it('submits the selected offer once and locks offer switching until the result', async () => {
        setCurrentPage('club_buy');
        vi.mocked(useCatalogSkipPurchaseConfirmation).mockReturnValue([true] as any);
        renderLayout('club_buy');

        const buyButton = await screen.findByRole('button', { name: 'buy' });
        fireEvent.click(buyButton);
        fireEvent.click(buyButton);

        await waitFor(() => expect(SendMessageComposer).toHaveBeenCalledTimes(1));
        expect(vi.mocked(SendMessageComposer).mock.calls[0][0]).toBeInstanceOf(composerTypes.PurchaseFromCatalogComposer);
        expect(vi.mocked(SendMessageComposer).mock.calls[0][0]).toMatchObject({ amount: 1, offerId: 1, pageId: 50 });
        const offerButtons = screen.getAllByRole('button').filter((button) => button.hasAttribute('data-offer-id'));
        expect(offerButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    });
});
