import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { catchError } from 'rxjs';

import {
    HeroSurfaceComponent,
    ImageComponent,
    MediaRatingDialogService,
    MinutesToHoursPipe,
    PageSectionComponent,
    PhotoViewerDialogService,
    RepeatPipe,
    RouteCommands,
    SeoService,
    SkeletonComponent,
    SnackbarService,
    TmdbRatingComponent,
    VideosGridComponent,
    ViewerImage,
} from '../../../shared';
import { EpisodeDetailStoreService, EpisodeRatingRequest } from '../episode-detail-store.service';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { UserRatingComponent } from '../user-rating/user-rating.component';

@Component({
    selector: 'app-episode-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        HeroSurfaceComponent,
        ImageComponent,
        MediaCreditsSummaryComponent,
        MinutesToHoursPipe,
        NgTemplateOutlet,
        PageSectionComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        UserRatingComponent,
        VideosGridComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './episode-detail-page.component.html',
    styleUrl: './episode-detail-page.component.scss',
})
export class EpisodeDetailPageComponent {
    readonly stillSkeletonCount = 6;
    readonly episodeDetail$ = this.store.episodeDetail$;

    constructor(
        private readonly store: EpisodeDetailStoreService,
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly mediaRatingDialogService: MediaRatingDialogService,
        private readonly snackbarService: SnackbarService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store.load$(activatedRoute.paramMap).pipe(takeUntilDestroyed()).subscribe();

        this.store.episodeSeo$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(index: number, images: ViewerImage[], title: string, photosLink: RouteCommands | null): void {
        this.photoViewerDialogService.open({ images, activeIndex: index, title, photosLink });
    }

    openUserRatingDialog(ratingRequest: EpisodeRatingRequest | null): void {
        if (!ratingRequest) {
            return;
        }

        const { target, title, currentRating } = ratingRequest;

        this.mediaRatingDialogService
            .open$({
                title,
                currentRating,
                save: (value) =>
                    this.store
                        .submitUserRating$(target, value)
                        .pipe(catchError(() => this.snackbarService.showError$('Could not save your rating.'))),
                remove: () =>
                    this.store
                        .deleteUserRating$(target)
                        .pipe(catchError(() => this.snackbarService.showError$('Could not remove your rating.'))),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
    }
}
