import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent, ImageComponent, RepeatPipe, SkeletonComponent } from '../../../../shared';
import { OpeningSoonDay } from '../home-store.service';

@Component({
    selector: 'app-home-opening-soon',
    imports: [DatePipe, EmptyStateComponent, ImageComponent, RepeatPipe, RouterLink, SkeletonComponent],
    templateUrl: './home-opening-soon.component.html',
    styleUrl: './home-opening-soon.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeOpeningSoonComponent {
    @Input({ required: true }) days!: OpeningSoonDay[];
    @Input() loading = false;
    @Input() showEmpty = false;
}
