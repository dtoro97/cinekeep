import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import {
    catchError,
    defer,
    distinctUntilChanged,
    EMPTY,
    filter,
    finalize,
    forkJoin,
    from,
    map,
    merge,
    mergeMap,
    Observable,
    of,
    switchMap,
    tap,
} from 'rxjs';

import { CollectionDetails, CollectionRestControllerService, MovieRestControllerService } from '../../../api';
import { SeriesSnapshotRequest } from '../../../api-cinekeep';
import {
    formatYearRange,
    isDefined,
    isNotFoundError,
    MediaListItem,
    MediaStateLookup,
    PersonLink,
    RemoteData,
    remoteSuccess,
    sortBy,
    toISODate,
    toMediaKey,
    toMediaListItem,
    toMediaSnapshotRequest,
    UserLibraryService,
    UserSessionStoreService,
} from '../../../shared';

export interface AddAllResult {
    readonly addedCount: number;
    readonly failedCount: number;
}

interface CollectionPart extends MediaListItem {
    readonly isLatest: boolean;
    // Saved with the title when it is added to the watchlist, so adding needs no TMDb request.
    readonly snapshot: SeriesSnapshotRequest;
}

interface LoadedCollection {
    readonly details: CollectionDetails;
    readonly parts: CollectionPart[];
}

interface CollectionDetailState {
    readonly collection: RemoteData<LoadedCollection>;
    // Top-billed cast per part, filled in after the parts show.
    readonly castByPartId: ReadonlyMap<number, PersonLink[]>;
    readonly libraryStates: MediaStateLookup | null;
    readonly isAddingAll: boolean;
}

const TOP_CAST_COUNT = 3;
const ENTRY_SKELETON_COUNT = 3;
// Credits cost one request per film, so long collections fetch them a few at a time.
const CREDITS_CONCURRENCY = 4;

const INITIAL_STATE: CollectionDetailState = {
    collection: { state: 'notAsked' },
    castByPartId: new Map(),
    libraryStates: null,
    isAddingAll: false,
};

@Injectable()
export class CollectionDetailStoreService extends ComponentStore<CollectionDetailState> {
    readonly collectionDetail$ = this.select(
        this.state$,
        this.userSessionStore.authSession$,
        ({ collection, castByPartId, libraryStates, isAddingAll }, { isAuthenticated }) => {
            const details = collection.state === 'success' ? collection.data.details : null;
            const parts = collection.state === 'success' ? collection.data.parts : [];
            const years = parts.map((part) => part.date?.slice(0, 4)).filter(Boolean);
            const ratings = parts.map((part) => part.rating).filter(isDefined);
            const states = parts.map((part) => libraryStates?.get(toMediaKey('movie', part.id)) ?? null);
            const watchlistCount = states.filter((state) => state?.inWatchlist).length;
            const ratedCount = states.filter((state) => typeof state?.rating === 'number').length;
            const isAllOnWatchlist =
                isAuthenticated && !!libraryStates && parts.length > 0 && watchlistCount === parts.length;
            const movieCountLabel = `${parts.length} ${parts.length === 1 ? 'movie' : 'movies'}`;

            return {
                showPageError: collection.state === 'failure',
                details,
                backdropPath: details?.backdrop_path ?? null,
                backdropAlt: details?.name ?? 'Collection',
                timelineLabel: formatYearRange(years[0], years.at(-1)),
                averageRating: ratings.length
                    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
                    : null,
                partsCount: parts.length,
                metaLine: ['Collection', parts.length ? movieCountLabel : null, formatYearRange(years[0], years.at(-1))]
                    .filter(Boolean)
                    .join(' · '),
                entries: parts.map((part, index) => ({
                    number: index + 1,
                    item: part,
                    castLinks: castByPartId.get(part.id) ?? [],
                    year: part.date?.slice(0, 4) ?? null,
                    routeCommands: ['/title', part.id, 'movie'],
                })),
                showEntrySkeleton: collection.state === 'loading',
                entrySkeletonCount: ENTRY_SKELETON_COUNT,
                showNoParts: collection.state === 'success' && parts.length === 0,
                isAuthenticated,
                watchlistCount,
                ratedCount,
                hasLibraryCounts: isAuthenticated && !!libraryStates,
                isAllOnWatchlist,
                isAddingAll,
                addAllLabel: isAllOnWatchlist
                    ? `All ${movieCountLabel} on your watchlist`
                    : `Add all ${movieCountLabel} to watchlist`,
                libraryInvite: `to see which of the ${movieCountLabel} you've rated or kept.`,
            };
        },
        { debounce: true },
    );

    readonly loadedCollection$ = this.select(({ collection }) =>
        collection.state === 'success' && collection.data.details.name ? collection.data.details : null,
    ).pipe(filter(isDefined), distinctUntilChanged());

