import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';

import { UserListControllerService, UserListItemControllerService, UserListResponse } from '../../../api-cinekeep';
import { PAGE_SIZE } from '../../../constants';
import {
    MEDIA_TYPE_LABEL,
    MediaListItem,
    RemoteData,
    RouteCommands,
    SeoMetadata,
    isDefined,
    pluralize,
    remoteData,
    remoteSuccess,
    toMediaKey,
    toRating,
    toSnapshotMediaListItem,
    updateRemoteData,
} from '../../../shared';
import { UserListCoverChoice, toUserListCoverChoice } from '../user-list-cover';
import { UserListEditDialogResult } from '../user-list-edit-dialog/user-list-edit-dialog-store.service';
import {
    DEFAULT_USER_LIST_SORT_BY,
    UserListSort,
    UserListSortField,
    toUserListSort,
    toUserListSortBy,
} from '../user-list-sort-options';

export interface UserListDetailHeader {
    readonly id: number;
    readonly name: string;
    readonly description: string | null;
    readonly subtitle: string;
    readonly backdropPath: string | null;
    readonly cover: UserListCoverChoice | null;
    readonly sortBy: UserListResponse.SortByEnum;
    readonly canClear: boolean;
}

export interface UserListDetailItem {
    readonly key: string;
    readonly mediaItem: MediaListItem;
    readonly comment: string;
    readonly link: RouteCommands;
}

interface UserListCommentEditor {
    readonly key: string;
    readonly draft: string;
    readonly isSaving: boolean;
}

interface UserListDetailPageState {
    readonly listId: number;
    readonly list: RemoteData<UserListDetailHeader>;
    readonly items: RemoteData<UserListDetailItem[]>;
    readonly pageIndex: number;
    readonly total: number;
    // `null` follows the list's default order, so a later change to the default applies here too.
    readonly sortBy: UserListResponse.SortByEnum | null;
    readonly commentEditor: UserListCommentEditor | null;
}

const INITIAL_STATE: UserListDetailPageState = {
    listId: 0,
    list: { state: 'notAsked' },
    items: { state: 'notAsked' },
    pageIndex: 0,
    total: 0,
    sortBy: null,
    commentEditor: null,
};

const UPDATED_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

@Injectable()
export class UserListDetailPageStoreService extends ComponentStore<UserListDetailPageState> {
    readonly userListDetail$ = this.select((state) => {
        const { list, items, pageIndex, total, commentEditor } = state;
        const loadedItems = remoteData(items, []);

        return {
            header: remoteData(list, null),
            sort: toActiveSort(state),
            items: loadedItems.map((item) => {
                const isEditingComment = commentEditor?.key === item.key;

                return {
                    ...item,
                    commentActionLabel: item.comment ? 'Edit comment' : 'Add comment',
                    isEditingComment,
                    showComment: !isEditingComment && !!item.comment,
                };
            }),
            commentDraft: commentEditor?.draft ?? '',
            isSavingComment: !!commentEditor?.isSaving,
            commentSaveLabel: commentEditor?.isSaving ? 'Saving…' : 'Save',
            pageIndex,
            pageSize: PAGE_SIZE,
            total,
            showSkeleton: items.state === 'loading',
            hasItems: loadedItems.length > 0,
            showEmpty: items.state === 'success' && loadedItems.length === 0,
            showPaginator: loadedItems.length > 0 && total > PAGE_SIZE,
        };
    });

    readonly seoMetadata$ = this.select(({ list }): SeoMetadata => {
        const header = remoteData(list, null);

        return header
            ? {
                  title: `${header.name} | List`,
                  description: header.description || 'Your saved movies and TV series in one CineKeep list.',
                  robots: 'noindex, nofollow',
              }
            : { title: 'List', robots: 'noindex, nofollow' };
    });

    constructor(
        private readonly userListController: UserListControllerService,
        private readonly userListItemController: UserListItemControllerService,
    ) {
        super(INITIAL_STATE);
    }

    load$(listId: number): Observable<unknown> {
        this.setState({ ...INITIAL_STATE, listId, list: { state: 'loading' }, items: { state: 'loading' } });

        return this.fetchPage$(0);
    }

    loadPage$(pageIndex: number): Observable<unknown> {
        this.patchState({ pageIndex, items: { state: 'loading' } });

        return this.fetchPage$(pageIndex);
    }

    reload$(): Observable<unknown> {
        return this.fetchPage$(this.get().pageIndex);
    }

    setSortField$(field: UserListSortField): Observable<unknown> {
        const sort = toActiveSort(this.get());

        return field === sort.field ? EMPTY : this.sortBy$(toUserListSortBy({ field, direction: sort.direction }));
    }

