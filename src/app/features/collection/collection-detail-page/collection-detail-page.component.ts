import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { distinctUntilChanged, EMPTY, map, switchMap } from 'rxjs';

import {
    HeroSurfaceComponent,
    ImageComponent,
    MediaListComponent,
    PageSectionComponent,
    PluralizePipe,
    SeoService,
    SkeletonComponent,
    TmdbRatingComponent,
    toSeoImage,
} from '../../../shared';
import { CollectionDetailStoreService } from './collection-detail-store.service';

@Component({
    selector: 'app-collection-detail-page',
    imports: [
        AsyncPipe,
        HeroSurfaceComponent,
        ImageComponent,
        MediaListComponent,
        PageSectionComponent,
        PluralizePipe,
        SkeletonComponent,
        TmdbRatingComponent,
    ],
    providers: [CollectionDetailStoreService],
    templateUrl: './collection-detail-page.component.html',
    styleUrl: './collection-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetailPageComponent {
    readonly collectionDetail$ = this.store.collectionDetail$;

    constructor(
        private store: CollectionDetailStoreService,
        router: Router,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        activatedRoute.paramMap
            .pipe(
                map((paramMap) => Number(paramMap.get('collectionId'))),
                distinctUntilChanged(),
                switchMap((collectionId) => {
                    if (!Number.isInteger(collectionId) || collectionId <= 0) {
                        router.navigate(['not-found']);
                        return EMPTY;
                    }

                    return this.store.loadCollection$(collectionId);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.loadedCollection$.pipe(takeUntilDestroyed()).subscribe((collection) =>
            seoService.setPage({
                title: `${collection.name} | Collection`,
                description:
                    collection.overview ||
                    `Explore every movie in ${collection.name}, with release order, ratings, cast highlights, posters, and backdrops.`,
                ...toSeoImage(collection.backdrop_path, collection.poster_path),
                imageAlt: `${collection.name} collection artwork`,
            }),
        );
    }
}
