import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import {
    EMPTY,
    Observable,
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    map,
    of,
    switchMap,
    take,
    tap,
    throwError,
} from 'rxjs';

import { MultiListItem, SearchRestControllerService } from '../../../api';
import {
    MediaSnapshotRequest,
    RemoteData,
    LocaleStoreService,
    MediaType,
    UserLibraryService,
    isDefined,
    toMediaSnapshotRequest,
    updateRemoteData,
} from '../../../shared';
import { remoteSuccess } from '../../../shared/utils';

export interface UserListAddItemsSearchResult {
    readonly key: string;
    readonly id: number;
    readonly mediaType: MediaType;
    readonly mediaTypeLabel: string;
    readonly title: string;
    readonly year: string;
    readonly posterPath: string | null;
    readonly isAdded: boolean;
    readonly snapshot: MediaSnapshotRequest;
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
    readonly vm$ = this.select((state) => ({
        state: state.resultsState,
        errorMessage: state.errorMessage,
        hasChanges: state.hasChanges,
    }));

    private readonly query$ = this.select((state) => state.query);
    private readonly addedKeys$ = this.select((state) => state.addedKeys);

    // Without the keys, duplicates are still rejected by the backend when added.
    private readonly loadListKeys = this.effect((listId$: Observable<number>) =>
        listId$.pipe(
            switchMap((listId) =>
                this.userLibraryService.getListItemKeys$(listId).pipe(catchError(() => of(new Set<string>()))),
            ),
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
        private readonly localeStore: LocaleStoreService,
        private readonly searchService: SearchRestControllerService,
        private readonly userLibraryService: UserLibraryService,
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
            .searchMulti({ query, language: this.localeStore.language(), page: 1 })
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
        if (
            item.media_type !== MultiListItem.MediaTypeEnum.Movie &&
            item.media_type !== MultiListItem.MediaTypeEnum.Tv
        ) {
            return null;
        }

        const mediaType: MediaType = item.media_type === MultiListItem.MediaTypeEnum.Tv ? 'tv' : 'movie';
        const title = mediaType === 'movie' ? item.title : item.name;

        if (!item.id || !title) {
            return null;
        }

        const key = `${mediaType}:${item.id}`;
        const date = mediaType === 'movie' ? (item.release_date ?? '') : (item.first_air_date ?? '');

        return {
            key,
            id: item.id,
            mediaType,
            mediaTypeLabel: mediaType === 'movie' ? 'Movie' : 'TV series',
            title,
            year: date.slice(0, 4),
            posterPath: item.poster_path ?? null,
            isAdded: false,
            snapshot: toMediaSnapshotRequest(item, mediaType),
        };
    }
}
