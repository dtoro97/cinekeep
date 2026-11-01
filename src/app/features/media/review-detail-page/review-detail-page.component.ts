import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { distinctUntilChanged, map, switchMap } from 'rxjs';

import { EmptyStateComponent, ImageComponent, RepeatPipe, SeoService, SkeletonComponent } from '../../../shared';
import { ReviewDetailPageStoreService } from './review-detail-page-store.service';

@Component({
    selector: 'app-review-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        DecimalPipe,
        EmptyStateComponent,
        ImageComponent,
        MatButtonModule,
        RepeatPipe,
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

        this.store.loadReviews$().pipe(takeUntilDestroyed()).subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }
}
