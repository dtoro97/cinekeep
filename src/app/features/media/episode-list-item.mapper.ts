import type { TvEpisode, TvEpisodeCompact } from '../../api';
import { EpisodeListItemData, formatEpisodeCode, isDefined, MediaListItemBadge, toRating } from '../../shared';

interface EpisodeListItemOptions {
    /** Shows the `S2E8` code; season lists lead with the episode number instead. */
    readonly showCode?: boolean;
    /** The season to link to when the episode does not carry its own season number. */
    readonly fallbackSeasonNumber?: number;
    readonly badges?: readonly MediaListItemBadge[];
}

/** A TMDb episode as a list row linking to its episode page. */
export const toEpisodeListItem = (
    episode: TvEpisode | TvEpisodeCompact,
    seriesId: number,
    { showCode = false, fallbackSeasonNumber, badges }: EpisodeListItemOptions = {},
): EpisodeListItemData => {
    const seasonNumber = episode.season_number ?? fallbackSeasonNumber;
    const episodeNumber = episode.episode_number;
    const hasNumbers = isDefined(seasonNumber) && isDefined(episodeNumber);

    return {
        name: episode.name ?? 'Untitled episode',
        subtitle: null,
        overview: episode.overview ?? '',
        stillPath: episode.still_path ?? null,
        code: showCode && hasNumbers ? formatEpisodeCode(seasonNumber, episodeNumber) : null,
        episodeNumber: episodeNumber ?? null,
        airDate: episode.air_date ?? null,
        runtime: episode.runtime ?? null,
        voteAverage: toRating(episode.vote_average),
        badges,
        routeCommands: hasNumbers ? ['/title', seriesId, 'tv', 'episodes', seasonNumber, episodeNumber] : null,
    };
};
