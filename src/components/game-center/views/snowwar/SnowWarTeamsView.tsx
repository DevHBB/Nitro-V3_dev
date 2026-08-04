import { FC } from 'react';
import { GetConfigurationValue, GetSessionDataManager, LocalizeText } from '../../../../api';
import snowStormLogo from '../../../../assets/images/snowstorm/original/snowstorm_logo.png';
import { LayoutAvatarImageView } from '../../../../common';
import { useSnowWar } from '../../../../hooks';

// Red = team 0, Blue = team 1 (matches the arena's TEAM_COLORS ordering).
const TEAMS = [
    { id: 0, color: '#e64545', glow: 'rgba(230, 69, 69, 0.45)', nameKey: 'snowwar.team.red', nameFallback: 'Red Team', dir: 2 },
    { id: 1, color: '#4577e6', glow: 'rgba(69, 119, 230, 0.45)', nameKey: 'snowwar.team.blue', nameFallback: 'Blue Team', dir: 4 },
];

const localizeWithFallback = (key: string, fallback: string) =>
{
    const text = LocalizeText(key);
    return text && text !== key ? text : fallback;
};

const getArenaPreviewUrl = (arenaId: number, official: boolean) =>
{
    const imageLibraryUrl = GetConfigurationValue<string>('image.library.url', '');
    const baseUrl = imageLibraryUrl && !imageLibraryUrl.endsWith('/') ? `${imageLibraryUrl}/` : imageLibraryUrl;
    return `${baseUrl}snowstorm_client/arena_${official ? arenaId : 1}_preview.png`;
};

/**
 * Pre-match "getting ready" screen shown during the lobby countdown: the
 * waiting players already split into their Red / Blue teams, so everyone can
 * see the line-up forming before the arena splash takes over. Fed by the
 * server's provisional lobby-teams broadcast (re-sent each countdown second).
 */
export const SnowWarTeamsView: FC = () =>
{
    const { phase, lobbyTeams, lobbySeconds, queueSize, queueInfo, leaveQueue, selectArena, startEditing } = useSnowWar();

    const players = lobbyTeams?.players ?? [];
    const minPlayers = queueInfo?.minPlayers ?? 0;
    const ownUserId = GetSessionDataManager()?.userId ?? 0;
    const isLeader = lobbyTeams?.leaderUserId === ownUserId;

    // Status line: still waiting for players (below the minimum), or the lobby
    // countdown once enough have joined and the match is forming.
    const status = (phase === 'lobby')
        ? (lobbySeconds > 0
            ? localizeWithFallback('snowwar.lobby.starting', 'Game starts in %seconds%s...').replace('%seconds%', lobbySeconds.toString())
            : localizeWithFallback('snowwar.lobby.going', 'Going to the arena...'))
        : (minPlayers > 1 && queueSize < minPlayers)
            ? localizeWithFallback('snowwar.queue.awaiting', 'Waiting for players: %count%/%min%')
                .replace('%count%', queueSize.toString())
                .replace('%min%', minPlayers.toString())
            : localizeWithFallback('snowwar.queue.waiting', 'Waiting for players...');

    return (
        <div className="snowwar-teams">
            {queueInfo?.canEdit && (
                <div className="snowwar-teams__topbar">
                    <button type="button" className="snowwar-button snowwar-button--edit" onClick={() => startEditing()}>
                        {localizeWithFallback('snowwar.editor.build_custom', 'Build Custom Arena')}
                    </button>
                </div>
            )}
            <img className="snowwar-lobby__logo" src={snowStormLogo} alt="SnowStorm" />
            <div className="snowwar-teams__title">
                {localizeWithFallback('snowwar.teams.assembling', 'Assembling teams...')}
            </div>
            <div className="snowwar-teams__countdown">{status}</div>

            {!!lobbyTeams?.arenas.length && (
                <div className="snowwar-teams__arenas">
                    <div className="snowwar-teams__arena-heading">
                        {isLeader
                            ? localizeWithFallback('snowwar.arena.choose', 'Choose the arena')
                            : localizeWithFallback('snowwar.arena.leader', 'The lobby leader chooses the arena')}
                    </div>
                    <div className="snowwar-teams__arena-list">
                        {lobbyTeams.arenas.map(arena =>
                        {
                            const selected = lobbyTeams.selectedArenaId === arena.id;
                            const name = arena.official
                                ? localizeWithFallback(`gamecenter.snowwar.map.name.${arena.id}`, arena.name)
                                : arena.name;
                            return (
                                <button
                                    key={arena.id}
                                    type="button"
                                    className={`snowwar-teams__arena${selected ? ' snowwar-teams__arena--selected' : ''}`}
                                    disabled={!isLeader}
                                    aria-pressed={selected}
                                    onClick={() => selectArena(arena.id)}>
                                    <img src={getArenaPreviewUrl(arena.id, arena.official)} alt="" />
                                    {!arena.official && <small>{localizeWithFallback('snowwar.arena.custom', 'Custom')}</small>}
                                    <span>{name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="snowwar-teams__board">
                {TEAMS.map(team =>
                {
                    const roster = players.filter(player => (player.teamId % TEAMS.length) === team.id);
                    return (
                        <div key={team.id} className="snowwar-teams__panel" style={{ borderColor: team.color, boxShadow: `0 4px 18px ${team.glow}` }}>
                            <div className="snowwar-teams__panel-header" style={{ background: team.color }}>
                                <span>{localizeWithFallback(team.nameKey, team.nameFallback)}</span>
                                <span className="snowwar-teams__count">{roster.length}</span>
                            </div>
                            <div className="snowwar-teams__roster">
                                {roster.length === 0 && (
                                    <div className="snowwar-teams__empty">
                                        {localizeWithFallback('snowwar.teams.waiting', 'Waiting for players...')}
                                    </div>
                                )}
                                {roster.map(player => (
                                    <div key={player.userId} className="snowwar-teams__player">
                                        <div className="snowwar-teams__avatar">
                                            <LayoutAvatarImageView figure={player.figure} gender={player.gender} direction={team.dir} scale={0.5} />
                                        </div>
                                        <div className="snowwar-teams__name">{player.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="snowwar-lobby__spinner" />

            {(phase === 'queued') && (
                <button type="button" className="snowwar-button snowwar-button--danger snowwar-teams__leave" onClick={() => leaveQueue()}>
                    {localizeWithFallback('snowwar.queue.leave', 'Leave queue')}
                </button>
            )}
        </div>
    );
};
