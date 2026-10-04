import type { EpisodeListItemData } from '../../../shared';

export interface EpisodeListEntry {
    readonly id: string;
    /** The season's highest-rated episode. */
    readonly isBest: boolean;
    /** Accessible name, e.g. "Episode 8: Better Call Saul"; used by the season ratings strip. */
    readonly label: string;
    readonly item: EpisodeListItemData;
}
