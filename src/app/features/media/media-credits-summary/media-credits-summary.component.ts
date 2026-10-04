import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, RemoteData, SkeletonComponent } from '../../../shared';
import { type CreditsSummary } from './media-credits-summary.model';

const SKELETON_COUNT = 12;

@Component({
    selector: 'app-media-credits-summary',
    imports: [ImageComponent, RouterLink, SkeletonComponent],
    templateUrl: './media-credits-summary.component.html',
    styleUrl: './media-credits-summary.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaCreditsSummaryComponent {
    @Input({ required: true }) data!: RemoteData<CreditsSummary | null>;

    readonly skeletonItems = Array.from({ length: SKELETON_COUNT }, (_, index) => index);
}
