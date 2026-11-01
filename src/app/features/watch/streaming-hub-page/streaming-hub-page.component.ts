import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ImageComponent, RepeatPipe, SeoService, SkeletonComponent, toSeoImage } from '../../../shared';
import { StreamingHubStoreService } from './streaming-hub-store.service';

const STREAMING_HUB_SUBTITLE =
    'Popular movies and TV series on streaming services in your region, by service and by list.';

@Component({
    selector: 'app-streaming-hub-page',
    imports: [AsyncPipe, ImageComponent, RouterLink, RepeatPipe, SkeletonComponent],
    providers: [StreamingHubStoreService],
    templateUrl: './streaming-hub-page.component.html',
    styleUrl: './streaming-hub-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingHubPageComponent {
    readonly streamingHub$ = this.store.streamingHub$;
    readonly subtitle = STREAMING_HUB_SUBTITLE;
    readonly previewSlots = 3;

    constructor(
        private store: StreamingHubStoreService,
        seoService: SeoService,
    ) {
        this.streamingHub$.pipe(takeUntilDestroyed()).subscribe(({ seoBackdropPath }) =>
            seoService.setPage({
                title: 'Streaming guide',
                description: STREAMING_HUB_SUBTITLE,
                ...toSeoImage(seoBackdropPath),
                imageAlt: 'CineKeep streaming guide preview',
            }),
        );
    }
}
