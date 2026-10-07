import { formatTitleWithYear, SeoMetadata, SeoPreviewType, toSeoImage } from '../../shared';
import { MediaDetails } from './media-store.service';

interface MediaSeoOptions {
    readonly titleSuffix?: string;
    readonly description?: string;
}

export const toMediaSeoMetadata = (media: MediaDetails, options: MediaSeoOptions = {}): SeoMetadata => {
    const mediaLabel = media.mediaType === 'tv' ? 'TV Series' : 'Movie';
    const titleSuffix = options.titleSuffix ?? mediaLabel;
    const displayTitle = formatTitleWithYear(media.title, media.year);
    const fallbackDescription = `Explore cast, trailers, photos, reviews, ratings, and more for ${displayTitle}.`;

    return {
        title: `${displayTitle} | ${titleSuffix}`,
        description: options.description ?? (media.overview || fallbackDescription),
        ...toSeoImage(media.backdropPath, media.posterPath),
        imageAlt: `${media.title} poster and backdrop`,
        type: getMediaSeoType(media.mediaType),
    };
};

export const toMediaSectionSeoMetadata = (media: MediaDetails, sectionTitle: string): SeoMetadata =>
    toMediaSeoMetadata(media, {
        titleSuffix: sectionTitle,
        description: toMediaSectionDescription(media, sectionTitle),
    });

const getMediaSeoType = (mediaType: MediaDetails['mediaType']): SeoPreviewType =>
    mediaType === 'tv' ? 'video.tv_show' : 'video.movie';

const toMediaSectionDescription = (media: MediaDetails, sectionTitle: string): string => {
    const displayTitle = formatTitleWithYear(media.title, media.year);

    switch (sectionTitle) {
        case 'Cast & Crew':
            return `Full cast and crew for ${displayTitle}, including actors, creators, and production credits.`;
        case 'Videos':
            return `Trailers, teasers, clips, and videos for ${displayTitle}.`;
        case 'Photos':
            return `Posters, backdrops, and photos from ${displayTitle}.`;
        case 'Reviews':
            return `Reviews and audience reactions for ${displayTitle}.`;
        case 'Episodes':
            return `Episodes, seasons, air dates, videos, and photos for ${displayTitle}.`;
        default:
            if (sectionTitle.endsWith(' Episodes')) {
                return `${sectionTitle} from ${displayTitle}, with air dates, ratings, photos, and videos.`;
            }

            if (sectionTitle.endsWith(' Photos')) {
                return `Photos from ${sectionTitle.replace(/ Photos$/, '')} of ${displayTitle}.`;
            }

            return `${sectionTitle} for ${displayTitle}.`;
    }
};
