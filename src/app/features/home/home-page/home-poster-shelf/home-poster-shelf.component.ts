import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { CardComponent, CardItem, CardSkeletonComponent, RepeatPipe } from '../../../../shared';

@Component({
    selector: 'app-home-poster-shelf',
    imports: [CardComponent, CardSkeletonComponent, RepeatPipe],
    templateUrl: './home-poster-shelf.component.html',
    styleUrl: './home-poster-shelf.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePosterShelfComponent {
    @Input({ required: true }) items!: CardItem[];
    @Input({ required: true }) columns!: number;
    @Input() loading = false;
}
