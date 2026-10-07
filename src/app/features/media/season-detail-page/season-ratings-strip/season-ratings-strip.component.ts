import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { SeasonRatingBar } from './season-ratings.mapper';

/** The shape of a season: one bar per episode, highest-rated in gold, each linking to its episode. */
@Component({
    selector: 'app-season-ratings-strip',
    imports: [RouterLink],
    templateUrl: './season-ratings-strip.component.html',
    styleUrl: './season-ratings-strip.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonRatingsStripComponent {
    @Input({ required: true }) bars!: readonly SeasonRatingBar[];
}
