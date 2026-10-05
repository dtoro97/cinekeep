import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, RemoteData, RepeatPipe, SkeletonComponent } from '../../../shared';
import { type CreditsSummary, TOP_CAST_GRID_COUNT } from './media-credits-summary.model';

@Component({
    selector: 'app-media-credits-summary',
    imports: [ImageComponent, RepeatPipe, RouterLink, SkeletonComponent],
    templateUrl: './media-credits-summary.component.html',
    styleUrl: './media-credits-summary.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaCreditsSummaryComponent {
    @Input({ required: true }) data!: RemoteData<CreditsSummary | null>;

    readonly skeletonCount = TOP_CAST_GRID_COUNT;
}
