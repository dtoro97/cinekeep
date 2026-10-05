import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { buildTmdbImageUrl, ImagePipe, RepeatPipe, SeoService, SkeletonComponent } from '../../../shared';
import { StreamingHubStoreService } from './streaming-hub-store.service';

const STREAMING_HUB_SUBTITLE =
    'Popular movies and TV series streaming now, grouped by provider, release timing, runtime, and mood.';

@Component({
    selector: 'app-streaming-hub-page',
    imports: [AsyncPipe, ImagePipe, RouterLink, RepeatPipe, SkeletonComponent],
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
                title: 'Streaming Guide',
                description: STREAMING_HUB_SUBTITLE,
                image: buildTmdbImageUrl(seoBackdropPath, 'w1280'),
                imageAlt: 'CineKeep streaming guide preview',
                imageWidth: seoBackdropPath ? 1280 : null,
                imageHeight: seoBackdropPath ? 720 : null,
            }),
        );
    }
}
