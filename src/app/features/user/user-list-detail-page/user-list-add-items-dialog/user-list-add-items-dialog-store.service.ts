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
} from 'rxjs';

import { SearchRestControllerService } from '../../../../api';
import { SeriesSnapshotRequest, UserListControllerService } from '../../../../api-cinekeep';
import { BACKEND_MAX_PAGE_SIZE } from '../../../../constants';
import {
    MEDIA_TYPE_LABEL,
    MediaType,
    RemoteData,
    UserLibraryService,
    isDefined,
    isMediaResult,
    remoteData,
    remoteSuccess,
    toMediaKey,
    toMediaSnapshotRequest,
    updateRemoteData,
} from '../../../../shared';

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
    readonly listId: number;
    // `null` while the list's titles are still loading.
    readonly addedKeys: ReadonlySet<string> | null;
    readonly query: string;
    readonly results: RemoteData<UserListAddItemsSearchResult[]>;
    readonly errorMessage: string | null;
    readonly hasChanges: boolean;
}

const SEARCH_DEBOUNCE_MS = 350;

@Injectable()
export class UserListAddItemsDialogStoreService extends ComponentStore<UserListAddItemsDialogState> {
    readonly addItems$ = this.select(({ results, errorMessage, hasChanges }) => {
        const loadedResults = remoteData(results, []);

        return {
            results: loadedResults,
            errorMessage,
            hasChanges,
            showSkeleton: results.state === 'loading',
            hasResults: loadedResults.length > 0,
            showNoMatches: results.state === 'success' && loadedResults.length === 0,
            showPrompt: results.state === 'notAsked',
        };
    });

    // Marks titles already on the list. Without these keys duplicates are still rejected when added.
    private readonly loadAddedKeys = this.effect<number>((listId$) =>
        listId$.pipe(
            switchMap((listId) => {
                const fetchPage$ = (page: number) =>
                    this.userListController.getListDetails({ listId, page, size: BACKEND_MAX_PAGE_SIZE });

                return fetchPage$(0).pipe(
                    expand((response) => {
                        const nextPage = (response.items?.page ?? 0) + 1;

                        return nextPage < (response.items?.totalPages ?? 0) ? fetchPage$(nextPage) : EMPTY;
                    }),
                    reduce(
                        (keys, response) =>
                            new Set([
                                ...keys,
                                ...(response.items?.content ?? []).flatMap(({ mediaType, tmdbId }) =>
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

    private readonly searchTitles = this.effect<string>((query$) =>
        query$.pipe(
            debounceTime(SEARCH_DEBOUNCE_MS),
            distinctUntilChanged(),
            // An empty query still switches, so clearing the box cancels a search in flight.
            switchMap((query) =>
                !query
                    ? EMPTY
                    : this.searchService.searchMulti({ query, page: 1 }).pipe(
                          map(({ results }) =>
                              (results ?? []).filter(isMediaResult).flatMap((item) => {
                                  const mediaType = item.media_type;
                                  const title = mediaType === 'movie' ? item.title : item.name;
                                  const date = (mediaType === 'movie' ? item.release_date : item.first_air_date) ?? '';

                                  return item.id && title
                                      ? [
                                            {
                                                key: toMediaKey(mediaType, item.id),
                                                id: item.id,
                                                mediaType,
                                                mediaTypeLabel: MEDIA_TYPE_LABEL[mediaType],
                                                title,
                                                year: date.slice(0, 4),
                                                posterPath: item.poster_path ?? null,
                                                snapshot: toMediaSnapshotRequest(item, mediaType),
                                            },
                                        ]
                                      : [];
                              }),
                          ),
                          switchMap((results) =>
                              this.select((state) => state.addedKeys).pipe(
                                  filter(isDefined),
                                  take(1),
                                  map((addedKeys) =>
                                      results.map((item) => ({ ...item, isAdded: addedKeys.has(item.key) })),
                                  ),
                              ),
                          ),
                          tap((results) => this.patchState({ results: remoteSuccess(results) })),
                          catchError(() => {
                              this.patchState({
                                  errorMessage: 'Search failed. Try another title.',
                                  results: remoteSuccess([]),
                              });
                              return EMPTY;
                          }),
                      ),
            ),
        ),
    );

    constructor(
        private readonly searchService: SearchRestControllerService,
        private readonly userLibraryService: UserLibraryService,
        private readonly userListController: UserListControllerService,
    ) {
        super({
            listId: 0,
            addedKeys: null,
            query: '',
            results: { state: 'notAsked' },
            errorMessage: null,
            hasChanges: false,
        });

        this.searchTitles(this.select((state) => state.query));
    }

    load(listId: number): void {
        this.patchState({ listId });
        this.loadAddedKeys(listId);
    }

    updateQuery(query: string): void {
        const trimmedQuery = query.trim();

        this.patchState({
            query: trimmedQuery,
            errorMessage: null,
            // Skeletons only once there is something to search for; an empty box shows the prompt.
            results: trimmedQuery ? { state: 'loading' } : { state: 'notAsked' },
        });
    }

    addItem$(item: UserListAddItemsSearchResult): Observable<unknown> {
        if (item.isAdded) {
            return EMPTY;
        }

        return this.userLibraryService.addToList$(this.get().listId, item.id, item.mediaType, item.snapshot).pipe(
            tap(() =>
                this.patchState((state) => ({
                    hasChanges: true,
                    addedKeys: new Set([...(state.addedKeys ?? []), item.key]),
                    results: updateRemoteData(state.results, (results) =>
                        results.map((result) => (result.key === item.key ? { ...result, isAdded: true } : result)),
                    ),
                })),
            ),
            // The error shows inline in the dialog instead of a snackbar behind it.
            catchError(() => {
                this.patchState({ errorMessage: 'Could not add this title.' });
                return EMPTY;
            }),
        );
    }
}
