import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marked } from 'marked';

import { Review, ReviewDetails } from '../../../api';
import { RouteCommands } from '../../../shared';
import { toReviewPreviewText } from './review-text.mapper';

export type ReviewCardVariant = 'list' | 'detail';
type ReviewCardItem = Review | ReviewDetails;

@Component({
    selector: 'app-review-card',
    imports: [DatePipe, DecimalPipe, RouterLink],
    templateUrl: './review-card.component.html',
    styleUrl: './review-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
    @Input({ required: true })
    set review(review: ReviewCardItem) {
        const contentMarkdown = review.content ?? '';
        const rendered = marked.parse(contentMarkdown, { breaks: true, gfm: true });

        this.currentReview = review;
        this.author = review.author || review.author_details?.username || 'Anonymous';
        this.contentHtml = typeof rendered === 'string' ? rendered : contentMarkdown;
        this.contentPreviewText = toReviewPreviewText(contentMarkdown);
        this.score = review.author_details?.rating || null;
        this.initials = this.author
            .split(/s+/)
            .map((word) => word.charAt(0))
            .join('')
            .slice(0, 2)
            .toLocaleUpperCase();
    }

    @Input() variant: ReviewCardVariant = 'list';
    @Input() reviewLink: string | RouteCommands | null = null;

    currentReview: ReviewCardItem | null = null;
    author = '';
    contentHtml = '';
    contentPreviewText = '';
    score: number | null = null;
    initials = '';
}
