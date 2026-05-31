import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { catchError, combineLatest, distinctUntilChanged, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import {
    buildTmdbImageUrl,
    EmptyStateComponent,
    ImageComponent,
    SeoService,
    SkeletonComponent,
    SubPageHeaderComponent,
    remoteSuccess,
} from '../../../shared';
import { MediaApiService } from '../media-api.service';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { MediaDetails } from '../models/media-details.model';

@Component({
    selector: 'app-review-detail-page',
    imports: [AsyncPipe, EmptyStateComponent, ImageComponent, ReviewCardComponent, SkeletonComponent, SubPageHeaderComponent],
    templateUrl: './review-detail-page.component.html',
    styleUrl: './review-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailPageComponent {
    readonly reviewState$ = this.route.paramMap.pipe(
        map((params) => params.get('reviewId')),
        distinctUntilChanged(),
        switchMap((reviewId) => {
            if (!reviewId) {
                return of(remoteSuccess(null));
            }

            return this.mediaApiService.getReviewDetails$(reviewId).pipe(
                map((review) => remoteSuccess(review)),
                catchError(() => of(remoteSuccess(null))),
                startWith({ state: 'loading' as const }),
            );
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
    );

    constructor(
        public readonly mediaStore: MediaStoreService,
        private readonly mediaApiService: MediaApiService,
        private readonly route: ActivatedRoute,
        private readonly seo: SeoService,
    ) {
        combineLatest({
            reviewState: this.reviewState$,
            mediaState: this.mediaStore.mediaDetailsState$,
        })
            .pipe(
                tap(({ reviewState, mediaState }) => {
                    if (reviewState.state !== 'success' || !reviewState.data) {
                        return;
                    }

                    const media =
                        mediaState.state === 'success' ? mediaState.data : null;
                    const review = reviewState.data;
                    const mediaTitle = review.media_title ?? media?.title ?? 'Review';
                    const imagePath = getReviewImagePath(media);
                    const hasBackdrop = !!media?.backdropPath;

                    this.seo.setPage({
                        title: `${mediaTitle} | Review`,
                        description:
                            review.content ||
                            `Read a review of ${mediaTitle} on CineKeep.`,
                        image: buildTmdbImageUrl(
                            imagePath,
                            hasBackdrop ? 'w1280' : 'w780',
                        ),
                        imageAlt: `${mediaTitle} review preview`,
                        imageWidth: hasBackdrop ? 1280 : null,
                        imageHeight: hasBackdrop ? 720 : null,
                        type:
                            media?.mediaType === 'tv'
                                ? 'video.tv_show'
                                : 'video.movie',
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}

const getReviewImagePath = (media: MediaDetails | null): string | null =>
    media?.backdropPath ?? media?.posterPath ?? null;
