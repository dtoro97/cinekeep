export const formatTitleWithYear = (title: string, year: string | null | undefined): string =>
    year ? `${title} (${year})` : title;

export const formatEpisodeCode = (seasonNumber: number, episodeNumber: number): string =>
    `S${seasonNumber}E${episodeNumber}`;
