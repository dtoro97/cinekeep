import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';

import { SMALL_LIST_COUNT } from '../../../constants';
import { RemoteData } from '../../types';
import { MediaListEntry } from '../../models';
import { RepeatPipe } from '../../pipes/repeat.pipe';
import { MediaListItemComponent } from '../media-list-item/media-list-item.component';

@Component({
    selector: 'app-media-list',
    imports: [
        NgTemplateOutlet,
        MediaListItemComponent,
        RepeatPipe,
    ],
    templateUrl: './media-list.component.html',
    styleUrl: './media-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListComponent {
    @Input({ required: true }) state!: RemoteData<MediaListEntry[]>;
    @Input() skeletonCount = SMALL_LIST_COUNT;
    @Input() showIndex = false;
}
