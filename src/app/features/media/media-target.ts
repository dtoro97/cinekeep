import { MediaType, parseBoundedIntegerParam, parsePositiveIntegerParam } from '../../shared';

export interface MediaTarget {
    readonly id: number;
    readonly type: MediaType;
}

export interface EpisodeTarget {
    readonly seriesId: number;
    readonly seasonNumber: number;
    readonly episodeNumber: number;
}

export const isSameMediaTarget = (left: MediaTarget | null, right: MediaTarget): boolean =>
    left?.id === right.id && left.type === right.type;

export const isSameEpisodeTarget = (left: EpisodeTarget | null, right: EpisodeTarget): boolean =>
    left?.seriesId === right.seriesId &&
    left.seasonNumber === right.seasonNumber &&
    left.episodeNumber === right.episodeNumber;

const isMediaType = (value: string | null | undefined): value is MediaType => value === 'movie' || value === 'tv';

/** `null` when the route params do not name a movie or TV series. */
export const toMediaTarget = (id: string | null | undefined, type: string | null | undefined): MediaTarget | null => {
    const mediaId = parsePositiveIntegerParam(id);

    return mediaId !== null && isMediaType(type) ? { id: mediaId, type } : null;
};

/** `null` when the route params do not form a valid episode (seasons start at 0 for specials). */
export const toEpisodeTarget = (
    seriesId: number,
    seasonNumber: string | null | undefined,
    episodeNumber: string | null | undefined,
): EpisodeTarget | null => {
    const season = parseBoundedIntegerParam(seasonNumber, 0, Number.MAX_SAFE_INTEGER);
    const episode = parsePositiveIntegerParam(episodeNumber);

    return season !== null && episode !== null ? { seriesId, seasonNumber: season, episodeNumber: episode } : null;
};
