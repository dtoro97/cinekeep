import { PersonCardItem } from '../../../shared';

/** How many cast members the credits summary grid shows. */
export const TOP_CAST_GRID_COUNT = 12;

const EPISODE_DIRECTOR_PREVIEW_COUNT = 5;

export interface CreditsSummaryLink {
    readonly id?: number | null;
    readonly name?: string | null;
}

export interface CreditsSummary {
    readonly topCast: readonly PersonCardItem[];
    readonly hasTopCast: boolean;
    /** Series directors are per-episode, so they get their own row under the cast. */
    readonly episodeDirectors: {
        readonly visible: readonly CreditsSummaryLink[];
        readonly hiddenCount: number;
    } | null;
}

export const toCreditsSummary = (
    topCast: readonly PersonCardItem[],
    episodeDirectors: readonly CreditsSummaryLink[],
): CreditsSummary => ({
    topCast,
    hasTopCast: topCast.length > 0,
    episodeDirectors: episodeDirectors.length
        ? {
              visible: episodeDirectors.slice(0, EPISODE_DIRECTOR_PREVIEW_COUNT),
              hiddenCount: Math.max(0, episodeDirectors.length - EPISODE_DIRECTOR_PREVIEW_COUNT),
          }
        : null,
});
