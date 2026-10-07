import type { TvEpisode, TvSeasonCompact } from '../../api';
import type { EpisodeTarget } from './media-target';
import type { RouteCommands } from '../../shared';

export interface EpisodePagerLink {
    /** "Episode 7", or "Season 1 finale" / "Season 3 premiere" across seasons. */
    readonly label: string;
    /** The neighbouring episode's name when the season's episode list is loaded. */
    readonly title: string | null;
    readonly routeCommands: RouteCommands;
}

export interface EpisodePager {
    readonly previous: EpisodePagerLink | null;
    readonly next: EpisodePagerLink | null;
}

/**
 * Previous/next episode links. Within a season they carry the episode names from the
 * season's episode list; across seasons they rely on the series' episode counts alone.
 * Specials (season 0) only link within themselves.
 */
export const toEpisodePager = (
    target: EpisodeTarget,
    seasons: readonly TvSeasonCompact[],
    seasonEpisodes: readonly TvEpisode[] | null,
): EpisodePager => {
    const { seriesId, seasonNumber, episodeNumber } = target;
    const routePrefix = ['/title', seriesId, 'tv', 'episodes'] as const;
    const episodeCount = (season: number): number =>
        seasons.find((item) => item.season_number === season)?.episode_count ?? 0;
    const names = new Map((seasonEpisodes ?? []).map((episode) => [episode.episode_number, episode.name ?? null]));
    const currentCount = seasonEpisodes?.length || episodeCount(seasonNumber);

    const previous: EpisodePagerLink | null =
        episodeNumber > 1
            ? {
                  label: `Episode ${episodeNumber - 1}`,
                  title: names.get(episodeNumber - 1) ?? null,
                  routeCommands: [...routePrefix, seasonNumber, episodeNumber - 1],
              }
            : seasonNumber > 1 && episodeCount(seasonNumber - 1) > 0
              ? {
                    label: `Season ${seasonNumber - 1} finale`,
                    title: null,
                    routeCommands: [...routePrefix, seasonNumber - 1, episodeCount(seasonNumber - 1)],
                }
              : null;

    const next: EpisodePagerLink | null =
        episodeNumber < currentCount
            ? {
                  label: `Episode ${episodeNumber + 1}`,
                  title: names.get(episodeNumber + 1) ?? null,
                  routeCommands: [...routePrefix, seasonNumber, episodeNumber + 1],
              }
            : seasonNumber > 0 && episodeCount(seasonNumber + 1) > 0
              ? {
                    label: `Season ${seasonNumber + 1} premiere`,
                    title: null,
                    routeCommands: [...routePrefix, seasonNumber + 1, 1],
                }
              : null;

    return { previous, next };
};
