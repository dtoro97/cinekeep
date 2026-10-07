import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';

import { EMPTY, distinctUntilChanged, map, switchMap } from 'rxjs';

import { MediaImagesStoreService } from '../media-images-store.service';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaReviewsStoreService } from '../media-reviews-store.service';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';
import { MediaDetailActionsStoreService } from '../media-detail-actions-store.service';
import { EpisodeDetailStoreService } from '../episode-detail-store.service';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { isSameMediaTarget, toMediaTarget } from '../media-target';

@Component({
    selector: 'app-media-wrapper',
    template: '<router-outlet />',
    imports: [RouterOutlet],
    providers: [
        MediaStoreService,
        MediaDetailStoreService,
        MediaDetailActionsStoreService,
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
        private readonly router: Router,
        activatedRoute: ActivatedRoute,
    ) {
        activatedRoute.paramMap
            .pipe(
                map((paramMap) => toMediaTarget(paramMap.get('id'), paramMap.get('type'))),
                distinctUntilChanged((previous, current) => current !== null && isSameMediaTarget(previous, current)),
                switchMap((target) => {
                    if (!target) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                        return EMPTY;
                    }

                    return this.mediaStore.load$(target);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
