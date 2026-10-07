import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { catchError } from 'rxjs';

import {
    HeroSurfaceComponent,
    MediaRatingDialogService,
    MinutesToHoursPipe,
    PageSectionComponent,
    PhotosPreviewComponent,
    PhotoViewerDialogService,
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
        MediaCreditsSummaryComponent,
        MinutesToHoursPipe,
        PageSectionComponent,
        PhotosPreviewComponent,
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
    readonly episodeDetail$ = this.store.episodeDetail$;

    constructor(
        private readonly store: EpisodeDetailStoreService,
        private readonly activatedRoute: ActivatedRoute,
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly mediaRatingDialogService: MediaRatingDialogService,
        private readonly router: Router,
        private readonly snackbarService: SnackbarService,
        seoService: SeoService,
    ) {
        this.store.load$(activatedRoute.paramMap).pipe(takeUntilDestroyed()).subscribe();

        this.store.episodeSeo$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(index: number, images: ViewerImage[]): void {
        this.photoViewerDialogService.open({ images, activeIndex: index });
    }

    openPhotosPage(): void {
        this.router.navigate(['photos'], { relativeTo: this.activatedRoute });
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
