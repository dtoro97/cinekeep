import { AsyncPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { catchError, filter } from 'rxjs';

import {
    EmptyStateComponent,
    isDefined,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    SnackbarService,
    SubPageHeaderComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { ReviewMediaSummaryComponent } from '../review-media-summary/review-media-summary.component';
import { MediaReviewsPageStoreService } from './media-reviews-page-store.service';

@Component({
    selector: 'app-media-reviews-page',
    imports: [
        AsyncPipe,
        DecimalPipe,
        EmptyStateComponent,
        MatButtonModule,
        NgTemplateOutlet,
        RepeatPipe,
        ReviewCardComponent,
        ReviewMediaSummaryComponent,
        SkeletonComponent,
        SubPageHeaderComponent,
    ],
    providers: [MediaReviewsPageStoreService],
    templateUrl: './media-reviews-page.component.html',
    styleUrl: './media-reviews-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaReviewsPageComponent {
    readonly skeletonCount = 5;
    readonly mediaReviews$ = this.store.mediaReviews$;

    constructor(
        private readonly store: MediaReviewsPageStoreService,
        private readonly snackbarService: SnackbarService,
        private readonly destroyRef: DestroyRef,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Reviews')));
    }

    loadMore(): void {
        this.store
            .loadMore$()
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not load more reviews.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
