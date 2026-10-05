import type { ListCoverResponse } from '../../api-cinekeep';
import { MediaType, toMediaKey } from '../../shared';

/** A cover the user picked from the list's own items. `null` means automatic (latest added). */
export interface UserListCoverChoice {
    readonly tmdbId: number;
    readonly mediaType: MediaType;
}

/** A list item offered as a cover in the edit dialog. */
export interface UserListCoverCandidate extends UserListCoverChoice {
    readonly key: string;
    readonly title: string;
    readonly backdropPath: string;
}

/** The user's explicit cover; the backend's automatic fallback (`selected: false`) maps to `null`. */
export const toUserListCoverChoice = (cover: ListCoverResponse | undefined): UserListCoverChoice | null =>
    cover?.selected && cover.tmdbId && cover.mediaType ? { tmdbId: cover.tmdbId, mediaType: cover.mediaType } : null;

export const toUserListCoverKey = (cover: UserListCoverChoice | null): string =>
    cover ? toMediaKey(cover.mediaType, cover.tmdbId) : 'automatic';

export const isSameUserListCover = (a: UserListCoverChoice | null, b: UserListCoverChoice | null): boolean =>
    toUserListCoverKey(a) === toUserListCoverKey(b);
