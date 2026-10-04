import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marked } from 'marked';

import { Review, ReviewDetails } from '../../../api';
import { ImagePipe, RatingBadgeComponent } from '../../../shared';
import { toReviewPreviewText } from '../mappers/review-text.mapper';

export type ReviewCardVariant = 'preview' | 'list' | 'detail';
type ReviewCardItem = Review | ReviewDetails;

@Component({
    selector: 'app-review-card',
    imports: [DatePipe, DecimalPipe, NgTemplateOutlet, ImagePipe, RatingBadgeComponent, RouterLink],
    templateUrl: './review-card.component.html',
    styleUrl: './review-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
    @Input({ required: true })
    set review(review: ReviewCardItem) {
        const contentMarkdown = review.content ?? '';

        this.currentReview = review;
        this.contentHtml = this.renderMarkdown(contentMarkdown);
        this.contentPreviewText = toReviewPreviewText(contentMarkdown);
        this.initial = this.toInitial(review);
        this.score = review.author_details?.rating || null;
    }

    @Input() variant: ReviewCardVariant = 'list';
    @Input() reviewLink: string | readonly unknown[] | null = null;

    currentReview: ReviewCardItem | null = null;
    contentHtml = '';
    contentPreviewText = '';
    initial = 'A';
    score: number | null = null;

    private renderMarkdown(content: string): string {
        const rendered = marked.parse(content, {
            breaks: true,
            gfm: true,
        });

        return typeof rendered === 'string' ? rendered : content;
    }

    private toInitial(review: ReviewCardItem): string {
        const label = review.author || review.author_details?.username || 'Anonymous';
        return label.trim().charAt(0).toUpperCase();
    }
}
