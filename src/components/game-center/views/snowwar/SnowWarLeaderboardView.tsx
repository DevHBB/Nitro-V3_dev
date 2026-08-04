import { FC, useEffect, useMemo, useState } from 'react';
import { GetConfigurationValue, GetSessionDataManager, LocalizeText } from '../../../../api';
import { LayoutAvatarImageView } from '../../../../common';
import { useSnowWar } from '../../../../hooks';

const PAGE_SIZE = 8;

const localizeWithFallback = (key: string, fallback: string) =>
{
    const text = LocalizeText(key);
    return text && text !== key ? text : fallback;
};

const getAssetUrl = (name: string) =>
{
    const library = GetConfigurationValue<string>('image.library.url', '');
    const base = library && !library.endsWith('/') ? `${library}/` : library;
    return `${base}snowstorm_client/${name}.png`;
};

export const SnowWarLeaderboardView: FC = () =>
{
    const { leaderboard, requestLeaderboard, closeLeaderboard } = useSnowWar();
    const [rowOffset, setRowOffset] = useState(0);
    const [clock, setClock] = useState(Date.now());
    const ownUserId = GetSessionDataManager()?.userId ?? 0;

    useEffect(() => setRowOffset(0), [leaderboard.weekly, leaderboard.friendsOnly, leaderboard.currentOffset]);
    useEffect(() =>
    {
        if (!leaderboard.weekly) return;
        const tick = () => setClock(Date.now());
        const interval = setInterval(tick, 30000);
        document.addEventListener('visibilitychange', tick);
        return () =>
        {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [leaderboard.weekly]);

    const visibleEntries = useMemo(() =>
    {
        const page = leaderboard.entries.slice(rowOffset, rowOffset + PAGE_SIZE);
        const own = leaderboard.entries.find(entry => entry.userId === ownUserId);
        if (!leaderboard.friendsOnly && own && !page.some(entry => entry.userId === ownUserId))
            return [ ...page.slice(0, PAGE_SIZE - 1), own ];
        return page;
    }, [leaderboard.entries, leaderboard.friendsOnly, ownUserId, rowOffset]);

    const resetDeadline = useMemo(() => Date.now() + (leaderboard.minutesUntilReset * 60000), [leaderboard.minutesUntilReset]);
    const minutesLeft = Math.max(0, Math.ceil((resetDeadline - clock) / 60000));
    const days = Math.floor(minutesLeft / 1440);
    const hours = Math.floor((minutesLeft % 1440) / 60);
    const minutes = minutesLeft % 60;
    const canScrollUp = rowOffset > 0;
    const canScrollDown = rowOffset + PAGE_SIZE < leaderboard.entries.length;

    if (!leaderboard.isOpen) return null;

    return (
        <div className="snowwar-leaderboard-overlay">
            <div className="snowwar-leaderboard" style={{ backgroundImage: `url(${getAssetUrl('leaderboard_bg')})` }}>
                <button className="snowwar-leaderboard__close" type="button" onClick={closeLeaderboard} aria-label={localizeWithFallback('generic.close', 'Close')}>×</button>

                <div className="snowwar-leaderboard__tabs">
                    <button
                        type="button"
                        className={`snowwar-leaderboard__tab ${leaderboard.weekly ? 'is-active' : ''}`}
                        style={{ backgroundImage: `url(${getAssetUrl(leaderboard.weekly ? 'left_blue' : 'left_black')})` }}
                        onClick={() => requestLeaderboard(true, leaderboard.friendsOnly, 0)}>
                        {leaderboard.weekly && leaderboard.currentOffset > 0
                            ? `${leaderboard.year}/${leaderboard.week}`
                            : localizeWithFallback('snowwar.leaderboard.this_week', 'This week')}
                    </button>
                    <button
                        type="button"
                        className={`snowwar-leaderboard__tab ${!leaderboard.weekly ? 'is-active' : ''}`}
                        style={{ backgroundImage: `url(${getAssetUrl(!leaderboard.weekly ? 'right_blue' : 'right_black')})` }}
                        onClick={() => requestLeaderboard(false, leaderboard.friendsOnly, 0)}>
                        {localizeWithFallback('snowwar.leaderboard.all_time', 'All time')}
                    </button>
                </div>

                <button
                    type="button"
                    className="snowwar-leaderboard__scroll snowwar-leaderboard__scroll--up"
                    disabled={!canScrollUp}
                    style={{ backgroundImage: `url(${getAssetUrl(canScrollUp ? 'scroll_up_normal' : 'scroll_up_inactive')})` }}
                    onClick={() => setRowOffset(offset => Math.max(0, offset - PAGE_SIZE))}
                    aria-label="Scroll up" />

                <div className="snowwar-leaderboard__list">
                    {leaderboard.loading && <div className="snowwar-leaderboard__empty">{localizeWithFallback('generic.loading', 'Loading...')}</div>}
                    {!leaderboard.loading && !visibleEntries.length && (
                        <div className="snowwar-leaderboard__empty">{localizeWithFallback('gamecenter.leaderboard_empty', 'No scores yet.')}</div>
                    )}
                    {!leaderboard.loading && visibleEntries.map(entry => (
                        <div key={`${entry.userId}-${entry.rank}`} className={`snowwar-leaderboard__row ${entry.userId === ownUserId ? 'is-own' : ''}`}>
                            {entry.userId === ownUserId && <img className="snowwar-leaderboard__highlight" src={getAssetUrl('leaderboard_highlighter')} alt="" />}
                            <span className="snowwar-leaderboard__rank">{entry.rank}</span>
                            <span className="snowwar-leaderboard__avatar"><LayoutAvatarImageView figure={entry.figure} gender={entry.gender} direction={2} scale={0.5} /></span>
                            <span className="snowwar-leaderboard__name">{entry.name}</span>
                            <span className="snowwar-leaderboard__score">{entry.score}</span>
                            <img className="snowwar-leaderboard__divider" src={getAssetUrl('leaderboard_divider')} alt="" />
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    className="snowwar-leaderboard__scroll snowwar-leaderboard__scroll--down"
                    disabled={!canScrollDown}
                    style={{ backgroundImage: `url(${getAssetUrl(canScrollDown ? 'scroll_down_normal' : 'scroll_down_inactive')})` }}
                    onClick={() => setRowOffset(offset => Math.min(Math.max(0, leaderboard.entries.length - PAGE_SIZE), offset + PAGE_SIZE))}
                    aria-label="Scroll down" />

                {leaderboard.weekly && (
                    <>
                        <button
                            type="button"
                            className="snowwar-leaderboard__week snowwar-leaderboard__week--newer"
                            disabled={leaderboard.currentOffset <= 0}
                            style={{ backgroundImage: `url(${getAssetUrl('scroll_left')})` }}
                            onClick={() => requestLeaderboard(true, leaderboard.friendsOnly, leaderboard.currentOffset - 1)}
                            aria-label="Newer week" />
                        <button
                            type="button"
                            className="snowwar-leaderboard__week snowwar-leaderboard__week--older"
                            disabled={leaderboard.currentOffset >= leaderboard.maxOffset}
                            style={{ backgroundImage: `url(${getAssetUrl('scroll_right')})` }}
                            onClick={() => requestLeaderboard(true, leaderboard.friendsOnly, leaderboard.currentOffset + 1)}
                            aria-label="Older week" />
                        {leaderboard.currentOffset === 0 && (
                            <div className="snowwar-leaderboard__reset">
                                {localizeWithFallback('snowwar.leaderboard.weekly_reset', 'Reset: %days%d %hours%h %minutes%m')
                                    .replace('%days%', days.toString())
                                    .replace('%hours%', hours.toString())
                                    .replace('%minutes%', minutes.toString())}
                            </div>
                        )}
                    </>
                )}

                <button
                    type="button"
                    className="snowwar-leaderboard__view"
                    onClick={() => requestLeaderboard(leaderboard.weekly, !leaderboard.friendsOnly, leaderboard.currentOffset)}>
                    {leaderboard.friendsOnly
                        ? localizeWithFallback('snowwar.leaderboard.all', 'Everyone')
                        : localizeWithFallback('snowwar.leaderboard.friends', 'Friends')}
                </button>
            </div>
        </div>
    );
};
