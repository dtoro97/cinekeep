import { UserListResponse } from '../../api-cinekeep';
import { UserListCoverChoice, toUserListCoverChoice } from './user-list-cover';
import { DEFAULT_USER_LIST_SORT_BY } from './user-list-sort-options';

export interface UserListCover {
    readonly path: string;
    readonly params: string;
    // Posters are cropped toward the top so faces and titles survive the wide frame.
    readonly isPoster: boolean;
}

export interface UserListSummaryItem {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly sortBy: UserListResponse.SortByEnum;
    readonly updatedAt: string | null;
    readonly numberOfItems: number | null;
    readonly cover: UserListCover | null;
    readonly coverChoice: UserListCoverChoice | null;
}

export const toUserListSummaryItem = (list: UserListResponse): UserListSummaryItem | null => {
    const name = list.name?.trim();
    const { backdropPath, posterPath } = list.cover ?? {};

    if (!list.id || !name) {
        return null;
    }

    return {
        id: list.id,
        name,
        description: list.description?.trim() || null,
        sortBy: list.sortBy ?? DEFAULT_USER_LIST_SORT_BY,
        updatedAt: list.updatedAt ?? list.createdAt ?? null,
        numberOfItems: list.itemCount ?? null,
        cover: backdropPath
            ? { path: backdropPath, params: 'w780', isPoster: false }
            : posterPath
              ? { path: posterPath, params: 'w500', isPoster: true }
              : null,
        coverChoice: toUserListCoverChoice(list.cover),
    };
};
