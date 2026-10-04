import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { catchError, map, of, switchMap, tap, throwError } from 'rxjs';

import { UserListControllerService, UserListResponse } from '../../api-cinekeep';
import { PAGE_SIZE } from '../../constants';
import { RemoteData, UserLibraryService, UserListSortBy, isDefined } from '../../shared';
import { remoteSuccess, toPageItemRange, updateRemoteData } from '../../shared/utils';
import { DEFAULT_USER_LIST_SORT_BY } from './user-list-sort-options';
import { UserListCoverChoice, toUserListCoverChoice } from './user-list-cover';

export interface UserListCover {
    readonly path: string;
    readonly params: string;
    /** Posters are cropped toward the top so faces and titles survive the wide frame. */
    readonly isPoster: boolean;
}

export interface UserListSummaryItem {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly sortBy: UserListSortBy;
    readonly createdAt: string | null;
    readonly updatedAt: string | null;
    readonly numberOfItems: number | null;
    readonly cover: UserListCover | null;
    /** The cover the user picked; `null` while the automatic cover is used. */
    readonly coverChoice: UserListCoverChoice | null;
}

interface UserListsState {
    readonly items: RemoteData<UserListSummaryItem[]>;
    readonly page: number;
    readonly totalPages: number;
    readonly totalResults: number;
}

const INITIAL_PAGE = 1;

const INITIAL_STATE: UserListsState = {
    items: { state: 'notAsked' },
    page: INITIAL_PAGE,
    totalPages: INITIAL_PAGE,
    totalResults: 0,
};

@Injectable()
export class UserListsStore extends ComponentStore<UserListsState> {
    readonly listsViewModel$ = this.select((state) => {
        const range = toPageItemRange({
            page: state.page,
            pageSize: PAGE_SIZE,
            itemCount: state.items.state === 'success' ? state.items.data.length : 0,
            totalResults: state.totalResults,
        });

        return {
            state: state.items,
            page: state.page - 1,
            pageSize: PAGE_SIZE,
            start: range.start,
            end: range.end,
            total: state.totalResults,
        };
    });

    constructor(
        private readonly userLibraryService: UserLibraryService,
        private readonly userListController: UserListControllerService,
    ) {
        super(INITIAL_STATE);
    }

    load$() {
        return this.loadPage$(0);
    }

    loadPage$(pageIndex: number) {
        const previousState = this.get();
        const page = pageIndex + 1;

        this.patchState({
            items: { state: 'loading' },
            page,
        });

        return this.fetchListsPage$(page).pipe(
            tap((result) => {
                this.patchState({
                    items: remoteSuccess(result.items),
                    page: result.page,
                    totalPages: result.totalPages,
                    totalResults: result.totalResults,
                });
            }),
            catchError((error: unknown) => {
                this.setState(previousState);
                return throwError(() => error);
            }),
        );
    }

    updateList$(
        listId: number,
        request: {
            readonly name: string;
            readonly description: string;
            readonly sortBy: UserListSortBy;
            readonly cover: UserListCoverChoice | null;
        },
    ) {
        return this.userLibraryService
            .updateList$(listId, {
                name: request.name,
                description: request.description,
                sortBy: request.sortBy,
                cover: request.cover ?? undefined,
            })
            .pipe(
                tap((list) => {
                    this.patchState((state) => ({
                        items: updateRemoteData(state.items, (items) =>
                            items.map((item) =>
                                item.id === listId
                                    ? {
                                          ...item,
                                          name: request.name,
                                          description: request.description || null,
                                          sortBy: request.sortBy,
                                          cover: this.toUserListCover(list),
                                          coverChoice: toUserListCoverChoice(list.cover),
                                      }
                                    : item,
                            ),
                        ),
                    }));
                }),
            );
    }

    deleteList$(listId: number) {
        return this.userLibraryService.deleteList$(listId).pipe(
            switchMap(() => {
                const state = this.get();
                const totalResults = Math.max(0, state.totalResults - 1);
                const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
                const page = Math.min(state.page, totalPages);
                const nextItems =
                    state.items.state === 'success' ? state.items.data.filter((item) => item.id !== listId) : null;

                this.patchState({
                    items: nextItems ? remoteSuccess(nextItems) : state.items,
                    page,
                    totalPages,
                    totalResults,
                });

                if (totalResults > 0 && nextItems && (page !== state.page || nextItems.length === 0)) {
                    return this.loadPage$(page - 1);
                }

                return of(undefined);
            }),
        );
    }

    private fetchListsPage$(page: number) {
        return this.userListController.getLists({ page: page - 1, size: PAGE_SIZE }).pipe(
            map((result) => ({
                items: (result.content ?? []).map((item) => this.toUserListSummaryItem(item)).filter(isDefined),
                page,
                totalPages: Math.max(INITIAL_PAGE, result.totalPages ?? INITIAL_PAGE),
                totalResults: result.totalElements ?? 0,
            })),
        );
    }

    private toUserListSummaryItem(item: UserListResponse): UserListSummaryItem | null {
        const name = item.name?.trim();

        if (!item.id || !name) {
            return null;
        }

        return {
            id: item.id,
            name,
            description: item.description?.trim() || null,
            sortBy: item.sortBy ?? DEFAULT_USER_LIST_SORT_BY,
            createdAt: item.createdAt ?? null,
            updatedAt: item.updatedAt ?? null,
            numberOfItems: item.itemCount ?? null,
            cover: this.toUserListCover(item),
            coverChoice: toUserListCoverChoice(item.cover),
        };
    }

    private toUserListCover(item: UserListResponse): UserListCover | null {
        const { backdropPath, posterPath } = item.cover ?? {};

        if (backdropPath) {
            return { path: backdropPath, params: 'w780', isPoster: false };
        }

        return posterPath ? { path: posterPath, params: 'w500', isPoster: true } : null;
    }
}
