import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterOutlet } from '@angular/router';

import { filter, map, switchMap } from 'rxjs';

import { MediaImagesStoreService } from '../media-images-store.service';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';
import { MediaDetailActionsStore } from '../media-detail-actions-store.service';
import { EpisodeDetailStoreService } from '../episode-detail-page/episode-detail-store.service';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { MediaType } from '../../../shared';

@Component({
    selector: 'app-media-wrapper',
    template: '<router-outlet />',
    imports: [RouterOutlet],
    providers: [
        MediaStoreService,
        MediaDetailStoreService,
        MediaDetailActionsStore,
        EpisodeDetailStoreService,
        MediaCreditsStoreService,
        MediaImagesStoreService,
        MediaReviewsStoreService,
        MediaSeasonsStoreService,
        MediaVideoStoreService,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaWrapperComponent {
    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly route: ActivatedRoute,
    ) {
        this.route.paramMap
            .pipe(
                map((params) => ({
                    id: Number(params.get('id')),
                    type: (params.get('type') ?? 'movie') as MediaType,
                })),
                filter(({ id }) => Number.isInteger(id)),
                switchMap((target) => this.mediaStore.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
