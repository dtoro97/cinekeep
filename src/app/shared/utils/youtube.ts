import { Video } from '../../api';

export const buildYoutubeWatchUrl = (key: string): string => `https://www.youtube.com/watch?v=${key}`;

export const buildYoutubeThumbnailUrl = (key: string): string => `https://img.youtube.com/vi/${key}/hqdefault.jpg`;

/** The YouTube videos, trailers first. */
export const toYoutubeVideos = (videos: readonly Video[]): Video[] => {
    const toRank = (video: Video) => (video.type?.toLowerCase() === 'trailer' ? 0 : 1);

    return videos.filter((video) => video.site === 'YouTube').sort((left, right) => toRank(left) - toRank(right));
};

/** The best YouTube trailer: official ones first, and ones in `language` before any other. */
export const pickBestYoutubeTrailer = (videos: readonly Video[], language?: string): Video | null => {
    const trailers = videos.filter((video) => video.site === 'YouTube' && !!video.key && video.type === 'Trailer');
    const inLanguage = trailers.filter((video) => !!language && video.iso_639_1?.toLowerCase() === language);

    return (
        inLanguage.find((video) => video.official) ??
        inLanguage[0] ??
        trailers.find((video) => video.official) ??
        trailers[0] ??
        null
    );
};
