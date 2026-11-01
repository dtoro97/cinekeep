import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImageComponent, MediaType } from '../../../shared';
import { WatchProviderPreview } from '../watch-provider-preview';

// The Where to watch group of a title or season sidebar: the streaming services, then any rows the
// page projects (cinemas, the next episode).
@Component({
    selector: 'app-where-to-watch',
    imports: [ImageComponent, RouterLink],
    templateUrl: './where-to-watch.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhereToWatchComponent {
    @Input({ required: true }) providers!: WatchProviderPreview | null;
    @Input({ required: true }) mediaType!: MediaType;
}
