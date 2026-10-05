export const formatTitleWithYear = (title: string, year: string | null | undefined): string =>
    year ? `${title} (${year})` : title;

/** "2001–2005", or a single year when the range has no known or different end; null without a start. */
export const formatYearRange = (first: string | null | undefined, last: string | null | undefined): string | null =>
    !first ? null : !last || first === last ? first : `${first}–${last}`;

export const formatEpisodeCode = (seasonNumber: number, episodeNumber: number): string =>
    `S${seasonNumber}E${episodeNumber}`;
