import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CardItem } from '../../models';
import { ImageComponent } from '../image/image.component';
import { RatingComponent } from '../rating/rating.component';

export type CardDateFormat = 'year' | 'dayMonth';

/** `DatePipe` patterns behind each card date format; shared by poster and backdrop cards. */
export const CARD_DATE_PATTERNS: Readonly<Record<CardDateFormat, string>> = {
    year: 'yyyy',
    dayMonth: 'MMM d',
};

@Component({
    selector: 'app-card',
    templateUrl: './card.component.html',
    imports: [DatePipe, RouterLink, ImageComponent, RatingComponent],
    styleUrl: './card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
    @Input({ required: true }) item!: CardItem;
    @Input() dateFormat: CardDateFormat = 'year';
    @Input() imageParams?: string;
    @Input() showRating = true;

    protected readonly datePatterns = CARD_DATE_PATTERNS;
}
