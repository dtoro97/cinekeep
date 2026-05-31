import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export type SeoPreviewType =
    | 'website'
    | 'profile'
    | 'video.movie'
    | 'video.tv_show';

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

export const CINEKEEP_SITE_NAME = 'CineKeep';
export const CINEKEEP_SITE_ORIGIN = 'https://dtoro97.github.io/cinekeep/';
export const CINEKEEP_DEFAULT_DESCRIPTION =
    'Find what to watch next: trending movies and TV series, trailers, cast, photos, reviews, and people in a clean cinematic guide.';

const DEFAULT_PREVIEW_IMAGE = '/og-image.png';
const DEFAULT_PREVIEW_IMAGE_WIDTH = 1200;
const DEFAULT_PREVIEW_IMAGE_HEIGHT = 630;
const DEFAULT_ROBOTS = 'index, follow';
const DESCRIPTION_MAX_LENGTH = 180;

@Injectable({ providedIn: 'root' })
export class SeoService {
    constructor(
        private readonly meta: Meta,
        private readonly title: Title,
        @Inject(DOCUMENT) private readonly document: Document,
    ) {}

    setPage(metadata: SeoMetadata = {}): void {
        const pageTitle = this.cleanText(metadata.title) ?? CINEKEEP_SITE_NAME;
        const previewTitle = this.toPreviewTitle(pageTitle);
        const description =
            this.normalizeDescription(metadata.description) ??
            CINEKEEP_DEFAULT_DESCRIPTION;
        const canonicalUrl = this.resolveCanonicalUrl(metadata);
        const image = this.resolveImageUrl(metadata.image);
        const imageAlt =
            this.cleanText(metadata.imageAlt) ?? `${previewTitle} on ${CINEKEEP_SITE_NAME}`;
        const robots = this.cleanText(metadata.robots) ?? DEFAULT_ROBOTS;
        const type = metadata.type ?? 'website';

        this.title.setTitle(this.toDocumentTitle(pageTitle));
        this.updateCanonical(canonicalUrl);

        this.updateNameTag('description', description);
        this.updateNameTag('robots', robots);
        this.updatePropertyTag('og:type', type);
        this.updatePropertyTag('og:site_name', CINEKEEP_SITE_NAME);
        this.updatePropertyTag('og:title', previewTitle);
        this.updatePropertyTag('og:description', description);
        this.updatePropertyTag('og:url', canonicalUrl);
        this.updatePropertyTag('og:image', image);
        this.updatePropertyTag('og:image:secure_url', image);
        this.updatePropertyTag('og:image:alt', imageAlt);
        this.updateOptionalPropertyTag(
            'og:image:width',
            this.toDimensionContent(
                metadata.imageWidth,
                image,
                DEFAULT_PREVIEW_IMAGE_WIDTH,
            ),
        );
        this.updateOptionalPropertyTag(
            'og:image:height',
            this.toDimensionContent(
                metadata.imageHeight,
                image,
                DEFAULT_PREVIEW_IMAGE_HEIGHT,
            ),
        );
        this.updateNameTag('twitter:card', 'summary_large_image');
        this.updateNameTag('twitter:title', previewTitle);
        this.updateNameTag('twitter:description', description);
        this.updateNameTag('twitter:image', image);
        this.updateNameTag('twitter:image:alt', imageAlt);
    }

    private toDocumentTitle(pageTitle: string): string {
        const documentTitle = this.toPreviewTitle(pageTitle);

        if (documentTitle === CINEKEEP_SITE_NAME) {
            return CINEKEEP_SITE_NAME;
        }

        return `${documentTitle} - ${CINEKEEP_SITE_NAME}`;
    }

    private toPreviewTitle(pageTitle: string): string {
        const previewTitle = pageTitle
            .split('|')
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' - ');

        return previewTitle || CINEKEEP_SITE_NAME;
    }

    private normalizeDescription(value: string | null | undefined): string | null {
        const cleaned = this.cleanText(value);

        if (!cleaned) {
            return null;
        }

        if (cleaned.length <= DESCRIPTION_MAX_LENGTH) {
            return cleaned;
        }

        return `${cleaned.slice(0, DESCRIPTION_MAX_LENGTH - 3).trimEnd()}...`;
    }

    private cleanText(value: string | null | undefined): string | null {
        const cleaned = value?.replace(/\s+/g, ' ').trim();
        return cleaned ? cleaned : null;
    }

    private resolveCanonicalUrl(metadata: SeoMetadata): string {
        if (metadata.canonicalUrl) {
            return toAbsoluteSiteUrl(metadata.canonicalUrl);
        }

        return toAbsoluteSiteUrl(metadata.path ?? this.currentDocumentPath());
    }

    private resolveImageUrl(image: string | null | undefined): string {
        return toAbsoluteSiteUrl(this.cleanText(image) ?? DEFAULT_PREVIEW_IMAGE);
    }

    private toDimensionContent(
        dimension: number | null | undefined,
        image: string,
        defaultDimension: number,
    ): string | null {
        if (dimension) {
            return String(dimension);
        }

        return image === toAbsoluteSiteUrl(DEFAULT_PREVIEW_IMAGE)
            ? String(defaultDimension)
            : null;
    }

    private updateCanonical(url: string): void {
        let link = this.document.querySelector<HTMLLinkElement>(
            'link[rel="canonical"]',
        );

        if (!link) {
            link = this.document.createElement('link');
            link.rel = 'canonical';
            this.document.head.appendChild(link);
        }

        link.href = url;
    }

    private currentDocumentPath(): string {
        const location = this.document.location;

        if (!location) {
            return '/';
        }

        return `${location.pathname}${location.search}`;
    }

    private updateNameTag(name: string, content: string): void {
        this.meta.updateTag({ name, content }, `name='${name}'`);
    }

    private updatePropertyTag(property: string, content: string): void {
        this.meta.updateTag({ property, content }, `property='${property}'`);
    }

    private updateOptionalPropertyTag(
        property: string,
        content: string | null,
    ): void {
        if (content) {
            this.updatePropertyTag(property, content);
            return;
        }

        this.meta.removeTag(`property='${property}'`);
    }
}

export const buildTmdbImageUrl = (
    value: string | null | undefined,
    size = 'w1280',
): string | null => {
    if (!value) {
        return null;
    }

    if (value.startsWith('/http://') || value.startsWith('/https://')) {
        return value.slice(1);
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }

    const normalizedValue = value.startsWith('/') ? value : `/${value}`;
    return `https://image.tmdb.org/t/p/${size}${normalizedValue}`;
};

export const toAbsoluteSiteUrl = (value: string): string => {
    const cleaned = value.split('#')[0] || '/';
    return new URL(cleaned, CINEKEEP_SITE_ORIGIN).toString();
};
