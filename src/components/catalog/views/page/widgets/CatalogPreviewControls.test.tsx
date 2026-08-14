import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductTypeEnum } from '../../../../../api';
import { CatalogPreviewControls } from './CatalogPreviewControls';

afterEach(cleanup);

describe('standard catalog product preview controls', () => {
    it('provides independent left/right rotation and one contextual zoom control', () => {
        const rotations: boolean[] = [];
        let zoomIns = 0;
        let zoomOuts = 0;
        const roomPreviewer = {
            changeRoomObjectDirection: (clockwise: boolean) => rotations.push(clockwise),
            zoomIn: () => zoomIns++,
            zoomOut: () => zoomOuts++
        } as any;

        render(<CatalogPreviewControls productType={ProductTypeEnum.FLOOR} roomPreviewer={roomPreviewer} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
        fireEvent.click(screen.getByRole('button', { name: 'Toggle zoom' }));
        fireEvent.click(screen.getByRole('button', { name: 'Toggle zoom' }));

        expect(rotations).toEqual([false, true]);
        expect(screen.queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Zoom out' })).not.toBeInTheDocument();
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
        expect(screen.getByRole('button', { name: 'Toggle zoom' })).toBeEnabled();

        fireEvent.click(screen.getByRole('button', { name: 'Toggle zoom' }));

        expect(roomPreviewer.zoomOut).toHaveBeenCalledOnce();
    });

    it('keeps avatar actions out of the toolbar', () => {
        const capabilities = {
            mode: 'avatar',
            canRotate: true,
            canChangeState: false,
            canUseAvatarActions: true,
            canZoomIn: true,
            canZoomOut: false
        };
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            getPreviewCapabilities: () => capabilities,
            subscribePreviewCapabilities: () => () => undefined,
            zoomIn: vi.fn(),
            zoomOut: vi.fn()
        } as any;

        render(<CatalogPreviewControls productType={ProductTypeEnum.EFFECT} roomPreviewer={roomPreviewer} />);

        expect(screen.queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Rotate left' }));

        expect(roomPreviewer.changeRoomObjectDirection).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('button', { name: 'Change avatar action' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Toggle zoom' }));

        expect(roomPreviewer.zoomIn).toHaveBeenCalledOnce();
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

        fireEvent.click(within(view.container).getByRole('button', { name: 'Rotate left' }));

        expect(roomPreviewer.changeRoomObjectDirection).toHaveBeenCalledWith(false);
        expect(canvasClick).not.toHaveBeenCalled();
    });
});
