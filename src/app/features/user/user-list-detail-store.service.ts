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
} from '../../shared';
import { DEFAULT_USER_LIST_SORT_BY } from './user-list-sort-options';

export interface UserListDetailHeader {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly itemCount: number;
    readonly updatedLabel: string | null;
}

export interface UserListDetailItem {
    readonly key: string;
    readonly id: number;
    readonly mediaType: MediaType;
    readonly mediaItem: MediaListItem;
    readonly title: string;
    readonly comment: string;
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
    readonly isPublic: boolean;
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
    isPublic: false,
};

@Injectable()
export class UserListDetailStore extends ComponentStore<UserListDetailState> {
    readonly userListDetailVm$ = this.select((state) => ({
        header: state.headerState,
        items: state.itemsState,
        page: state.page - 1,
        pageSize: PAGE_SIZE,
        total: state.totalResults,
        sortBy: state.activeSortBy,
        defaultSortBy: state.defaultSortBy,
        isPublic: state.isPublic,
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
            isPublic: false,
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
        readonly isPublic: boolean;
        readonly sortBy?: UserListSortBy;
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
                isPublic: request.isPublic,
                sortBy: nextDefaultSortBy,
            })
            .pipe(
                tap(() => {
                    this.patchState((state) => ({
                        headerState:
                            state.headerState.state === 'success'
                                ? remoteSuccess({
                                      ...state.headerState.data,
                                      name: request.name,
                                      description: request.description || null,
                                  })
                                : state.headerState,
                        defaultSortBy: nextDefaultSortBy,
                        activeSortBy:
                            request.sortBy && state.activeSortBy === state.defaultSortBy
                                ? request.sortBy
                                : state.activeSortBy,
                        isPublic: request.isPublic,
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

        return this.userLibraryService
            .removeItem$(state.listId, item.id, item.mediaType)
            .pipe(
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

        return this.userLibraryService
            .updateItemComment$(state.listId, item.id, item.mediaType, comment)
            .pipe(
                tap(() => {
                    this.patchState((state) => ({
                        itemsState: updateRemoteData(state.itemsState, (items) =>
                            items.map((existingItem) =>
                                existingItem.key === item.key
                                    ? {
                                          ...existingItem,
                                          comment,
                                      }
                                    : existingItem,
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
            }),
            itemsState: remoteSuccess(items),
            page,
            totalPages: Math.max(1, result.items?.totalPages ?? 1),
            totalResults,
            activeSortBy,
            defaultSortBy: list.sortBy ?? fallbackDefaultSortBy,
            isPublic: list.isPublic === true,
        };
    }

    private toItem(item: UserListItemResponse): UserListDetailItem | null {
        const mediaItem = toSnapshotMediaListItem(item, item.voteAverage ?? null);

        if (!mediaItem) {
            return null;
        }

        return {
            key: `${mediaItem.mediaType}:${mediaItem.id}`,
            id: mediaItem.id,
            mediaType: mediaItem.mediaType,
            mediaItem: {
                ...mediaItem,
                badges: [{ label: mediaItem.mediaType === 'tv' ? 'TV series' : 'Movie' }],
            },
            title: mediaItem.title,
            comment: item.comment ?? '',
            link: ['/', 'title', mediaItem.id, mediaItem.mediaType],
        };
    }
}
