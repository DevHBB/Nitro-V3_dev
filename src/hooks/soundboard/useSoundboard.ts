import {
    GetSessionDataManager,
    ISoundboardSound,
    loadGamedata,
    SoundboardPlayComposer,
    SoundboardPlayEvent,
    SoundboardSetEnabledComposer,
    SoundboardSettingsEvent
} from '@nitrots/nitro-renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBetween } from 'use-between';
import { DispatchUiEvent, GetConfigurationValue, SendMessageComposer, setSoundboardRoomEnabled } from '../../api';
import { SoundboardRoomMessageEvent } from '../../events';
import { useMessageEvent } from '../events';
import { SoundboardAudioController } from './SoundboardAudioController';
import {
    DisplaySoundboardSound,
    mergeSoundboardPresentation,
    normalizeSoundboardLayout,
    pushRecentSound,
    SoundboardCategory,
    SoundboardLayout
} from './soundboardPresentation';
import { getRemainingCooldownSeconds, shouldStartOwnCooldown } from './soundboardUi.helpers';

export type ClientSoundboardSound = DisplaySoundboardSound;

const resolveSoundUrl = (url: string): string => {
    if (!url) return '';

    // Keep explicit schemes intact so the audio controller can validate them.
    if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')) return url;

    const base = (GetConfigurationValue<string>('soundboard.url.prefix') || GetConfigurationValue<string>('asset.url') || '').replace(/\/+$/, '');
    return base ? `${base}/${url.replace(/^\/+/, '')}` : url;
};

const useSoundboardState = () => {
    const [enabled, setEnabled] = useState(false);
    const [serverSounds, setServerSounds] = useState<ISoundboardSound[]>([]);
    const [layout, setLayout] = useState<SoundboardLayout>(() => normalizeSoundboardLayout(null));
    const [recentSoundIds, setRecentSoundIds] = useState<number[]>([]);
    const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
    const cooldownSecondsRef = useRef(0);
    const cooldownUntilRef = useRef(0);
    const audioControllerRef = useRef<SoundboardAudioController | null>(null);

    if (!audioControllerRef.current) audioControllerRef.current = new SoundboardAudioController();

    const handleSettings = useCallback((event: SoundboardSettingsEvent) => {
        const parser = event.getParser();
        cooldownSecondsRef.current = Math.max(0, parser.cooldownSeconds);
        setEnabled(parser.enabled);
        setServerSounds(parser.sounds);
        setSoundboardRoomEnabled(parser.enabled);
    }, []);

    useMessageEvent<SoundboardSettingsEvent>(SoundboardSettingsEvent, handleSettings);

    const handlePlay = useCallback((event: SoundboardPlayEvent) => {
        const parser = event.getParser();
        void audioControllerRef.current?.play(resolveSoundUrl(parser.url));
        setRecentSoundIds((current) => pushRecentSound(current, parser.soundId));
        DispatchUiEvent(new SoundboardRoomMessageEvent(parser.username, parser.soundName, parser.actorUserId, parser.actorRoomIndex));

        const ownUserId = GetSessionDataManager()?.getUserDataSnapshot?.().userId || -1;
        if (shouldStartOwnCooldown(parser.actorUserId, ownUserId, cooldownSecondsRef.current)) {
            const now = Date.now();
            cooldownUntilRef.current = now + cooldownSecondsRef.current * 1_000;
            setCooldownRemainingSeconds(getRemainingCooldownSeconds(cooldownUntilRef.current, now));
        }
    }, []);

    useMessageEvent<SoundboardPlayEvent>(SoundboardPlayEvent, handlePlay);

    const isCoolingDown = cooldownRemainingSeconds > 0;

    useEffect(() => {
        if (!isCoolingDown) return;

        const updateRemaining = () => setCooldownRemainingSeconds(getRemainingCooldownSeconds(cooldownUntilRef.current, Date.now()));
        const timer = window.setInterval(updateRemaining, 250);

        return () => window.clearInterval(timer);
    }, [isCoolingDown]);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        const url = GetConfigurationValue<string>('soundboard.layout.url') || 'configuration/soundboard-layout.jsonc';

        void loadGamedata<unknown>(url)
            .then((value) => {
                if (!cancelled) setLayout(normalizeSoundboardLayout(value));
            })
            .catch(() => {
                if (!cancelled) setLayout(normalizeSoundboardLayout(null));
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const sounds = useMemo<ClientSoundboardSound[]>(
        () => mergeSoundboardPresentation(serverSounds, layout),
        [serverSounds, layout]
    );
    const categories = layout.categories as SoundboardCategory[];

    const play = useCallback((sound: ClientSoundboardSound) => {
        if (!sound || getRemainingCooldownSeconds(cooldownUntilRef.current, Date.now()) > 0) return;
        SendMessageComposer(new SoundboardPlayComposer(sound.id));
    }, []);

    const setRoomEnabled = useCallback((value: boolean) => {
        setEnabled(value);
        setSoundboardRoomEnabled(value);
        SendMessageComposer(new SoundboardSetEnabledComposer(value));
    }, []);

    const reset = useCallback(() => {
        audioControllerRef.current?.stop();
        setEnabled(false);
        setServerSounds([]);
        setLayout(normalizeSoundboardLayout(null));
        setRecentSoundIds([]);
        setCooldownRemainingSeconds(0);
        cooldownUntilRef.current = 0;
        cooldownSecondsRef.current = 0;
        setSoundboardRoomEnabled(false);
    }, []);

    return { enabled, sounds, categories, recentSoundIds, isCoolingDown, play, setRoomEnabled, reset };
};

export const useSoundboard = () => useBetween(useSoundboardState);
