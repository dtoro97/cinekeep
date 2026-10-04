import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MediaListItem } from '../../models';
import { BadgeComponent } from '../badge/badge.component';
import { ImageComponent } from '../image/image.component';
import { RatingComponent } from '../rating/rating.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * A movie or TV row: poster, title with rating and badges, a meta line, overview and cast.
 * Project `[media-list-item-note]` under the overview and `[media-list-item-action]` at the end.
 */
@Component({
    selector: 'app-media-list-item',
    templateUrl: './media-list-item.component.html',
    styleUrl: './media-list-item.component.scss',
    imports: [BadgeComponent, DatePipe, ImageComponent, RatingComponent, RouterLink, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListItemComponent {
    @Input() item: MediaListItem | null = null;
    /** Without a link the row renders as plain text. */
    @Input() link: readonly (string | number)[] | null = null;
    /** A rank shown before the poster; also reserves the rank column while loading. */
    @Input() index: number | null = null;
    @Input() genreNames: readonly string[] = [];
    @Input() loading = false;
}
