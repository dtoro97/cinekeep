import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CardItem } from '../../models';
import { RouteCommands } from '../../types';
import { CARD_DATE_PATTERNS, CardDateFormat } from '../card/card.component';
import { ImageComponent } from '../image/image.component';
import { RatingComponent } from '../rating/rating.component';

@Component({
    selector: 'app-backdrop-card',
    templateUrl: './backdrop-card.component.html',
    imports: [DatePipe, RouterLink, ImageComponent, RatingComponent],
    styleUrl: './backdrop-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackdropCardComponent implements OnChanges {
    @Input({ required: true }) item!: CardItem;
    @Input() showDate = false;
    @Input() showRating = true;
    @Input() dateFormat: CardDateFormat = 'year';

    routeCommands: RouteCommands = [];
    datePattern = CARD_DATE_PATTERNS.year;
    rating: number | null = null;
    showDateValue = false;

    ngOnChanges(): void {
        this.routeCommands = this.item.routeCommands ?? ['/title', this.item.id, this.item.mediaType];
        this.datePattern = CARD_DATE_PATTERNS[this.dateFormat];
        this.rating = this.showRating ? this.item.rating : null;
        this.showDateValue = this.showDate && !!this.item.date;
    }
}
