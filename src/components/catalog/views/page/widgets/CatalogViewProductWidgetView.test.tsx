import { GetAvatarRenderManager, GetSessionDataManager } from '@nitrots/nitro-renderer';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalogData, useCatalogUiState } from '../../../../../hooks';
import { CatalogViewProductWidgetView } from './CatalogViewProductWidgetView';

vi.mock('../../../../../api', () => ({
    FurniCategory: {
        FLOOR: 3,
        WALL_PAPER: 2,
        LANDSCAPE: 4,
        FIGURE_PURCHASABLE_SET: 23
    },
    Offer: { PRICING_MODEL_BUNDLE: 'bundle' },
    ProductTypeEnum: {
        FLOOR: 's',
        WALL: 'i',
        ROBOT: 'r',
        EFFECT: 'e'
    }
}));

vi.mock('../../../../../common', () => ({
    AutoGrid: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Column: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    LayoutGridItem: () => <div />,
    LayoutRoomPreviewerView: () => <div data-testid="product-preview" />
}));

vi.mock('../../../../../hooks', () => ({
    useCatalogData: vi.fn(),
    useCatalogUiState: vi.fn()
}));

const createRoomPreviewer = () => ({
    addAvatarIntoRoom: vi.fn(),
    addFurnitureIntoRoom: vi.fn(),
    reset: vi.fn(),
    setAutomaticStateChange: vi.fn(),
    updateObjectRoom: vi.fn(),
    updateRoomWallsAndFloorVisibility: vi.fn()
});

const createFloorOffer = (specialType: number) => ({
    pricingModel: 'single',
    product: {
        productType: 's',
        productClassId: 500,
        extraParam: '',
        furnitureData: { id: 500, specialType }
    }
});

afterEach(cleanup);

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCatalogUiState).mockReturnValue({ purchaseOptions: { previewStuffData: null } } as any);
});

describe('catalog product preview', () => {
    it('composes purchasable clothing with the current gender and no avatar effect', async () => {
        const roomPreviewer = createRoomPreviewer();
        const avatarRenderManager = {
            getFigureStringWithFigureIds: vi.fn(() => 'composed-figure'),
            isValidFigureSetForGender: vi.fn((setId: number) => setId === 101 || setId === 202)
        };

        vi.mocked(GetAvatarRenderManager).mockReturnValue(avatarRenderManager as any);
        vi.mocked(GetSessionDataManager).mockReturnValue({
            figure: 'base-figure',
            gender: 'M',
            getFloorItemData: () => ({ customParams: '101, invalid, 202' })
        } as any);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer: createFloorOffer(23), roomPreviewer } as any);

        render(<CatalogViewProductWidgetView />);

        await waitFor(() => {
            expect(roomPreviewer.reset).toHaveBeenCalledWith(false);
            expect(avatarRenderManager.isValidFigureSetForGender).toHaveBeenCalledWith(101, 'M');
            expect(avatarRenderManager.isValidFigureSetForGender).toHaveBeenCalledWith(202, 'M');
            expect(avatarRenderManager.getFigureStringWithFigureIds).toHaveBeenCalledWith('base-figure', 'M', [101, 202]);
            expect(roomPreviewer.addAvatarIntoRoom).toHaveBeenCalledWith('composed-figure', 0);
        });
    });

    it('keeps normal furniture in the furniture preview even when its parameters match a figure set', async () => {
        const roomPreviewer = createRoomPreviewer();
        const avatarRenderManager = {
            getFigureStringWithFigureIds: vi.fn(),
            isValidFigureSetForGender: vi.fn(() => true),
            structureData: { getFigurePartSet: vi.fn(() => ({ id: 101 })) }
        };

        vi.mocked(GetAvatarRenderManager).mockReturnValue(avatarRenderManager as any);
        vi.mocked(GetSessionDataManager).mockReturnValue({
            figure: 'base-figure',
            gender: 'M',
            getFloorItemData: () => ({ customParams: '101' })
        } as any);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer: createFloorOffer(1), roomPreviewer } as any);

        render(<CatalogViewProductWidgetView />);

        await waitFor(() => {
            expect(roomPreviewer.reset).toHaveBeenCalledWith(false);
            expect(roomPreviewer.addFurnitureIntoRoom).toHaveBeenCalledWith(500, expect.anything(), null, '');
            expect(roomPreviewer.addAvatarIntoRoom).not.toHaveBeenCalled();
        });
    });

    it('keeps the base avatar usable when clothing metadata is missing or malformed', async () => {
        const roomPreviewer = createRoomPreviewer();
        const avatarRenderManager = {
            getFigureStringWithFigureIds: vi.fn(() => ''),
            isValidFigureSetForGender: vi.fn()
        };
        const offer = createFloorOffer(23);

        offer.product.furnitureData = { ...offer.product.furnitureData, customParams: '101broken, 0x65, 1e2, 0, -2' } as any;
        vi.mocked(GetAvatarRenderManager).mockReturnValue(avatarRenderManager as any);
        vi.mocked(GetSessionDataManager).mockReturnValue({
            figure: 'base-figure',
            gender: 'F',
            getFloorItemData: () => null
        } as any);
        vi.mocked(useCatalogData).mockReturnValue({ currentOffer: offer, roomPreviewer } as any);

        render(<CatalogViewProductWidgetView />);

        await waitFor(() => {
            expect(avatarRenderManager.getFigureStringWithFigureIds).toHaveBeenCalledWith('base-figure', 'F', []);
            expect(avatarRenderManager.isValidFigureSetForGender).not.toHaveBeenCalled();
            expect(roomPreviewer.addAvatarIntoRoom).toHaveBeenCalledWith('base-figure', 0);
        });
    });
});
