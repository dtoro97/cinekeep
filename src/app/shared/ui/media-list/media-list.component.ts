import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

import { SMALL_LIST_COUNT } from '../../../constants';
import { MediaListEntry } from '../../models';
import { RepeatPipe } from '../../pipes/repeat.pipe';
import { RemoteData } from '../../types';
import { remoteData } from '../../utils/remote-data';
import { MediaListItemComponent } from '../media-list-item/media-list-item.component';

@Component({
    selector: 'app-media-list',
    imports: [NgTemplateOutlet, MediaListItemComponent, RepeatPipe],
    templateUrl: './media-list.component.html',
    styleUrl: './media-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListComponent implements OnChanges {
    @Input({ required: true }) state!: RemoteData<MediaListEntry[]>;
    @Input() skeletonCount = SMALL_LIST_COUNT;
    entries: MediaListEntry[] = [];
    showSkeleton = false;
    showMoreSkeleton = false;

    ngOnChanges(): void {
        this.entries = remoteData(this.state, []);
        this.showSkeleton = this.state.state === 'loading';
        this.showMoreSkeleton = this.state.state === 'loading-more';
    }
}
