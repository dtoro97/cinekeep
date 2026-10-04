import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

import { CollectionDetails, CollectionRestControllerService, MovieRestControllerService } from '../../api';
import {
    RemoteData,
    MediaListItem,
    PersonLink,
    sortByDate,
    toCollectionPartMediaListItem,
    toMediaListEntryState,
    isDefined,
} from '../../shared';

interface CollectionState {
    collection: RemoteData<CollectionDetails | null>;
    parts: RemoteData<MediaListItem[]>;
}

@Injectable()
export class CollectionStoreService extends ComponentStore<CollectionState> {

    collection$ = this.select((state) => state.collection);

    mappedPartsState$ = this.select((state) => toMediaListEntryState(state.parts));

    partsCount$ = this.select((state) => (state.parts.state === 'success' ? state.parts.data.length : 0));

    timelineLabel$ = this.select((state) => {
        if (state.parts.state !== 'success' || !state.parts.data.length) {
            return null;
        }

        const datedParts = state.parts.data.filter((part) => isDefined(part.date));
        if (!datedParts.length) {
            return null;
        }

        const firstYear = datedParts[0].date;
        const lastYear = datedParts[datedParts.length - 1].date;
        return firstYear === lastYear ? firstYear : `${firstYear}-${lastYear}`;
    });

    backdropPath$ = this.collection$.pipe(
        map((state) => (state.state === 'success' && state.data ? state.data.backdrop_path : null)),
    );

    posterPath$ = this.collection$.pipe(
        map((state) => {
            if (state.state !== 'success' || !state.data) {
                return null;
            }

            return state.data.poster_path ?? state.data.parts?.find((part) => isDefined(part.poster_path))?.poster_path ?? null;
        }),
    );

    averageRating$ = this.select((state) => state.parts).pipe(
        map((parts): number | null => {
            if (parts.state !== 'success') return null;

            const ratings = parts.data.map((p) => p.rating).filter(isDefined);
            if (!ratings.length) return null;
            return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        }),
    );

    constructor(
        private collectionRestControllerService: CollectionRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private router: Router,
    ) {
        super({
            collection: { state: 'notAsked' },
            parts: { state: 'notAsked' },
        });
    }

    getCollection$(id: number) {
        this.patchState({
            collection: { state: 'loading' },
            parts: { state: 'loading' },
        });
        return this.collectionRestControllerService
            .collectionDetails({ collectionId: id })
            .pipe(
                switchMap((collection) => {
                    const sortedParts = sortByDate(collection.parts ?? [], (part) => part.release_date);
                    const normalizedCollection = {
                        ...collection,
                        backdrop_path:
                            collection.backdrop_path ??
                            sortedParts.find((part) => isDefined(part.backdrop_path))?.backdrop_path ??
                            null,
                    };
                    const mappedItems = sortedParts.map((part) => toCollectionPartMediaListItem(part, 'year'));

                    return this.enrichCastLinks$(withCollectionBadges(mappedItems)).pipe(
                        map((items) => ({ collection: normalizedCollection, items })),
                    );
                }),
                tap(({ collection, items }) =>
                    this.patchState({
                        collection: { state: 'success', data: collection },
                        parts: {
                            state: 'success',
                            data: items,
                        },
                    }),
                ),
                catchError(() => {
                    this.patchState({
                        collection: { state: 'success', data: null },
                        parts: { state: 'success', data: [] },
                    });
                    this.router.navigate(['not-found']);
                    return EMPTY;
                }),
            );
    }

    private enrichCastLinks$(items: MediaListItem[]): Observable<MediaListItem[]> {
        if (!items.length) {
            return of([]);
        }

        return forkJoin(
            items.map((item) =>
                this.fetchTopCast$(item.id).pipe(
                    map((castLinks) => ({ ...item, castLinks })),
                    catchError(() => of({ ...item, castLinks: [] })),
                ),
            ),
        );
    }

    private fetchTopCast$(mediaId: number): Observable<PersonLink[]> {
        return this.movieRestControllerService.movieCredits({ movieId: mediaId }).pipe(
            map((credits) =>
                (credits.cast ?? [])
                    .filter(
                        (person): person is { id: number; name: string } =>
                            isDefined(person.id) && isDefined(person.name),
                    )
                    .slice(0, 3)
                    .map((person) => ({
                        id: person.id,
                        name: person.name,
                    })),
            ),
        );
    }
}

function getHighestRatedPart(items: MediaListItem[]): MediaListItem | null {
    const ratedItems = items.filter((item) => (item.rating ?? 0) > 0);
    if (!ratedItems.length) {
        return null;
    }

    return ratedItems.reduce((best, current) => {
        const currentRating = current.rating ?? 0;
        const bestRating = best.rating ?? 0;

        if (currentRating !== bestRating) {
            return currentRating > bestRating ? current : best;
        }

        return (current.voteCount ?? 0) > (best.voteCount ?? 0) ? current : best;
    });
}

function withCollectionBadges(items: MediaListItem[]): MediaListItem[] {
    const highestRated = getHighestRatedPart(items);
    const latestReleased = getLatestReleasedPart(items);

    if (!highestRated && !latestReleased) {
        return items;
    }

    return items.map((item) => {
        const badges = [...(item.badges ?? [])];

        if (latestReleased?.id === item.id) {
            badges.push({ label: 'Latest', variant: 'neutral' });
        }

        return badges.length === (item.badges?.length ?? 0) ? item : { ...item, badges };
    });
}

function getLatestReleasedPart(items: MediaListItem[]): MediaListItem | null {
    const now = Date.now();
    const releasedItems = items.filter((item) => {
        if (!item.date) {
            return false;
        }

        const timestamp = Date.parse(item.date.length === 4 ? `${item.date}-01-01` : item.date);
        return !Number.isNaN(timestamp) && timestamp <= now;
    });

    if (!releasedItems.length) {
        return null;
    }

    return releasedItems.reduce((latest, current) => {
        const latestTimestamp = Date.parse(latest.date.length === 4 ? `${latest.date}-01-01` : latest.date);
        const currentTimestamp = Date.parse(current.date.length === 4 ? `${current.date}-01-01` : current.date);
        return currentTimestamp > latestTimestamp ? current : latest;
    });
}
