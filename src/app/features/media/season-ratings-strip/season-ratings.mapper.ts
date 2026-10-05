import type { EpisodeListEntry } from '../episode-list/episode-list.models';
import type { RouteCommands } from '../../../shared';

export interface SeasonRatingBar {
    readonly id: string;
    readonly episodeNumber: number | null;
    /** The rating with one decimal, or an empty string for unrated episodes. */
    readonly ratingLabel: string;
    /** Bar height relative to the season's own range, so small differences stay visible. */
    readonly heightPercent: number;
    readonly isBest: boolean;
    readonly isRated: boolean;
    readonly label: string;
    readonly routeCommands: RouteCommands | null;
}

const MIN_BAR_PERCENT = 18;
const UNRATED_BAR_PERCENT = 6;

/** Bars for the season's episode ratings; empty when fewer than two episodes are rated. */
export const toSeasonRatingBars = (entries: readonly EpisodeListEntry[]): SeasonRatingBar[] => {
    const ratings = entries.map((entry) => entry.item.voteAverage ?? 0).filter((rating) => rating > 0);

    if (ratings.length < 2) {
        return [];
    }

    const min = Math.min(...ratings);
    const range = Math.max(...ratings) - min;

    return entries.map((entry) => {
        const rating = entry.item.voteAverage ?? 0;
        const isRated = rating > 0;
        const share = range > 0 ? (rating - min) / range : 1;

        return {
            id: entry.id,
            episodeNumber: entry.item.episodeNumber,
            ratingLabel: isRated ? rating.toFixed(1) : '',
            heightPercent: isRated
                ? Math.round(MIN_BAR_PERCENT + share * (100 - MIN_BAR_PERCENT))
                : UNRATED_BAR_PERCENT,
            isBest: entry.isBest,
            isRated,
            label: isRated ? `${entry.label}, rated ${rating.toFixed(1)}` : `${entry.label}, not rated yet`,
            routeCommands: entry.item.routeCommands,
        };
    });
};