    toggleSortDirection$(): Observable<unknown> {
        const sort = toActiveSort(this.get());

        return this.sortBy$(toUserListSortBy({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' }));
    }

    // The reload brings back the new details, cover and default order.
    updateList$(changes: UserListEditDialogResult): Observable<unknown> {
        const { listId, list } = this.get();

        return this.userListController
            .updateList({
                listId,
                updateUserListRequest: {
                    name: changes.name,
                    description: changes.description,
                    sortBy: changes.sortBy ?? remoteData(list, null)?.sortBy ?? DEFAULT_USER_LIST_SORT_BY,
                    cover: changes.cover ?? undefined,
                },
            })
            .pipe(switchMap(() => this.reload$()));
    }

    clearList$(): Observable<unknown> {
        return this.userListItemController
            .clearItems({ listId: this.get().listId })
            .pipe(switchMap(() => this.fetchPage$(0)));
    }

    deleteList$(): Observable<unknown> {
        return this.userListController.deleteList({ listId: this.get().listId });
    }

    removeItem$(item: UserListDetailItem): Observable<unknown> {
        const { listId, pageIndex, items } = this.get();
        // Removing the last title of a page moves back to the previous one.
        const nextPageIndex = remoteData(items, []).length === 1 ? Math.max(0, pageIndex - 1) : pageIndex;

        return this.userListItemController
            .removeItem({ listId, mediaType: item.mediaItem.mediaType, tmdbId: item.mediaItem.id })
            .pipe(switchMap(() => this.fetchPage$(nextPageIndex)));
    }

    startComment(item: UserListDetailItem): void {
        this.patchState({ commentEditor: { key: item.key, draft: item.comment, isSaving: false } });
    }

    updateCommentDraft(draft: string): void {
        this.patchState(({ commentEditor }) => ({ commentEditor: commentEditor && { ...commentEditor, draft } }));
    }

    cancelComment(): void {
        this.patchState({ commentEditor: null });
    }

    // Emits the saved comment, empty when it was removed.
    saveComment$(item: UserListDetailItem): Observable<string> {
        const { listId, commentEditor } = this.get();

        if (!commentEditor || commentEditor.isSaving) {
            return EMPTY;
        }

        const comment = commentEditor.draft.trim();

        if (comment === item.comment) {
            this.cancelComment();
            return EMPTY;
        }

        this.patchState({ commentEditor: { ...commentEditor, isSaving: true } });

        return this.userListItemController
            .updateItem({
                listId,
                mediaType: item.mediaItem.mediaType,
                tmdbId: item.mediaItem.id,
                updateListItemRequest: { comment },
            })
            .pipe(
                tap(() =>
                    this.patchState((state) => ({
                        commentEditor: null,
                        items: updateRemoteData(state.items, (items) =>
                            items.map((existing) => (existing.key === item.key ? { ...existing, comment } : existing)),
                        ),
                    })),
                ),
                map(() => comment),
                finalize(() =>
                    this.patchState(({ commentEditor }) => ({
                        commentEditor: commentEditor && { ...commentEditor, isSaving: false },
                    })),
                ),
            );
    }

    private sortBy$(sortBy: UserListResponse.SortByEnum): Observable<unknown> {
        const defaultSortBy = remoteData(this.get().list, null)?.sortBy;

        this.patchState({ sortBy: sortBy === defaultSortBy ? null : sortBy });

        return this.loadPage$(0);
    }

    private fetchPage$(pageIndex: number): Observable<unknown> {
        const { listId, sortBy } = this.get();

        return this.userListController
            .getListDetails({ listId, page: pageIndex, size: PAGE_SIZE, sortBy: sortBy ?? undefined })
            .pipe(
                tap(({ list = {}, items }) => {
                    const total = items?.totalElements ?? 0;
                    const itemCount = list.itemCount ?? total;
                    const updatedAt = Date.parse(list.updatedAt ?? '');
                    const minutesAgo = Math.floor((Date.now() - updatedAt) / 60_000);
                    const hoursAgo = Math.floor(minutesAgo / 60);
                    const updatedLabel = Number.isNaN(updatedAt)
                        ? null
                        : // A time in the future (clock skew) shows as a date instead.
                          minutesAgo < 0
                          ? `Updated ${UPDATED_DATE_FORMAT.format(updatedAt)}`
                          : minutesAgo < 1
                            ? 'Updated just now'
                            : minutesAgo < 60
                              ? `Updated ${pluralize(minutesAgo, 'minute')} ago`
                              : hoursAgo < 24
                                ? `Updated ${pluralize(hoursAgo, 'hour')} ago`
                                : `Updated ${pluralize(Math.floor(hoursAgo / 24), 'day')} ago`;

                    this.patchState({
                        pageIndex,
                        total,
                        list: remoteSuccess({
                            id: listId,
                            name: list.name || 'Untitled List',
                            description: list.description ?? null,
                            subtitle: [pluralize(itemCount, 'title'), updatedLabel].filter(isDefined).join(' · '),
                            backdropPath: list.cover?.backdropPath ?? null,
                            cover: toUserListCoverChoice(list.cover),
                            sortBy: list.sortBy ?? DEFAULT_USER_LIST_SORT_BY,
                            canClear: itemCount > 0,
                        }),
                        items: remoteSuccess(
                            (items?.content ?? [])
                                .map((item) => {
                                    const mediaItem = toSnapshotMediaListItem(item, toRating(item.voteAverage));

                                    return (
                                        mediaItem && {
                                            key: toMediaKey(mediaItem.mediaType, mediaItem.id),
                                            mediaItem: {
                                                ...mediaItem,
                                                badges: [{ label: MEDIA_TYPE_LABEL[mediaItem.mediaType] }],
                                            },
                                            comment: item.comment ?? '',
                                            link: ['/', 'title', mediaItem.id, mediaItem.mediaType],
                                        }
                                    );
                                })
                                .filter(isDefined),
                        ),
                    });
                }),
                catchError((error: unknown) => {
                    this.patchState({ items: { state: 'failure', error } });
                    return throwError(() => error);
                }),
            );
    }
}

const toActiveSort = ({ sortBy, list }: UserListDetailPageState): UserListSort =>
    toUserListSort(sortBy ?? remoteData(list, null)?.sortBy ?? DEFAULT_USER_LIST_SORT_BY);