    constructor(
        private readonly collectionRestControllerService: CollectionRestControllerService,
        private readonly movieRestControllerService: MovieRestControllerService,
        private readonly router: Router,
        private readonly userLibraryService: UserLibraryService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        super(INITIAL_STATE);
    }

    loadCollection$(collectionId: number): Observable<unknown> {
        this.setState({ ...INITIAL_STATE, collection: { state: 'loading' } });

        return merge(
            this.collectionRestControllerService.collectionDetails({ collectionId }).pipe(
                map((collection): LoadedCollection => {
                    // ISO dates sort as text; parts without one go last.
                    const sortedParts = sortBy(collection.parts ?? [], (part) => part.release_date || null);
                    const today = toISODate(new Date());
                    const latestReleasedId = sortedParts
                        .filter((part) => part.release_date && part.release_date <= today)
                        .at(-1)?.id;

                    return {
                        details: {
                            ...collection,
                            backdrop_path:
                                collection.backdrop_path ??
                                sortedParts.find((part) => part.backdrop_path)?.backdrop_path,
                            poster_path:
                                collection.poster_path ?? sortedParts.find((part) => part.poster_path)?.poster_path,
                        },
                        parts: sortedParts.map((part) => ({
                            ...toMediaListItem(part, 'movie', 'year'),
                            isLatest: part.id === latestReleasedId,
                            snapshot: toMediaSnapshotRequest(part, 'movie'),
                        })),
                    };
                }),
                tap((collection) => this.patchState({ collection: remoteSuccess(collection) })),
                // A missing collection goes to not-found; any other failure gives the page way to a retry.
                catchError((error: unknown) => {
                    if (isNotFoundError(error)) {
                        this.router.navigate(['not-found']);
                    } else {
                        this.patchState({ collection: { state: 'failure', error } });
                    }

                    return EMPTY;
                }),
                switchMap(({ parts }) =>
                    from(parts).pipe(
                        mergeMap(
                            (part) =>
                                this.movieRestControllerService.movieCredits({ movieId: part.id }).pipe(
                                    tap((credits) => {
                                        const castLinks = (credits.cast ?? [])
                                            .filter(
                                                (person): person is { id: number; name: string } =>
                                                    isDefined(person.id) && isDefined(person.name),
                                            )
                                            .slice(0, TOP_CAST_COUNT)
                                            .map(({ id, name }) => ({ id, name }));

                                        this.patchState((state) => ({
                                            castByPartId: new Map(state.castByPartId).set(part.id, castLinks),
                                        }));
                                    }),
                                    // Cast names only decorate the row, so a failed credits call leaves them out.
                                    catchError(() => EMPTY),
                                ),
                            CREDITS_CONCURRENCY,
                        ),
                    ),
                ),
            ),
            this.userLibraryService
                .mediaStates$(
                    this.select(({ collection }) =>
                        collection.state === 'success'
                            ? collection.data.parts.map(({ id, mediaType }) => ({ id, mediaType }))
                            : null,
                    ).pipe(filter(isDefined)),
                )
                .pipe(tap((libraryStates) => this.patchState({ libraryStates }))),
        );
    }

    // Adds every film not yet on the watchlist; the ones already there are left alone.
    addAllToWatchlist$(): Observable<AddAllResult> {
        return defer(() => {
            const { collection, libraryStates, isAddingAll } = this.get();

            if (collection.state !== 'success' || !libraryStates || isAddingAll) {
                return EMPTY;
            }

            const missing = collection.data.parts.filter(
                (part) => !libraryStates.get(toMediaKey('movie', part.id))?.inWatchlist,
            );

            if (!missing.length) {
                return EMPTY;
            }

            this.patchState({ isAddingAll: true });

            return forkJoin(
                missing.map((part) =>
                    this.userLibraryService.updateLibraryFlag$('watchlist', part.id, 'movie', true, part.snapshot).pipe(
                        // One failed title doesn't undo the others; it stays off the watchlist and counts as failed.
                        catchError(() => of(false)),
                        map((isAdded) => ({ part, isAdded })),
                    ),
                ),
            ).pipe(
                tap((results) =>
                    this.patchState((state) => {
                        const next = new Map(state.libraryStates ?? []);

                        results
                            .filter(({ isAdded }) => isAdded)
                            .forEach(({ part }) => {
                                const key = toMediaKey('movie', part.id);
                                next.set(key, { ...next.get(key), inWatchlist: true });
                            });

                        return { libraryStates: next };
                    }),
                ),
                map((results) => {
                    const addedCount = results.filter(({ isAdded }) => isAdded).length;
                    return { addedCount, failedCount: results.length - addedCount };
                }),
                finalize(() => this.patchState({ isAddingAll: false })),
            );
        });
    }
}
