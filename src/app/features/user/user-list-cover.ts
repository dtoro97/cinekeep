import type { ListCoverResponse } from '../../api-cinekeep';
import { MediaType, toMediaKey } from '../../shared';

// `null` stands for the automatic cover, the latest added title.
export interface UserListCoverChoice {
    readonly tmdbId: number;
    readonly mediaType: MediaType;
}

export interface UserListCoverCandidate extends UserListCoverChoice {
    readonly key: string;
    readonly title: string;
    readonly backdropPath: string;
}

// The backend's automatic fallback (`selected: false`) maps to `null`.
export const toUserListCoverChoice = (cover: ListCoverResponse | undefined): UserListCoverChoice | null =>
    cover?.selected && cover.tmdbId && cover.mediaType ? { tmdbId: cover.tmdbId, mediaType: cover.mediaType } : null;

export const toUserListCoverKey = (cover: UserListCoverChoice | null): string =>
    cover ? toMediaKey(cover.mediaType, cover.tmdbId) : 'automatic';
