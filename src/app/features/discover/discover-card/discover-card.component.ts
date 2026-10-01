import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    ImageComponent,
    type MediaListItem,
    RatingComponent,
    LibraryToggleComponent,
} from '../../../shared';

@Component({
    selector: 'app-discover-card',
    imports: [
        DatePipe,
        ImageComponent,
        RatingComponent,
        RouterLink,
        LibraryToggleComponent,
    ],
    templateUrl: './discover-card.component.html',
    styleUrl: './discover-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverCardComponent {
    @Input({ required: true }) item!: MediaListItem;
    @Input({ required: true }) link!: readonly (string | number)[];
    @Input() genreNames: readonly string[] = [];
}
