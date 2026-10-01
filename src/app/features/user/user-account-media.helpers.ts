import { EpisodeRatingResponse } from '../../api-cinekeep';
import { MediaType, RemoteData, pluralize } from '../../shared';

interface MediaIdentity {
    readonly id: number;
    readonly mediaType: MediaType;
}

export function toUserMediaTotalLabel(mediaType: MediaType, totalResults: number): string {
    if (mediaType === 'tv') {
        return `${totalResults} TV series`;
    }

    return pluralize(totalResults, 'movie');
}

export function toTotalAfterMediaRemoval<T extends MediaIdentity>(
    itemsState: RemoteData<readonly T[]>,
    item: MediaIdentity,
    totalResults: number,
): number {
    const itemWasLoaded =
        itemsState.state === 'success' &&
        itemsState.data.some((pageItem) => pageItem.id === item.id && pageItem.mediaType === item.mediaType);

    return itemWasLoaded ? Math.max(0, totalResults - 1) : totalResults;
}

export interface RatedEpisodeRef {
    readonly seriesId: number;
    readonly seasonNumber: number;
    readonly episodeNumber: number;
    readonly title: string;
}

/** `null` when the rating lacks the ids needed to link to its episode. */
export function toRatedEpisodeRef(item: EpisodeRatingResponse): RatedEpisodeRef | null {
    const { seriesTmdbId, seasonNumber, episodeNumber } = item;

    if (seriesTmdbId == null || seasonNumber == null || episodeNumber == null) {
        return null;
    }

    return {
        seriesId: seriesTmdbId,
        seasonNumber,
        episodeNumber,
        title: item.episodeName?.trim() || 'Untitled episode',
    };
}
