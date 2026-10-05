import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    debounceTime,
    distinctUntilChanged,
    expand,
    filter,
    map,
    of,
    reduce,
    switchMap,
    take,
    tap,
    throwError,
} from 'rxjs';

import { SeriesSnapshotRequest, UserListControllerService } from '../../../api-cinekeep';
import { BACKEND_MAX_PAGE_SIZE } from '../../../constants';
import { MultiListItem, SearchRestControllerService } from '../../../api';
import {
    isDefined,
    isMediaResult,
    MEDIA_TYPE_LABEL,
    MediaType,
    RemoteData,
    remoteSuccess,
    toMediaKey,
    toMediaSnapshotRequest,
    updateRemoteData,
    UserLibraryService,
} from '../../../shared';

export interface UserListAddItemsSearchResult {
    readonly key: string;
    readonly id: number;
    readonly mediaType: MediaType;
    readonly mediaTypeLabel: string;
    readonly title: string;
    readonly year: string;
    readonly posterPath: string | null;
    readonly isAdded: boolean;
    readonly snapshot: SeriesSnapshotRequest;
}

interface UserListAddItemsDialogState {
    readonly listId: number | null;
    /** `null` while the list's keys are loading. */
    readonly addedKeys: ReadonlySet<string> | null;
    readonly query: string;
    readonly resultsState: RemoteData<UserListAddItemsSearchResult[]>;
    readonly errorMessage: string | null;
    readonly hasChanges: boolean;
}

const INITIAL_STATE: UserListAddItemsDialogState = {
    listId: null,
    addedKeys: null,
    query: '',
    resultsState: { state: 'notAsked' },
    errorMessage: null,
    hasChanges: false,
};

@Injectable()
export class UserListAddItemsDialogStore extends ComponentStore<UserListAddItemsDialogState> {
    readonly addItems$ = this.select((state) => ({
        state: state.resultsState,
        errorMessage: state.errorMessage,
        hasChanges: state.hasChanges,
    }));

    private readonly query$ = this.select((state) => state.query);
    private readonly addedKeys$ = this.select((state) => state.addedKeys);

    // Without the keys, duplicates are still rejected by the backend when added.
    private readonly loadListKeys = this.effect((listId$: Observable<number>) =>
        listId$.pipe(
            switchMap((listId) => {
                const fetchPage$ = (page: number) =>
                    this.userListControllerService.getListDetails({ listId, page, size: BACKEND_MAX_PAGE_SIZE });

                return fetchPage$(0).pipe(
                    expand((result) => {
                        const nextPage = (result.items?.page ?? 0) + 1;

                        return nextPage < (result.items?.totalPages ?? 0) ? fetchPage$(nextPage) : EMPTY;
                    }),
                    reduce(
                        (keys, result) =>
                            new Set([
                                ...keys,
                                ...(result.items?.content ?? []).flatMap(({ mediaType, tmdbId }) =>
                                    mediaType && tmdbId ? [toMediaKey(mediaType, tmdbId)] : [],
                                ),
                            ]),
                        new Set<string>(),
                    ),
                    catchError(() => of(new Set<string>())),
                );
            }),
            tap((addedKeys) => this.patchState({ addedKeys })),
        ),
    );
    private readonly searchTitles = this.effect((query$: Observable<string>) =>
        query$.pipe(
            debounceTime(350),
            distinctUntilChanged(),
            switchMap((query) => {
                if (!query) {
                    this.patchState({ resultsState: { state: 'notAsked' } });
                    return of(null);
                }

                return this.search$(query).pipe(
                    catchError(() => {
                        this.patchState({
                            errorMessage: 'Search failed. Try another title.',
                            resultsState: remoteSuccess([]),
                        });
                        return of(null);
                    }),
                );
            }),
            tap((results) => {
                if (results !== null) {
                    this.patchState({ resultsState: remoteSuccess(results) });
                }
            }),
        ),
    );

    constructor(
        private readonly searchService: SearchRestControllerService,
        private readonly userLibraryService: UserLibraryService,
        private readonly userListControllerService: UserListControllerService,
    ) {
        super(INITIAL_STATE);
        this.searchTitles(this.query$);
    }

    initialize(listId: number): void {
        this.patchState({ listId });
        this.loadListKeys(listId);
    }

    updateQuery(query: string): void {
        const nextQuery = query.trim();

        this.patchState({
            query: nextQuery,
            errorMessage: null,
            // Skeletons only once there is something to search for; an empty box shows the prompt.
            resultsState: nextQuery ? { state: 'loading' } : { state: 'notAsked' },
        });
    }

    addItem$(item: UserListAddItemsSearchResult): Observable<unknown> {
        const { listId } = this.get();

        if (item.isAdded) {
            return of(undefined);
        }

        if (listId === null) {
            return throwError(() => new Error('List detail is not loaded yet.'));
        }

        return this.userLibraryService.addToList$(listId, item.id, item.mediaType, item.snapshot).pipe(
            tap(() => {
                this.patchState((state) => ({
                    hasChanges: true,
                    addedKeys: new Set([...(state.addedKeys ?? []), item.key]),
                    resultsState: updateRemoteData(state.resultsState, (items) =>
                        items.map((result) => (result.key === item.key ? { ...result, isAdded: true } : result)),
                    ),
                }));
            }),
            catchError(() => {
                this.patchState({ errorMessage: 'Could not add this title.' });
                return EMPTY;
            }),
        );
    }

    hasChanges(): boolean {
        return this.get().hasChanges;
    }

    private search$(query: string) {
        return this.searchService
            .searchMulti({ query, page: 1 })
            .pipe(
                map((page) =>
                    (page.results ?? [])
                        .map((item) => this.toSearchResult(item))
                        .filter(isDefined),
                ),
                switchMap((results) =>
                    this.addedKeys$.pipe(
                        filter(isDefined),
                        take(1),
                        map((keys) => results.map((item) => ({ ...item, isAdded: keys.has(item.key) }))),
                    ),
                ),
            );
    }

    private toSearchResult(item: MultiListItem): UserListAddItemsSearchResult | null {
        if (!isMediaResult(item)) {
            return null;
        }

        const mediaType = item.media_type;
        const title = mediaType === 'movie' ? item.title : item.name;

        if (!item.id || !title) {
            return null;
        }

        const key = toMediaKey(mediaType, item.id);
        const date = mediaType === 'movie' ? (item.release_date ?? '') : (item.first_air_date ?? '');

        return {
            key,
            id: item.id,
            mediaType,
            mediaTypeLabel: MEDIA_TYPE_LABEL[mediaType],
            title,
            year: date.slice(0, 4),
            posterPath: item.poster_path ?? null,
            isAdded: false,
            snapshot: toMediaSnapshotRequest(item, mediaType),
        };
    }
}
