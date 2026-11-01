import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Review } from '../../../api';
import { RouteCommands } from '../../../shared';
import { toReviewPreviewText } from './review-text.mapper';

@Component({
    selector: 'app-review-card',
    imports: [DatePipe, DecimalPipe, RouterLink],
    templateUrl: './review-card.component.html',
    styleUrl: './review-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
    @Input({ required: true })
    set review(review: Review) {
        this.currentReview = review;
        this.author = review.author || review.author_details?.username || 'Anonymous';
        this.contentPreviewText = toReviewPreviewText(review.content ?? '');
        this.score = review.author_details?.rating || null;
    }

    @Input() reviewLink: string | RouteCommands | null = null;

    currentReview: Review | null = null;
    author = 'Anonymous';
    contentPreviewText = '';
    score: number | null = null;
}
