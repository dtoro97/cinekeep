import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, MediaListItem, RatingComponent, RepeatPipe, SkeletonComponent } from '../../../../shared';

interface TopPickItem {
    readonly item: MediaListItem;
    readonly rank: number;
}

@Component({
    selector: 'app-home-top-picks',
    imports: [RouterLink, ImageComponent, RatingComponent, RepeatPipe, SkeletonComponent],
    templateUrl: './home-top-picks.component.html',
    styleUrl: './home-top-picks.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeTopPicksComponent {
    @Input({ required: true }) loading!: boolean;
    @Input({ required: true }) items!: readonly TopPickItem[];

    readonly skeletonCount = 10;
}
