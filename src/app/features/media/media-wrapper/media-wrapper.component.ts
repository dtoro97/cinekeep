import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';

import { filter, switchMap, tap } from 'rxjs';

import { MediaImagesStoreService } from '../media-images-store.service';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';
import { MediaDetailActionsStore } from '../media-detail-actions-store.service';
import { EpisodeDetailStoreService } from '../episode-detail-page/episode-detail-store.service';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { isDefined } from '../../../shared';
import { toMediaTarget } from '../media-target';

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
    readonly id = input.required<string>();
    readonly type = input.required<string>();

    private readonly target = computed(() => toMediaTarget(this.id(), this.type()));

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly router: Router,
    ) {
        toObservable(this.target)
            .pipe(
                tap((target) => {
                    if (!target) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
                filter(isDefined),
                switchMap((target) => this.mediaStore.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
