import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MediaListItem } from '../../models';
import type { RouteCommands } from '../../types';
import { BadgeComponent } from '../badge/badge.component';
import { ImageComponent } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

// A movie or TV row: poster, title with badges, a meta line, overview and cast, the TMDb score on the right.
// Project `[media-list-item-note]` under the overview and `[media-list-item-action]` at the end.
@Component({
    selector: 'app-media-list-item',
    templateUrl: './media-list-item.component.html',
    styleUrl: './media-list-item.component.scss',
    imports: [BadgeComponent, DatePipe, DecimalPipe, ImageComponent, RouterLink, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListItemComponent implements OnChanges {
    @Input() item: MediaListItem | null = null;
    // Without a link the row renders as plain text.
    @Input() link: RouteCommands | null = null;
    @Input() genreNames: readonly string[] = [];
    @Input() loading = false;
    // The rating is the viewer's own (Ratings page): shown on the accent, out of 10.
    @Input() isOwnRating = false;
    showMetadata = false;
    showCast = false;

    ngOnChanges(): void {
        this.showMetadata = !!this.item?.date || this.genreNames.length > 0;
        this.showCast = !!this.item?.castLinks?.length;
    }
}
