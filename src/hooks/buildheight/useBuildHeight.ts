import { BuildHeightAvailableEvent, SetBuildHeightComposer } from '@nitrots/nitro-renderer';
import { useCallback, useState } from 'react';
import { useBetween } from 'use-between';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../events';

const HEIGHT_SCALE = 100;

const useBuildHeightState = () => {
    const [available, setAvailable] = useState(false);
    const [minHeight, setMinHeight] = useState(-40);
    const [maxHeight, setMaxHeight] = useState(40);
    const [isOpen, setIsOpen] = useState(false);
    const [height, setHeight] = useState(0);

    useMessageEvent<BuildHeightAvailableEvent>(BuildHeightAvailableEvent, event => {
        const parser = event.getParser();

        setAvailable(parser.available);
        setMinHeight(parser.minHeight);
        setMaxHeight(parser.maxHeight);

        setIsOpen(false);
        setHeight(0);
    });

    const applyHeight = useCallback((value: number) => {
        setHeight(value);
        SendMessageComposer(new SetBuildHeightComposer(true, Math.round(value * HEIGHT_SCALE)));
    }, []);

    const open = useCallback(() => setIsOpen(true), []);

    const close = useCallback(() => {
        setIsOpen(false);
        setHeight(0);
        SendMessageComposer(new SetBuildHeightComposer(false, 0));
    }, []);

    const toggle = useCallback(() => {
        if (isOpen) close();
        else open();
    }, [isOpen, close, open]);

    return { available, minHeight, maxHeight, isOpen, height, applyHeight, open, close, toggle };
};

export const useBuildHeight = () => useBetween(useBuildHeightState);
