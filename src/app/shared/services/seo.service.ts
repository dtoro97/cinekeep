import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { buildTmdbImageUrl } from '../utils/tmdb-image';

export type SeoPreviewType = 'website' | 'profile' | 'video.movie' | 'video.tv_show';

export interface SeoMetadata {
    readonly title?: string | null;
    readonly description?: string | null;
    readonly path?: string | null;
    readonly canonicalUrl?: string | null;
    readonly image?: string | null;
    readonly imageAlt?: string | null;
    readonly imageWidth?: number | null;
    readonly imageHeight?: number | null;
    readonly robots?: string | null;
    readonly type?: SeoPreviewType;
}

const SITE_NAME = 'CineKeep';
const SITE_ORIGIN = 'https://cinekeep.vercel.app/';
const DEFAULT_DESCRIPTION =
    'Find what to watch next: trending movies and TV series, trailers, cast, photos, reviews, and people in a clean cinematic guide.';
const DEFAULT_PREVIEW_IMAGE = '/og-image.png';
const DEFAULT_PREVIEW_IMAGE_WIDTH = 1200;
const DEFAULT_PREVIEW_IMAGE_HEIGHT = 630;
const DEFAULT_ROBOTS = 'index, follow';
const DESCRIPTION_MAX_LENGTH = 180;

/** A wide image goes out as a 1280×720 preview; without one, the fallback (a poster) goes out unsized. */
export const toSeoImage = (
    widePath: string | null | undefined,
    fallbackPath?: string | null,
): Pick<SeoMetadata, 'image' | 'imageWidth' | 'imageHeight'> =>
    widePath
        ? { image: buildTmdbImageUrl(widePath, 'w1280'), imageWidth: 1280, imageHeight: 720 }
        : {
              image: buildTmdbImageUrl(fallbackPath, 'w780'),
              imageWidth: null,
              imageHeight: null,
          };

@Injectable({ providedIn: 'root' })
export class SeoService {
    constructor(
        private readonly meta: Meta,
        private readonly title: Title,
        @Inject(DOCUMENT) private readonly document: Document,
    ) {}

    setPage(metadata: SeoMetadata = {}): void {
        const previewTitle =
            (cleanText(metadata.title) ?? SITE_NAME)
                .split('|')
                .map((part) => part.trim())
                .filter(Boolean)
                .join(' - ') || SITE_NAME;
        const cleanedDescription = cleanText(metadata.description);
        const description = !cleanedDescription
            ? DEFAULT_DESCRIPTION
            : cleanedDescription.length <= DESCRIPTION_MAX_LENGTH
              ? cleanedDescription
              : `${cleanedDescription.slice(0, DESCRIPTION_MAX_LENGTH - 3).trimEnd()}...`;
        const location = this.document.location;
        const currentPath = location ? `${location.pathname}${location.search}` : '/';
        const canonicalUrl = toAbsoluteSiteUrl(metadata.canonicalUrl || (metadata.path ?? currentPath));
        const image = toAbsoluteSiteUrl(cleanText(metadata.image) ?? DEFAULT_PREVIEW_IMAGE);
        const isDefaultImage = image === toAbsoluteSiteUrl(DEFAULT_PREVIEW_IMAGE);
        const imageAlt = cleanText(metadata.imageAlt) ?? `${previewTitle} on ${SITE_NAME}`;

        this.title.setTitle(previewTitle === SITE_NAME ? SITE_NAME : `${previewTitle} - ${SITE_NAME}`);

        let canonicalLink = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

        if (!canonicalLink) {
            canonicalLink = this.document.createElement('link');
            canonicalLink.rel = 'canonical';
            this.document.head.appendChild(canonicalLink);
        }

        canonicalLink.href = canonicalUrl;

        this.updateNameTag('description', description);
        this.updateNameTag('robots', cleanText(metadata.robots) ?? DEFAULT_ROBOTS);
        this.updatePropertyTag('og:type', metadata.type ?? 'website');
        this.updatePropertyTag('og:site_name', SITE_NAME);
        this.updatePropertyTag('og:title', previewTitle);
        this.updatePropertyTag('og:description', description);
        this.updatePropertyTag('og:url', canonicalUrl);
        this.updatePropertyTag('og:image', image);
        this.updatePropertyTag('og:image:secure_url', image);
        this.updatePropertyTag('og:image:alt', imageAlt);
        this.updateOptionalPropertyTag(
            'og:image:width',
            metadata.imageWidth || (isDefaultImage ? DEFAULT_PREVIEW_IMAGE_WIDTH : null),
        );
        this.updateOptionalPropertyTag(
            'og:image:height',
            metadata.imageHeight || (isDefaultImage ? DEFAULT_PREVIEW_IMAGE_HEIGHT : null),
        );
        this.updateNameTag('twitter:card', 'summary_large_image');
        this.updateNameTag('twitter:title', previewTitle);
        this.updateNameTag('twitter:description', description);
        this.updateNameTag('twitter:image', image);
        this.updateNameTag('twitter:image:alt', imageAlt);
    }

    private updateNameTag(name: string, content: string): void {
        this.meta.updateTag({ name, content }, `name='${name}'`);
    }

    private updatePropertyTag(property: string, content: string): void {
        this.meta.updateTag({ property, content }, `property='${property}'`);
    }

    private updateOptionalPropertyTag(property: string, content: number | null): void {
        if (content) {
            this.updatePropertyTag(property, String(content));
            return;
        }

        this.meta.removeTag(`property='${property}'`);
    }
}

function cleanText(value: string | null | undefined): string | null {
    return value?.replace(/\s+/g, ' ').trim() || null;
}

function toAbsoluteSiteUrl(value: string): string {
    return new URL(value.split('#')[0] || '/', SITE_ORIGIN).toString();
}
