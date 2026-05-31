import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { switchMap, tap } from 'rxjs';

import {
    buildTmdbImageUrl,
    HeroSurfaceComponent,
    MediaListComponent,
    ImageComponent,
    PageSectionComponent,
    RatingComponent,
    SeoService,
    SkeletonComponent,
} from '../../../shared';
import { CollectionStoreService } from '../collection-store.service';

@Component({
    selector: 'app-collection-detail',
    templateUrl: './collection-detail.component.html',
    styleUrl: './collection-detail.component.scss',
    imports: [
        AsyncPipe,
        HeroSurfaceComponent,
        ImageComponent,
        RatingComponent,
        MediaListComponent,
        PageSectionComponent,
        SkeletonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetailComponent {
    constructor(
        public store: CollectionStoreService,
        private route: ActivatedRoute,
        private seo: SeoService,
    ) {
        this.route.paramMap
            .pipe(
                switchMap((params) =>
                    this.store.getCollection$(
                        Number(params.get('collectionId')),
                    ),
                ),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.collection$
            .pipe(
                tap((collectionState) => {
                    if (
                        collectionState.state === 'success' &&
                        collectionState.data?.name
                    ) {
                        const collection = collectionState.data;
                        const imagePath =
                            collection.backdrop_path ?? collection.poster_path ?? null;

                        this.seo.setPage({
                            title: `${collection.name} | Collection`,
                            description:
                                collection.overview ||
                                `Explore ${collection.name}, its movies, release timeline, ratings, and cast highlights on CineKeep.`,
                            image: buildTmdbImageUrl(
                                imagePath,
                                collection.backdrop_path ? 'w1280' : 'w780',
                            ),
                            imageAlt: `${collection.name} collection artwork`,
                            imageWidth: collection.backdrop_path ? 1280 : null,
                            imageHeight: collection.backdrop_path ? 720 : null,
                        });
                    }
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
