import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';

import { EMPTY, Subject, combineLatest, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';

import { PageErrorComponent } from '../../../shared';
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
    templateUrl: './media-wrapper.component.html',
    imports: [AsyncPipe, PageErrorComponent, RouterOutlet],
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
    readonly showPageError$ = this.mediaStore.showPageError$;

    private readonly retryRequests = new Subject<void>();

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly router: Router,
        activatedRoute: ActivatedRoute,
    ) {
        combineLatest([
            activatedRoute.paramMap.pipe(
                map((paramMap) => toMediaTarget(paramMap.get('id'), paramMap.get('type'))),
                distinctUntilChanged((previous, current) => current !== null && isSameMediaTarget(previous, current)),
            ),
            this.retryRequests.pipe(startWith(undefined)),
        ])
            .pipe(
                switchMap(([target]) => {
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

    retry(): void {
        this.retryRequests.next();
    }
}
