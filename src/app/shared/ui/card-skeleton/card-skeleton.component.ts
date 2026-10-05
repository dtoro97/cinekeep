import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-card-skeleton',
    imports: [SkeletonComponent],
    templateUrl: './card-skeleton.component.html',
    styleUrl: './card-skeleton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { 'aria-hidden': 'true' },
})
export class CardSkeletonComponent {}
