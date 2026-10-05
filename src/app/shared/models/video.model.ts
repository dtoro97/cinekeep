import type { RouteCommands } from '../types';

export interface VideoCardItem {
    id: string;
    title: string;
    thumbnailUrl: string;
    alt: string;
    openLabel: string;
    typeLabel?: string;
    publishedAt?: string;
    /** The movie or series the video belongs to, when the card is shown away from its title page. */
    mediaTitle?: string;
    mediaLink?: RouteCommands;
    href?: string;
}
