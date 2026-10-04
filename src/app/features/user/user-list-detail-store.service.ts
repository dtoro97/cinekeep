import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, catchError, of, switchMap, tap, throwError } from 'rxjs';

import { UserListDetailsResponse, UserListItemResponse } from '../../api-cinekeep';
import { PAGE_SIZE } from '../../constants';
import {
    RemoteData,
    MediaListItem,
    MediaType,
    UserLibraryService,
    UserListSortBy,
    isDefined,
    remoteSuccess,
    toSnapshotMediaListItem,
    toUpdatedAtLabel,
    updateRemoteData,
    pluralize,
    toRating,
} from '../../shared';
import { UserListCoverChoice, isSameUserListCover, toUserListCoverChoice } from './user-list-cover';
import { DEFAULT_USER_LIST_SORT_BY, toUserListSort } from './user-list-sort-options';

export interface UserListDetailHeader {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly itemCount: number;
    readonly updatedLabel: string | null;
    /** The list's cover backdrop, shown behind the page header. */
    readonly backdropPath: string | null;
    /** The cover the user picked; `null` while the automatic cover is used. */
    readonly cover: UserListCoverChoice | null;
}

export interface UserListDetailItem {
    readonly key: string;
    readonly id: number;
    readonly mediaType: MediaType;
    readonly mediaItem: MediaListItem;
    readonly title: string;
    readonly comment: string;
    /** "Add comment" or "Edit comment", matching whether the item has one. */
    readonly commentActionLabel: string;
    readonly link: (string | number)[];
}

interface UserListDetailState {
    readonly listId: number | null;
    readonly headerState: RemoteData<UserListDetailHeader>;
    readonly itemsState: RemoteData<UserListDetailItem[]>;
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
    readonly activeSortBy: UserListSortBy;
    readonly defaultSortBy: UserListSortBy;
}

const INITIAL_STATE: UserListDetailState = {
    listId: null,
    headerState: { state: 'notAsked' },
    itemsState: { state: 'notAsked' },
    page: 1,
    totalPages: 1,
    totalResults: 0,
    activeSortBy: DEFAULT_USER_LIST_SORT_BY,
    defaultSortBy: DEFAULT_USER_LIST_SORT_BY,
};

@Injectable()
export class UserListDetailStore extends ComponentStore<UserListDetailState> {
    readonly userListDetailVm$ = this.select((state) => ({
        header: state.headerState,
        headerSubtitle: state.headerState.state === 'success' ? toHeaderSubtitle(state.headerState.data) : null,
        items: state.itemsState,
        page: state.page - 1,
        pageSize: PAGE_SIZE,
        total: state.totalResults,
        sortBy: state.activeSortBy,
        sort: toUserListSort(state.activeSortBy),
        defaultSortBy: state.defaultSortBy,
    }));

    constructor(private readonly userLibraryService: UserLibraryService) {
        super(INITIAL_STATE);
    }

    loadList$(listId: number) {
        this.patchState({
            listId,
            headerState: { state: 'loading' },
            itemsState: { state: 'loading' },
            page: 1,
            totalPages: 1,
            totalResults: 0,
            activeSortBy: DEFAULT_USER_LIST_SORT_BY,
            defaultSortBy: DEFAULT_USER_LIST_SORT_BY,
        });

        return this.fetchAndPatchPage$(listId, 1, undefined, DEFAULT_USER_LIST_SORT_BY, INITIAL_STATE);
    }

    reload$() {
        const state = this.get();

        if (state.listId === null) {
            return EMPTY;
        }

        return this.loadPage$(state.page - 1);
    }

    loadPage$(pageIndex: number) {
        const state = this.get();

        if (state.listId === null) {
            return EMPTY;
        }

        const page = pageIndex + 1;

        this.patchState({
            itemsState: { state: 'loading' },
            page,
        });

        return this.fetchAndPatchPage$(state.listId, page, state.activeSortBy, state.defaultSortBy, state);
    }

    setSortBy$(sortBy: UserListSortBy) {
        const state = this.get();

        if (state.listId === null || sortBy === state.activeSortBy) {
            return EMPTY;
        }

        this.patchState({
            activeSortBy: sortBy,
            itemsState: { state: 'loading' },
            page: 1,
            totalPages: 1,
            totalResults: 0,
        });

        return this.fetchAndPatchPage$(state.listId, 1, sortBy, state.defaultSortBy, state);
    }

