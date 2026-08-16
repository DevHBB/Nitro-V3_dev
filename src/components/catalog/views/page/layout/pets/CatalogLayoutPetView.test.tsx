import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageComposer } from '../../../../../../api';
import { useCatalogData, useCatalogUiState, useMessageEvent, useSellablePetPalette, useUiEvent } from '../../../../../../hooks';
import { CatalogLayoutPetView } from './CatalogLayoutPetView';

const composerTypes = vi.hoisted(() => {
    class ApproveNameMessageComposer {
        public constructor(
            public readonly name: string,
            public readonly type: number
        ) {}
    }

    class PurchaseFromCatalogComposer {
        public constructor(
            public readonly pageId: number,
            public readonly offerId: number,
            public readonly extraData: string,
            public readonly amount: number
        ) {}
    }

    return { ApproveNameMessageComposer, PurchaseFromCatalogComposer };
});

vi.mock('@nitrots/nitro-renderer', () => ({
    ApproveNameMessageComposer: composerTypes.ApproveNameMessageComposer,
    ApproveNameMessageEvent: class {},
    ColorConverter: { int2rgb: (color: number) => `#${color.toString(16).padStart(6, '0')}` },
    GetRoomEngine: () => ({
        getPetColorResult: (_type: number, paletteId: number) => ({ primaryColor: paletteId, secondaryColor: paletteId + 1 })
    }),
    PurchaseFromCatalogComposer: composerTypes.PurchaseFromCatalogComposer
}));

vi.mock('../../../../../../api', () => ({
    DispatchUiEvent: vi.fn(),
    GetPetAvailableColors: () => [[0xabcdef]],
    GetPetIndexFromLocalization: (localization: string) => Number(localization.split('_').at(-1)),
    LocalizeText: (key: string) => key,
    SanitizeHtml: (value: string) => value,
    SendMessageComposer: vi.fn()
}));

vi.mock('../../../../../../common', () => ({
    LayoutGridItem: ({ children, itemColor, onClick }: { children?: React.ReactNode; itemColor?: string; onClick?: () => void }) => (
        <button data-palette-color={itemColor ?? undefined} type="button" onClick={onClick}>
            {children}
        </button>
    ),
    LayoutPetImageView: ({ direction, paletteId, petColor, scale, typeId }: Record<string, unknown>) => (
        <span
            data-direction={direction}
            data-palette-id={paletteId}
            data-pet-color={petColor}
            data-scale={scale}
            data-testid="pet-image"
            data-type-id={typeId}
        />
    ),
    LayoutRoomPreviewerView: () => <div data-testid="pet-preview" />
}));

vi.mock('../../../../../../hooks', () => ({
    useCatalogData: vi.fn(),
    useCatalogUiState: vi.fn(),
    useMessageEvent: vi.fn(),
    useSellablePetPalette: vi.fn(),
    useUiEvent: vi.fn()
}));

vi.mock('../../../../../../events', () => ({
    CatalogPurchasedEvent: { PURCHASE_SUCCESS: 'purchase-success' },
    CatalogPurchaseFailureEvent: { PURCHASE_FAILED: 'purchase-failed' }
}));

vi.mock('../../widgets/CatalogAddOnBadgeWidgetView', () => ({ CatalogAddOnBadgeWidgetView: () => null }));
vi.mock('../../widgets/CatalogTotalPriceWidget', () => ({ CatalogTotalPriceWidget: () => <div data-testid="pet-price" /> }));
vi.mock('../../widgets/CatalogViewProductWidgetView', () => ({ CatalogViewProductWidgetView: () => <div data-testid="generic-product-preview" /> }));

const page = {
    localization: { getText: () => '' },
    offers: [],
    pageId: 91
};

const offer = (petType: number) => ({
    localizationId: `pet_${petType}`,
    offerId: 51,
    product: { productData: { type: `pet_${petType}` } }
});

const palette = (type: number, paletteId: number, sellable = true) => ({ breedId: paletteId, paletteId, rare: false, sellable, type });

const roomPreviewer = {
    addPetIntoRoom: vi.fn(),
    reset: vi.fn(),
    setAutomaticStateChange: vi.fn()
};

let approveNameHandler: ((event: { getParser: () => { result: number } }) => void) | null = null;
const uiEventHandlers = new Map<string, () => void>();

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();
    approveNameHandler = null;
    uiEventHandlers.clear();
    vi.mocked(useCatalogUiState).mockReturnValue({ setCurrentOffer: vi.fn(), setPurchaseOptions: vi.fn() } as any);
    vi.mocked(useMessageEvent).mockImplementation((_event: unknown, handler: any) => {
        approveNameHandler = handler;
    });
    vi.mocked(useUiEvent).mockImplementation((event: any, handler: any) => {
        uiEventHandlers.set(event, handler);
    });
});

