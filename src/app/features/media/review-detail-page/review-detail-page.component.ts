import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { catchError, combineLatest, distinctUntilChanged, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import {
    buildTmdbImageUrl,
    EmptyStateComponent,
    SeoService,
    SkeletonComponent,
    SubPageHeaderComponent,
    remoteSuccess,
    formatTitleWithYear,
} from '../../../shared';
import { MediaApiService } from '../media-api.service';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { ReviewMediaSummaryComponent } from '../review-media-summary/review-media-summary.component';
import { MediaDetails } from '../models/media-details.model';

@Component({
    selector: 'app-review-detail-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        ReviewCardComponent,
        ReviewMediaSummaryComponent,
        SkeletonComponent,
        SubPageHeaderComponent,
    ],
    templateUrl: './review-detail-page.component.html',
    styleUrl: './review-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailPageComponent {
    readonly reviewId = input.required<string>();
    readonly skeletonLines = Array.from({ length: 8 });

    readonly reviewState$ = toObservable(this.reviewId).pipe(
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

    readonly vm$ = combineLatest({
        reviewState: this.reviewState$,
        mediaState: this.mediaStore.mediaDetailsState$,
    }).pipe(
        map(({ reviewState, mediaState }) => {
            const review = reviewState.state === 'success' ? reviewState.data : null;
            const author = review?.author || review?.author_details?.username;

            return {
                reviewState,
                media: mediaState.state === 'success' ? mediaState.data : null,
                pageTitle: author ? `Review by ${author}` : 'Review',
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaApiService: MediaApiService,
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
                    const mediaTitle = media
                        ? formatTitleWithYear(media.title, media.year)
                        : review.media_title ?? 'Review';
                    const imagePath = getReviewImagePath(media);
                    const hasBackdrop = !!media?.backdropPath;

                    this.seo.setPage({
                        title: `${mediaTitle} | Review`,
                        description:
                            review.content ||
                            `Read a full review of ${mediaTitle}.`,
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