    updateList$(request: {
        readonly name: string;
        readonly description: string;
        readonly sortBy?: UserListSortBy;
        readonly cover: UserListCoverChoice | null;
    }) {
        const state = this.get();

        if (state.listId === null || state.headerState.state !== 'success') {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        const nextDefaultSortBy = request.sortBy ?? state.defaultSortBy;

        return this.userLibraryService
            .updateList$(state.listId, {
                name: request.name,
                description: request.description,
                sortBy: nextDefaultSortBy,
                cover: request.cover ?? undefined,
            })
            .pipe(
                tap((list) => {
                    this.patchState((state) => ({
                        headerState:
                            state.headerState.state === 'success'
                                ? remoteSuccess({
                                      ...state.headerState.data,
                                      name: request.name,
                                      description: request.description || null,
                                      backdropPath: list.cover?.backdropPath ?? null,
                                      cover: toUserListCoverChoice(list.cover),
                                  })
                                : state.headerState,
                        defaultSortBy: nextDefaultSortBy,
                        activeSortBy:
                            request.sortBy && state.activeSortBy === state.defaultSortBy
                                ? request.sortBy
                                : state.activeSortBy,
                    }));
                }),
                switchMap(() =>
                    request.sortBy && state.activeSortBy === state.defaultSortBy ? this.reload$() : of(undefined),
                ),
            );
    }

    clearList$() {
        const state = this.get();

        if (state.listId === null || state.headerState.state !== 'success') {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        return this.userLibraryService.clearList$(state.listId).pipe(
            tap(() => {
                this.patchState((state) => ({
                    headerState:
                        state.headerState.state === 'success'
                            ? remoteSuccess({
                                  ...state.headerState.data,
                                  itemCount: 0,
                                  backdropPath: null,
                                  cover: null,
                              })
                            : state.headerState,
                    itemsState: remoteSuccess([]),
                    page: 1,
                    totalPages: 1,
                    totalResults: 0,
                }));
            }),
        );
    }

    deleteList$() {
        const state = this.get();

        if (state.listId === null) {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        return this.userLibraryService.deleteList$(state.listId);
    }

    removeItem$(item: UserListDetailItem) {
        const state = this.get();

        if (state.listId === null || state.headerState.state !== 'success') {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        return this.userLibraryService.removeItem$(state.listId, item.id, item.mediaType).pipe(
            switchMap(() => {
                const state = this.get();
                const totalResults = Math.max(0, state.totalResults - 1);
                const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
                const page = Math.min(state.page, totalPages);
                const nextItems =
                    state.itemsState.state === 'success'
                        ? state.itemsState.data.filter((existingItem) => existingItem.key !== item.key)
                        : null;

                this.patchState({
                    itemsState: nextItems ? remoteSuccess(nextItems) : state.itemsState,
                    page,
                    totalPages,
                    totalResults,
                    headerState:
                        state.headerState.state === 'success'
                            ? remoteSuccess({
                                  ...state.headerState.data,
                                  itemCount: Math.max(0, state.headerState.data.itemCount - 1),
                                  // The backend drops a picked cover when its item leaves the list.
                                  cover: isSameUserListCover(state.headerState.data.cover, {
                                      tmdbId: item.id,
                                      mediaType: item.mediaType,
                                  })
                                      ? null
                                      : state.headerState.data.cover,
                              })
                            : state.headerState,
                });

                if (totalResults > 0 && nextItems && (page !== state.page || nextItems.length === 0)) {
                    return this.loadPage$(page - 1);
                }

                return of(undefined);
            }),
        );
    }

    updateItemComment$(item: UserListDetailItem, comment: string) {
        const state = this.get();

        if (state.listId === null) {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        return this.userLibraryService.updateItemComment$(state.listId, item.id, item.mediaType, comment).pipe(
            tap(() => {
                this.patchState((state) => ({
                    itemsState: updateRemoteData(state.itemsState, (items) =>
                        items.map((existingItem) =>
                            existingItem.key === item.key ? withComment(existingItem, comment) : existingItem,
                        ),
                    ),
                }));
            }),
        );
    }

    private fetchAndPatchPage$(
        listId: number,
        page: number,
        sortBy: UserListSortBy | undefined,
        fallbackDefaultSortBy: UserListSortBy,
        restoreState: UserListDetailState,
    ) {
        return this.userLibraryService.getListDetails$(listId, page - 1, PAGE_SIZE, sortBy).pipe(
            tap((result) => {
                const defaultSortBy = result.list?.sortBy ?? fallbackDefaultSortBy;
                this.patchState(this.toLoadedPageState(result, page, sortBy ?? defaultSortBy, defaultSortBy));
            }),
            catchError((error: unknown) => {
                this.setState(restoreState);
                return throwError(() => error);
            }),
        );
    }

    private toLoadedPageState(
        result: UserListDetailsResponse,
        page: number,
        activeSortBy: UserListSortBy,
        fallbackDefaultSortBy: UserListSortBy,
    ) {
        const list = result.list ?? {};
        const items = (result.items?.content ?? []).map((item) => this.toItem(item)).filter(isDefined);
        const totalResults = result.items?.totalElements ?? list.itemCount ?? items.length;

        return {
            headerState: remoteSuccess({
                id: list.id ?? 0,
                name: list.name || 'Untitled List',
                description: list.description ?? null,
                itemCount: list.itemCount ?? totalResults,
                updatedLabel: toUpdatedAtLabel(list.updatedAt),
                backdropPath: list.cover?.backdropPath ?? null,
                cover: toUserListCoverChoice(list.cover),
            }),
            itemsState: remoteSuccess(items),
            page,
            totalPages: Math.max(1, result.items?.totalPages ?? 1),
            totalResults,
            activeSortBy,
            defaultSortBy: list.sortBy ?? fallbackDefaultSortBy,
        };
    }

    private toItem(item: UserListItemResponse): UserListDetailItem | null {
        const mediaItem = toSnapshotMediaListItem(item, toRating(item.voteAverage));

        if (!mediaItem) {
            return null;
        }

        return withComment(
            {
                key: `${mediaItem.mediaType}:${mediaItem.id}`,
                id: mediaItem.id,
                mediaType: mediaItem.mediaType,
                mediaItem: {
                    ...mediaItem,
                    badges: [{ label: mediaItem.mediaType === 'tv' ? 'TV series' : 'Movie' }],
                },
                title: mediaItem.title,
                link: ['/', 'title', mediaItem.id, mediaItem.mediaType],
            },
            item.comment ?? '',
        );
    }
}

const withComment = (
    item: Omit<UserListDetailItem, 'comment' | 'commentActionLabel'>,
    comment: string,
): UserListDetailItem => ({
    ...item,
    comment,
    commentActionLabel: comment ? 'Edit comment' : 'Add comment',
});

/** "12 titles · Updated 2 days ago". */
const toHeaderSubtitle = (header: UserListDetailHeader): string =>
    [pluralize(header.itemCount, 'title'), header.updatedLabel].filter(isDefined).join(' · ');
