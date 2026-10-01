import { EpisodeRatingRequest, SeriesSnapshotRequest, WatchlistItemResponse } from '../../api-cinekeep';
import { CardItem, MediaListItem } from '../models';
import type { MediaType } from '../types';

/** The snapshot fields every CineKeep item response shares (watchlist, favorites, ratings, list items). */
export type MediaSnapshot = Pick<
    WatchlistItemResponse,
    'tmdbId' | 'mediaType' | 'title' | 'posterPath' | 'backdropPath' | 'overview' | 'releaseDate' | 'voteAverage' | 'voteCount'
>;

/** The snapshot sent when saving any title; the generated client names it after its series use. */
export type MediaSnapshotRequest = SeriesSnapshotRequest;

export type EpisodeSnapshotRequest = Omit<EpisodeRatingRequest, 'value'>;

interface MediaIdentity {
    readonly id: number;
    readonly mediaType: MediaType;
    readonly title: string;
}

function toMediaIdentity(item: MediaSnapshot): MediaIdentity | null {
    const title = item.title?.trim();

    return item.tmdbId && item.mediaType && title ? { id: item.tmdbId, mediaType: item.mediaType, title } : null;
}

export function toSnapshotCardItem(item: MediaSnapshot, rating: number | null): CardItem | null {
    const identity = toMediaIdentity(item);

    if (!identity) {
        return null;
    }

    return {
        ...identity,
        imagePath: item.posterPath ?? null,
        backdropPath: item.backdropPath ?? null,
        rating,
        date: item.releaseDate ?? '',
        overview: item.overview ?? '',
    };
}

export function toSnapshotMediaListItem(item: MediaSnapshot, rating: number | null): MediaListItem | null {
    const identity = toMediaIdentity(item);

    if (!identity) {
        return null;
    }

    return {
        ...identity,
        thumb: item.posterPath ?? null,
        overview: item.overview ?? '',
        rating,
        date: item.releaseDate ?? '',
        voteCount: item.voteCount ?? 0,
    };
}

/** The TMDb fields a snapshot is built from; matches movies, TV series and search results. */
interface TmdbMediaLike {
    readonly title?: string | null;
    readonly name?: string | null;
    readonly original_title?: string | null;
    readonly original_name?: string | null;
    readonly poster_path?: string | null;
    readonly backdrop_path?: string | null;
    readonly overview?: string | null;
    readonly release_date?: string | null;
    readonly first_air_date?: string | null;
    readonly vote_average?: number | null;
    readonly vote_count?: number | null;
}

interface TmdbEpisodeLike {
    readonly name?: string | null;
    readonly still_path?: string | null;
    readonly air_date?: string | null;
}

export function toMediaSnapshotRequest(media: TmdbMediaLike, mediaType: MediaType): MediaSnapshotRequest {
    const title =
        mediaType === 'tv'
            ? media.name?.trim() || media.original_name?.trim()
            : media.title?.trim() || media.original_title?.trim();

    // Empty TMDb strings are dropped: CineKeep keeps a stored field only when none is sent.
    return {
        title: title || 'Untitled',
        posterPath: media.poster_path || undefined,
        backdropPath: media.backdrop_path || undefined,
        overview: media.overview || undefined,
        releaseDate: (mediaType === 'tv' ? media.first_air_date : media.release_date) || undefined,
        voteAverage: media.vote_average ?? undefined,
        voteCount: media.vote_count ?? undefined,
    };
}

export function toEpisodeSnapshotRequest(
    episode: TmdbEpisodeLike,
    episodeNumber: number,
    series: MediaSnapshotRequest,
): EpisodeSnapshotRequest {
    return {
        episodeName: episode.name?.trim() || `Episode ${episodeNumber}`,
        stillPath: episode.still_path || undefined,
        airDate: episode.air_date || undefined,
        series,
    };
}
