import {
    buildTmdbImageUrl,
    SeoMetadata,
    SeoPreviewType,
} from '../../shared';
import { MediaDetails } from './models/media-details.model';

interface MediaSeoOptions {
    readonly titleSuffix?: string;
    readonly description?: string;
}

export const toMediaSeoMetadata = (
    media: MediaDetails,
    options: MediaSeoOptions = {},
): SeoMetadata => {
    const mediaLabel = media.mediaType === 'tv' ? 'TV series' : 'Movie';
    const titleSuffix = options.titleSuffix ?? mediaLabel;
    const imagePath = media.backdropPath ?? media.posterPath;
    const hasBackdrop = !!media.backdropPath && imagePath === media.backdropPath;
    const fallbackDescription = `Explore ${media.title} on CineKeep, including cast, trailers, photos, reviews, and recommendations.`;

    return {
        title: `${media.title} | ${titleSuffix}`,
        description: options.description ?? (media.overview || fallbackDescription),
        image: buildTmdbImageUrl(imagePath, hasBackdrop ? 'w1280' : 'w780'),
        imageAlt: `${media.title} poster and backdrop`,
        imageWidth: hasBackdrop ? 1280 : null,
        imageHeight: hasBackdrop ? 720 : null,
        type: getMediaSeoType(media.mediaType),
    };
};

export const toMediaSectionSeoMetadata = (
    media: MediaDetails,
    sectionTitle: string,
): SeoMetadata =>
    toMediaSeoMetadata(media, {
        titleSuffix: sectionTitle,
        description: [
            `${sectionTitle} for ${media.title}${media.year ? ` (${media.year})` : ''}.`,
            media.overview,
        ]
            .filter(Boolean)
            .join(' '),
    });

const getMediaSeoType = (mediaType: MediaDetails['mediaType']): SeoPreviewType =>
    mediaType === 'tv' ? 'video.tv_show' : 'video.movie';
