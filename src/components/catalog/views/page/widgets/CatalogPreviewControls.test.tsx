import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductTypeEnum } from '../../../../../api';
import { CatalogPreviewControls } from './CatalogPreviewControls';

afterEach(cleanup);

describe('standard catalog product preview controls', () => {
    it('provides independent left/right rotation, interaction and zoom controls', () => {
        const rotations: boolean[] = [];
        let interactions = 0;
        let zoomIns = 0;
        let zoomOuts = 0;
        const roomPreviewer = {
            changeRoomObjectDirection: (clockwise: boolean) => rotations.push(clockwise),
            changeRoomObjectState: () => interactions++,
            zoomIn: () => zoomIns++,
            zoomOut: () => zoomOuts++
        } as any;

        render(<CatalogPreviewControls productType={ProductTypeEnum.FLOOR} roomPreviewer={roomPreviewer} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
        fireEvent.click(screen.getByRole('button', { name: 'Change state' }));
        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));

        expect(rotations).toEqual([false, true]);
        expect(interactions).toBe(1);
        expect(zoomIns).toBe(1);
        expect(zoomOuts).toBe(1);
    });

    it('renders only actions supported by the loaded preview object', () => {
        const capabilities = {
            mode: 'wall',
            canRotate: true,
            canChangeState: false,
            canUseAvatarActions: false,
            canZoomIn: false,
            canZoomOut: true
        };
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            changeRoomObjectState: vi.fn(),
            getPreviewCapabilities: () => capabilities,
            subscribePreviewCapabilities: () => () => undefined,
            zoomIn: vi.fn(),
            zoomOut: vi.fn()
        } as any;

        render(<CatalogPreviewControls productType={ProductTypeEnum.WALL} roomPreviewer={roomPreviewer} />);

        expect(screen.getByRole('button', { name: 'Rotate left' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Rotate right' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    });

    it('does not expose furniture actions for an avatar preview', () => {
        const capabilities = {
            mode: 'avatar',
            canRotate: false,
            canChangeState: false,
            canUseAvatarActions: true,
            canZoomIn: true,
            canZoomOut: false
        };
        const roomPreviewer = {
            getPreviewCapabilities: () => capabilities,
            subscribePreviewCapabilities: () => () => undefined,
            zoomIn: vi.fn(),
            zoomOut: vi.fn()
        } as any;

        render(<CatalogPreviewControls productType={ProductTypeEnum.EFFECT} roomPreviewer={roomPreviewer} />);

        expect(screen.queryByRole('button', { name: 'Rotate left' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    });

    it('keeps standard preview actions from leaking into the room-canvas click handler', () => {
        const canvasClick = vi.fn();
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            changeRoomObjectState: vi.fn(),
            zoomIn: vi.fn(),
            zoomOut: vi.fn()
        } as any;

        const view = render(
            <div onClick={canvasClick}>
                <CatalogPreviewControls productType={ProductTypeEnum.FLOOR} roomPreviewer={roomPreviewer} />
            </div>
        );

        fireEvent.click(within(view.container).getByRole('button', { name: 'Change state' }));

        expect(roomPreviewer.changeRoomObjectState).toHaveBeenCalledOnce();
        expect(canvasClick).not.toHaveBeenCalled();
    });
});
