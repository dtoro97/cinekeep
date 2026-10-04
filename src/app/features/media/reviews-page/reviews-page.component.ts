import { AsyncPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { EMPTY, catchError, combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    EmptyStateComponent,
    RepeatPipe,
    SkeletonComponent,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SubPageHeaderComponent,
    SeoService,
} from '../../../shared';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { ReviewMediaSummaryComponent } from '../review-media-summary/review-media-summary.component';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

@Component({
    selector: 'app-media-reviews-page',
    imports: [
        AsyncPipe,
        NgTemplateOutlet,
        MatButtonModule,
        DecimalPipe,
        EmptyStateComponent,
        RepeatPipe,
        ReviewCardComponent,
        ReviewMediaSummaryComponent,
        SkeletonComponent,
        SubPageHeaderComponent,
    ],
    templateUrl: './reviews-page.component.html',
    styleUrl: './reviews-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaReviewsPageComponent {
    readonly skeletonCount = 5;

    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        reviewsState: this.mediaReviewsStoreService.reviewsState$,
        totalResults: this.mediaReviewsStoreService.totalResults$,
        hasMore: this.mediaReviewsStoreService.hasMore$,
        ratingSummary: this.mediaReviewsStoreService.ratingSummary$,
    }).pipe(
        map(({ mediaState, reviewsState, totalResults, hasMore, ratingSummary }) => {
            const loadedCount =
                reviewsState.state === 'success' || reviewsState.state === 'loading-more'
                    ? reviewsState.data.length
                    : 0;

            return {
                media: mediaState.state === 'success' ? mediaState.data : null,
                reviewsState,
                hasMore,
                reviewCount: totalResults || loadedCount,
                ratingSummary,
                ratedCountLabel: ratingSummary.ratedCount === 1 ? 'from 1 rating' : `from ${ratingSummary.ratedCount} ratings`,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaReviewsStoreService: MediaReviewsStoreService,
        private readonly snackbar: SnackbarService,
        private readonly seo: SeoService,
    ) {
        this.mediaStore.currentTarget$
            .pipe(
                switchMap((target) => this.mediaReviewsStoreService.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaStore.mediaDetailsState$
            .pipe(
                map((state) => (state.state === 'success' ? state.data : null)),
                filter((media): media is MediaDetails => !!media),
                tap((media) =>
                    this.seo.setPage(toMediaSectionSeoMetadata(media, 'Reviews')),
                ),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    loadMore(): void {
        this.mediaReviewsStoreService
            .loadMoreReviews$()
            .pipe(
                catchError(() => {
                    this.snackbar.openSnackbar(SnackbarComponent, {
                        message: 'Could not load more reviews.',
                        type: SnackbarType.Error,
                    });
                    return EMPTY;
                }),
            )
            .subscribe();
    }
}
