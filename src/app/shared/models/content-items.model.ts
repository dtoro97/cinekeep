import type { BadgeVariant, MediaType, RouteCommands } from '../types';

export interface KnownForLink {
    id: number;
    title: string;
    mediaType: MediaType;
}

export interface PersonLink {
    id: number;
    name: string;
}

export interface MediaListItemBadge {
    readonly label: string;
    readonly variant?: BadgeVariant;
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
    castLinks?: PersonLink[];
    badges?: readonly MediaListItemBadge[];
}

export interface MediaListEntry {
    readonly item: MediaListItem;
    readonly genreNames: readonly string[];
    readonly routerLink: RouteCommands;
}

export interface PersonCardItem {
    id: number;
    name: string;
    imagePath: string | null;
    subtitle: string;
}

export interface PersonListItem extends PersonCardItem {
    knownForLinks: KnownForLink[];
}

export interface CardItem {
    id: number;
    mediaType: MediaType;
    title: string;
    imagePath: string | null;
    backdropPath: string | null;
    rating: number | null;
    date: string;
    overview: string;
    routeCommands?: RouteCommands;
    role?: string;
}

