import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, booleanAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { MediaListItemBadge } from '../../models';
import { MinutesToHoursPipe } from '../../pipes/minutes-to-hours.pipe';
import type { RouteCommands } from '../../types';
import { BadgeComponent } from '../badge/badge.component';
import { ImageComponent } from '../image/image.component';
import { RatingComponent } from '../rating/rating.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export interface EpisodeListItemData {
    readonly name: string;
    /** Context shown first in the meta line, e.g. the series title. */
    readonly subtitle: string | null;
    readonly overview: string;
    readonly stillPath: string | null;
    /** `S2E8`, shown before the title; `null` hides it, as in season lists that lead with the number. */
    readonly code: string | null;
    readonly episodeNumber: number | null;
    readonly airDate: string | null;
    readonly runtime: number | null;
    /** A normalized rating (see `toRating`); `null` when unrated. */
    readonly voteAverage: number | null;
    readonly badges?: readonly MediaListItemBadge[];
    readonly routeCommands: RouteCommands | null;
}

/**
 * An episode row: still, title with rating and badges, a meta line and the overview.
 * Projected content renders at the end of the row (actions).
 */
@Component({
    selector: 'app-episode-list-item',
    imports: [
        BadgeComponent,
        DatePipe,
        ImageComponent,
        MinutesToHoursPipe,
        RatingComponent,
        RouterLink,
        SkeletonComponent,
    ],
    templateUrl: './episode-list-item.component.html',
    styleUrl: './episode-list-item.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeListItemComponent implements OnChanges {
    @Input() item: EpisodeListItemData | null = null;
    @Input() loading = false;
    /** Leads with the episode number (inside a season) instead of an S1E2 code. */
    @Input({ transform: booleanAttribute }) numbered = false;
    /** Marks the row as the standout episode, e.g. the season's highest rated. */
    @Input({ transform: booleanAttribute }) highlighted = false;
    showMetadata = false;

    ngOnChanges(): void {
        this.showMetadata = !!(this.item?.subtitle || this.item?.airDate || this.item?.runtime);
    }
}
