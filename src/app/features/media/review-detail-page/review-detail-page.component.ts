import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { distinctUntilChanged, map, switchMap } from 'rxjs';

import { EmptyStateComponent, RepeatPipe, SeoService, SkeletonComponent } from '../../../shared';
import { MediaSubPageHeaderComponent } from '../media-sub-page-header/media-sub-page-header.component';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { ReviewMediaSummaryComponent } from '../review-media-summary/review-media-summary.component';
import { ReviewDetailPageStoreService } from './review-detail-page-store.service';

@Component({
    selector: 'app-review-detail-page',
    imports: [
        AsyncPipe,
        DecimalPipe,
        EmptyStateComponent,
        MediaSubPageHeaderComponent,
        RepeatPipe,
        ReviewCardComponent,
        ReviewMediaSummaryComponent,
        RouterLink,
        SkeletonComponent,
    ],
    providers: [ReviewDetailPageStoreService],
    templateUrl: './review-detail-page.component.html',
    styleUrl: './review-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailPageComponent {
    readonly skeletonLineCount = 8;
    readonly reviewDetail$ = this.store.reviewDetail$;

    constructor(
        private readonly store: ReviewDetailPageStoreService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        activatedRoute.paramMap
            .pipe(
                map((paramMap) => paramMap.get('reviewId')),
                distinctUntilChanged(),
                switchMap((reviewId) => this.store.loadReview$(reviewId)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.loadOtherReviews$().pipe(takeUntilDestroyed()).subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }
}
