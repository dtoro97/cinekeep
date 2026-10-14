import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, switchMap, tap, throwError } from 'rxjs';

import { UserListControllerService } from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import { RemoteData, isDefined, remoteData, remoteSuccess, updateRemoteData } from '../../../shared';
import { UserListEditDialogResult } from '../user-list-edit-dialog/user-list-edit-dialog-store.service';
import { UserListSummaryItem, toUserListSummaryItem } from '../user-list-summary.mapper';

interface UserListsPageState {
    readonly pageIndex: number;
    readonly total: number;
    readonly lists: RemoteData<UserListSummaryItem[]>;
}

const INITIAL_STATE: UserListsPageState = {
    pageIndex: 0,
    total: 0,
    lists: { state: 'notAsked' },
};

@Injectable()
export class UserListsPageStoreService extends ComponentStore<UserListsPageState> {
    readonly userLists$ = this.select(({ pageIndex, total, lists }) => {
        const loadedLists = remoteData(lists, []);

        return {
            pageIndex,
            pageSize: PAGE_SIZE,
            total,
            lists: loadedLists,
            showSkeleton: lists.state === 'loading',
            hasLists: loadedLists.length > 0,
            showEmpty: lists.state === 'success' && loadedLists.length === 0,
            showPaginator: loadedLists.length > 0 && total > PAGE_SIZE,
        };
    });

    constructor(private readonly userListController: UserListControllerService) {
        super(INITIAL_STATE);
    }

    loadPage$(pageIndex: number): Observable<unknown> {
        this.patchState({ pageIndex, lists: { state: 'loading' } });

        return this.fetchPage$(pageIndex);
    }

    updateList$(list: UserListSummaryItem, changes: UserListEditDialogResult): Observable<unknown> {
        return this.userListController
            .updateList({
                listId: list.id,
                updateUserListRequest: {
                    name: changes.name,
                    description: changes.description,
                    sortBy: changes.sortBy ?? list.sortBy,
                    cover: changes.cover ?? undefined,
                },
            })
            .pipe(
                tap((response) =>
                    this.patchState((state) => ({
                        lists: updateRemoteData(state.lists, (lists) =>
                            lists.map((existing) =>
                                existing.id === list.id ? (toUserListSummaryItem(response) ?? existing) : existing,
                            ),
                        ),
                    })),
                ),
            );
    }

    deleteList$(list: UserListSummaryItem): Observable<unknown> {
        const { pageIndex, lists } = this.get();
        // Deleting the last list of a page moves back to the previous one.
        const nextPageIndex = remoteData(lists, []).length === 1 ? Math.max(0, pageIndex - 1) : pageIndex;

        return this.userListController
            .deleteList({ listId: list.id })
            .pipe(switchMap(() => this.fetchPage$(nextPageIndex)));
    }

    private fetchPage$(pageIndex: number): Observable<unknown> {
        return this.userListController.getLists({ page: pageIndex, size: PAGE_SIZE }).pipe(
            tap((response) =>
                this.patchState({
                    pageIndex,
                    total: response.totalElements ?? 0,
                    lists: remoteSuccess((response.content ?? []).map(toUserListSummaryItem).filter(isDefined)),
                }),
            ),
            catchError((error: unknown) => {
                this.patchState({ lists: { state: 'failure', error } });
                return throwError(() => error);
            }),
        );
    }
}
