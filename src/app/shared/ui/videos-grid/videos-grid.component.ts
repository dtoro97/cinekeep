import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';
import { NgTemplateOutlet, SlicePipe } from '@angular/common';

import { RepeatPipe } from '../../pipes';
import type { VideoCardItem } from '../../models';
import type { RemoteData } from '../../types';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { VideoCardComponent } from '../video-card/video-card.component';

@Component({
    selector: 'app-videos-grid',
    imports: [
        NgTemplateOutlet,
        SlicePipe,
        RepeatPipe,
        VideoCardComponent,
        SkeletonComponent,
    ],
    templateUrl: './videos-grid.component.html',
    styleUrl: './videos-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideosGridComponent {
    @Input() state: RemoteData<VideoCardItem[]> = { state: 'notAsked' };
    readonly gridCount = 4;
}
