import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';

import { EMPTY, catchError, combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    EmptyStateComponent,
    RepeatPipe,
    SkeletonComponent,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SubPageHeaderComponent,
    MediaType,
    SeoService,
} from '../../../shared';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

@Component({
    selector: 'app-media-reviews-page',
    imports: [
        AsyncPipe,
        NgTemplateOutlet,
        MatButtonModule,
        EmptyStateComponent,
        RepeatPipe,
        ReviewCardComponent,
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
    }).pipe(
        map(({ mediaState, reviewsState, totalResults, hasMore }) => ({
            media: mediaState.state === 'success' ? mediaState.data : null,
            reviewsState,
            totalResults,
            hasMore,
        })),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaReviewsStoreService: MediaReviewsStoreService,
        private readonly snackbar: SnackbarService,
        private readonly seo: SeoService,
        private readonly route: ActivatedRoute,
    ) {
        this.route.parent!.paramMap
            .pipe(
                map((params) => ({
                    id: Number(params.get('id')),
                    type: (params.get('type') ?? 'movie') as MediaType,
                })),
                filter(({ id }) => Number.isInteger(id)),
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