describe('pet catalog layout', () => {
    it('renders a direct palette grid and the sixteen-character name field for new pets', async () => {
        const currentOffer = offer(8);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer, roomPreviewer } as any);
        vi.mocked(useSellablePetPalette).mockReturnValue({ data: { palettes: [palette(8, 10), palette(7, 11), palette(8, 12, false)] } } as any);

        render(<CatalogLayoutPetView page={{ ...page, offers: [currentOffer] } as any} hideNavigation={() => undefined} />);

        expect(await screen.findByTestId('pet-image')).toBeInTheDocument();
        expect(screen.queryByTestId('generic-product-preview')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '16');
        expect(screen.getByRole('button', { name: 'catalog.pets.choose.color 1' })).toHaveStyle({
            background: 'linear-gradient(135deg, #00000a 0 50%, #00000b 50% 100%)'
        });
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-type-id', '8');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-direction', '3');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-scale', '2');
    });

    it('renders the legacy breed menu and colors with the fifteen-character name field', async () => {
        const currentOffer = offer(7);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer, roomPreviewer } as any);
        vi.mocked(useSellablePetPalette).mockReturnValue({ data: { palettes: [palette(7, 20), palette(7, 21)] } } as any);

        render(<CatalogLayoutPetView page={{ ...page, offers: [currentOffer] } as any} hideNavigation={() => undefined} />);

        expect(await screen.findAllByRole('option')).toHaveLength(2);
        expect(screen.getByRole('combobox')).toHaveValue('0');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-type-id', '7');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-palette-id', '20');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-pet-color', '11259375');
        expect(screen.getByTestId('pet-image')).toHaveAttribute('data-direction', '2');
        expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '15');
        expect(screen.getByRole('button', { name: 'catalog.pets.choose.color 1' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('pet-image').closest('.nitro-catalog-pet-layout')).toHaveClass(
            'nitro-catalog-pet-layout--legacy'
        );
        expect(
            screen.getByLabelText('catalog.pets.choose.color').compareDocumentPosition(screen.getByRole('combobox')) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(screen.getByTestId('pet-image').closest('.nitro-catalog-pet-preview')).toContainElement(screen.getByTestId('pet-price'));
    });

    it('sends one approval request and purchases only after the matching approval succeeds', async () => {
        const currentOffer = offer(8);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer, roomPreviewer } as any);
        vi.mocked(useSellablePetPalette).mockReturnValue({ data: { palettes: [palette(8, 10)] } } as any);

        render(<CatalogLayoutPetView page={{ ...page, offers: [currentOffer] } as any} hideNavigation={() => undefined} />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nova' } });
        fireEvent.click(screen.getByRole('button', { name: 'catalog.purchase_confirmation.buy' }));

        expect(vi.mocked(SendMessageComposer).mock.calls[0][0]).toBeInstanceOf(composerTypes.ApproveNameMessageComposer);
        expect(screen.getByRole('button', { name: 'catalog.pets.choose.color 1' })).toBeDisabled();
        expect(approveNameHandler).not.toBeNull();
        approveNameHandler?.({ getParser: () => ({ result: 0 }) });

        await waitFor(() => expect(vi.mocked(SendMessageComposer)).toHaveBeenCalledTimes(2));
        expect(vi.mocked(SendMessageComposer).mock.calls[1][0]).toBeInstanceOf(composerTypes.PurchaseFromCatalogComposer);
        expect(vi.mocked(SendMessageComposer).mock.calls[1][0]).toMatchObject({ extraData: 'Nova\n10\nFFFFFF' });
        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'catalog.purchase_confirmation.buy' })).toBeDisabled();

        uiEventHandlers.get('purchase-success')?.();

        await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    });

    it('drops an approval result when the user has already changed catalog page', async () => {
        const currentOffer = offer(8);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer, roomPreviewer } as any);
        vi.mocked(useSellablePetPalette).mockReturnValue({ data: { palettes: [palette(8, 10)] } } as any);

        const { rerender } = render(
            <CatalogLayoutPetView page={{ ...page, offers: [currentOffer] } as any} hideNavigation={() => undefined} />
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nova' } });
        fireEvent.click(screen.getByRole('button', { name: 'catalog.purchase_confirmation.buy' }));
        expect(vi.mocked(SendMessageComposer)).toHaveBeenCalledTimes(1);

        rerender(
            <CatalogLayoutPetView page={{ ...page, pageId: 92, offers: [currentOffer] } as any} hideNavigation={() => undefined} />
        );
        approveNameHandler?.({ getParser: () => ({ result: 0 }) });

        await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
        expect(vi.mocked(SendMessageComposer)).toHaveBeenCalledTimes(1);
    });
});
