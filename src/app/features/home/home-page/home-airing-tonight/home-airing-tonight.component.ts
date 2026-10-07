import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    EmptyStateComponent,
    ImageComponent,
    MediaListItem,
    RatingComponent,
    RepeatPipe,
    SkeletonComponent,
} from '../../../../shared';

@Component({
    selector: 'app-home-airing-tonight',
    imports: [EmptyStateComponent, ImageComponent, RatingComponent, RepeatPipe, RouterLink, SkeletonComponent],
    templateUrl: './home-airing-tonight.component.html',
    styleUrl: './home-airing-tonight.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAiringTonightComponent {
    @Input({ required: true }) items!: MediaListItem[];
    @Input({ required: true }) skeletonCount!: number;
    @Input() loading = false;
    @Input() showEmpty = false;
}
