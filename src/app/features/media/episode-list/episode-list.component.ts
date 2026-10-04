import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { SMALL_LIST_COUNT } from '../../../constants';
import { EpisodeListItemComponent, RemoteData, RepeatPipe } from '../../../shared';
import type { EpisodeListEntry } from './episode-list.models';

@Component({
    selector: 'app-episode-list',
    imports: [EpisodeListItemComponent, RepeatPipe],
    templateUrl: './episode-list.component.html',
    styleUrl: './episode-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeListComponent {
    @Input({ required: true }) state!: RemoteData<EpisodeListEntry[]>;
    @Input() skeletonCount = SMALL_LIST_COUNT;
}
