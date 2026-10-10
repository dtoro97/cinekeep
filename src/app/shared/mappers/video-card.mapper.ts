import { Video } from '../../api';
import { VideoCardItem } from '../models';
import { buildYoutubeThumbnailUrls, buildYoutubeWatchUrl } from '../utils';

export interface VideoCardMedia {
    readonly title: string;
}

export function toVideoCardItem(
    video: Video,
    media: VideoCardMedia,
): VideoCardItem | null {
    if (!video.id || !video.key) {
        return null;
    }

    const title = video.name ?? media.title;

    return {
        id: video.id,
        title,
        thumbnailUrls: buildYoutubeThumbnailUrls(video.key),
        alt: title,
        openLabel: `Open video: ${title}`,
        typeLabel: video.type,
        publishedAt: video.published_at,
        href: buildYoutubeWatchUrl(video.key),
    };
}

export function toVideoCardItems(
    videos: readonly Video[],
    media: VideoCardMedia,
): VideoCardItem[] {
    return videos.flatMap((video) => {
        const item = toVideoCardItem(video, media);

        return item ? [item] : [];
    });
}
