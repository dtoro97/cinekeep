import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CardItem } from '../../models';
import { RouteCommands } from '../../types';
import { ImageComponent } from '../image/image.component';
import { RatingComponent } from '../rating/rating.component';

export type CardDateFormat = 'year' | 'dayMonth';

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
export class CardComponent implements OnChanges {
    @Input({ required: true }) item!: CardItem;
    @Input() dateFormat: CardDateFormat = 'year';
    @Input() imageParams?: string;
    @Input() showRating = true;

    routeCommands: RouteCommands = [];
    datePattern = CARD_DATE_PATTERNS.year;
    rating: number | null = null;
    showMetadata = false;

    ngOnChanges(): void {
        this.routeCommands = this.item.routeCommands ?? ['/title', this.item.id, this.item.mediaType];
        this.datePattern = CARD_DATE_PATTERNS[this.dateFormat];
        this.rating = this.showRating ? this.item.rating : null;
        this.showMetadata = !!this.rating || !!this.item.date;
    }
}
