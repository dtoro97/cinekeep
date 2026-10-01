import type { MediaType } from '../types';

export interface KnownForLink {
    id: number;
    title: string;
    mediaType: MediaType;
}

export interface PersonLink {
    id: number;
    name: string;
}

export type MediaListItemBadgeVariant = 'neutral' | 'accent' | 'outline';

export interface MediaListItemBadge {
    readonly label: string;
    readonly variant?: MediaListItemBadgeVariant;
}

export interface MediaListItem {
    id: number;
    thumb: string | null;
    title: string;
    overview: string;
    rating: number | null;
    date: string;
    mediaType: MediaType;
    genreIds?: number[];
    voteCount?: number;
    castLinks?: PersonLink[];
    badges?: readonly MediaListItemBadge[];
}

export interface MediaListEntry {
    readonly item: MediaListItem;
    readonly genreNames: readonly string[];
    readonly routerLink: readonly (string | number)[];
}

export interface PersonListItem {
    id: number;
    thumb: string | null;
    title: string;
    department: string;
    knownForLinks: KnownForLink[];
}

export interface PersonCardItem {
    id: number;
    name: string;
    imagePath: string | null;
    subtitle: string;
}

export interface SearchResultItem {
    id: number;
    thumb: string | null;
    title: string;
    year: string;
    mediaType: string;
    mediaTypeLabel: string;
    overview: string;
    rating: number | null;
    department: string;
    known_for?: string;
}

export type CardItem<TExtra extends object = object> = {
    id: number;
    mediaType: MediaType;
    title: string;
    imagePath: string | null;
    backdropPath: string | null;
    rating: number | null;
    date: string;
    overview: string;
    routeCommands?: readonly (string | number)[];
    role?: string;
} & TExtra;

export interface VideoTrailerSeedItem {
    mediaId: number;
    mediaType: MediaType;
    mediaTitle: string;
    mediaYear: string;
    mediaOverview: string;
    mediaPosterPath: string | null;
    backdropPath: string | null;
}

