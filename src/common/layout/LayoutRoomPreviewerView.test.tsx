import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutRoomPreviewerView } from './LayoutRoomPreviewerView';

const previewMocks = vi.hoisted(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    destroy: vi.fn()
}));

vi.mock('@nitrots/nitro-renderer', () => ({
    GetRenderer: () => ({
        render: vi.fn(),
        texture: { generateCanvas: vi.fn() }
    }),
    GetTicker: () => ({ add: previewMocks.add, remove: previewMocks.remove }),
    NitroLogger: { error: vi.fn() },
    TextureUtils: { createRenderTexture: () => ({ destroy: previewMocks.destroy }) }
}));

class ResizeObserverMock {
    public observe = vi.fn();
    public disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

afterEach(cleanup);

describe('LayoutRoomPreviewerView interactions', () => {
    it('keeps furniture state on a single click', () => {
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            changeRoomObjectState: vi.fn(),
            getRenderingCanvas: vi.fn(() => null),
            getRoomCanvas: vi.fn(),
            modifyRoomCanvas: vi.fn(),
            updatePreviewRoomView: vi.fn()
        } as any;

        const view = render(<LayoutRoomPreviewerView height={200} roomPreviewer={roomPreviewer} />);
        fireEvent.click(view.container.querySelector('.shadow-room-previewer')!);

        expect(roomPreviewer.changeRoomObjectState).toHaveBeenCalledOnce();
    });

    it('keeps preview clicks dedicated to furniture state even with modifier keys', () => {
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            changeRoomObjectState: vi.fn(),
            getRenderingCanvas: vi.fn(() => null),
            getRoomCanvas: vi.fn(),
            modifyRoomCanvas: vi.fn(),
            updatePreviewRoomView: vi.fn()
        } as any;

        const view = render(<LayoutRoomPreviewerView height={200} roomPreviewer={roomPreviewer} />);
        fireEvent.click(view.container.querySelector('.shadow-room-previewer')!, { shiftKey: true });

        expect(roomPreviewer.changeRoomObjectDirection).not.toHaveBeenCalled();
        expect(roomPreviewer.changeRoomObjectState).toHaveBeenCalledOnce();
    });

    it('does not cycle avatar actions from the preview surface', () => {
        const roomPreviewer = {
            changeRoomObjectDirection: vi.fn(),
            changeRoomObjectState: vi.fn(),
            cycleAvatarAction: vi.fn(),
            getPreviewCapabilities: () => ({ mode: 'avatar' }),
            getRenderingCanvas: vi.fn(() => null),
            getRoomCanvas: vi.fn(),
            modifyRoomCanvas: vi.fn(),
            updatePreviewRoomView: vi.fn()
        } as any;

        const view = render(<LayoutRoomPreviewerView height={200} roomPreviewer={roomPreviewer} />);
        fireEvent.click(view.container.querySelector('.shadow-room-previewer')!);

        expect(roomPreviewer.cycleAvatarAction).not.toHaveBeenCalled();
        expect(roomPreviewer.changeRoomObjectState).toHaveBeenCalledOnce();
    });
});
