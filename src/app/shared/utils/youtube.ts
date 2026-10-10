import { Video } from '../../api';

export const buildYoutubeWatchUrl = (key: string): string => `https://www.youtube.com/watch?v=${key}`;

/**
 * Thumbnails largest first. `maxresdefault` is a true 16:9 still; the smaller sizes are 4:3 with the bars baked in,
 * and YouTube answers a missing size with a 120x90 placeholder, so callers fall back down the list.
 */
export const buildYoutubeThumbnailUrls = (key: string): string[] =>
    ['maxresdefault', 'sddefault', 'hqdefault'].map((size) => `https://i.ytimg.com/vi/${key}/${size}.jpg`);

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
