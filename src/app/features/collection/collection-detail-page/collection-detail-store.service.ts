import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, distinctUntilChanged, EMPTY, filter, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

import { CollectionDetails, CollectionRestControllerService, MovieRestControllerService } from '../../../api';
import {
    isDefined,
    mapRemoteData,
    MediaListItem,
    MediaListItemBadge,
    RemoteData,
    remoteSuccess,
    sortByDate,
    toCollectionPartMediaListItem,
    toISODate,
    toMediaListEntries,
} from '../../../shared';

interface LoadedCollection {
    details: CollectionDetails;
    parts: MediaListItem[];
}

interface CollectionDetailState {
    collection: RemoteData<LoadedCollection>;
}

const TOP_CAST_COUNT = 3;
const LATEST_BADGE: MediaListItemBadge = { label: 'Latest', variant: 'neutral' };

@Injectable()
export class CollectionDetailStoreService extends ComponentStore<CollectionDetailState> {
    readonly collectionDetail$ = this.select(({ collection }) => {
        const details = collection.state === 'success' ? collection.data.details : null;
        const parts = collection.state === 'success' ? collection.data.parts : [];
        const years = parts.map((part) => part.date).filter(Boolean);
        const firstYear = years[0];
        const lastYear = years.at(-1);
        const ratings = parts.map((part) => part.rating).filter(isDefined);

        return {
            details,
            heroBackdropPath: details?.backdrop_path ?? null,
            heroAlt: details?.name ?? 'Collection',
            posterAlt: details?.name ?? 'Collection poster',
            timelineLabel: firstYear && firstYear !== lastYear ? `${firstYear}-${lastYear}` : (firstYear ?? null),
            averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
            partsCount: parts.length,
            parts: mapRemoteData(collection, (data) => toMediaListEntries(data.parts)),
            showParts: collection.state === 'loading' || parts.length > 0,
            showPartsCount: collection.state === 'success',
            showNoParts: collection.state === 'success' && parts.length === 0,
        };
    });

    readonly loadedCollection$ = this.select(({ collection }) =>
        collection.state === 'success' && collection.data.details.name ? collection.data.details : null,
    ).pipe(filter(isDefined), distinctUntilChanged());

    constructor(
        private collectionRestControllerService: CollectionRestControllerService,
        private movieRestControllerService: MovieRestControllerService,
        private router: Router,
    ) {
        super({ collection: { state: 'notAsked' } });
    }

    loadCollection$(collectionId: number): Observable<unknown> {
        this.setState({ collection: { state: 'loading' } });

        return this.collectionRestControllerService.collectionDetails({ collectionId }).pipe(
            switchMap((collection) => {
                const sortedParts = sortByDate(collection.parts ?? [], (part) => part.release_date);
                const today = toISODate(new Date());
                const latestReleasedId = sortedParts
                    .filter((part) => part.release_date && part.release_date <= today)
                    .at(-1)?.id;
                const details: CollectionDetails = {
                    ...collection,
                    backdrop_path:
                        collection.backdrop_path ?? sortedParts.find((part) => part.backdrop_path)?.backdrop_path,
                    poster_path: collection.poster_path ?? sortedParts.find((part) => part.poster_path)?.poster_path,
                };
                const parts$ = sortedParts.map((part) => {
                    const item = toCollectionPartMediaListItem(part, 'year');
                    const badges = part.id === latestReleasedId ? [LATEST_BADGE] : undefined;

                    return this.movieRestControllerService.movieCredits({ movieId: item.id }).pipe(
                        map((credits) =>
                            (credits.cast ?? [])
                                .filter(
                                    (person): person is { id: number; name: string } =>
                                        isDefined(person.id) && isDefined(person.name),
                                )
                                .slice(0, TOP_CAST_COUNT)
                                .map(({ id, name }) => ({ id, name })),
                        ),
                        // Cast names only decorate the row, so a failed credits call leaves them out.
                        catchError(() => of([])),
                        map((castLinks) => ({ ...item, badges, castLinks })),
                    );
                });

                // `forkJoin` completes without emitting for an empty list, which would leave the page loading.
                return (parts$.length ? forkJoin(parts$) : of([])).pipe(map((parts) => ({ details, parts })));
            }),
            tap((collection) => this.patchState({ collection: remoteSuccess(collection) })),
            // A missing or broken collection has nothing to show, so the user is sent to the not-found page.
            catchError(() => {
                this.router.navigate(['not-found']);
                return EMPTY;
            }),
        );
    }
}
