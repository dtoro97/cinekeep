import { pluralize } from './pluralize';

/** `toEpisodeLabel(12)` → `12 episodes`; no label for a missing or zero count. */
export const toEpisodeLabel = (episodeCount: number | undefined): string | null =>
    episodeCount ? pluralize(episodeCount, 'episode') : null;
