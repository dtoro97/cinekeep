import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { catchError } from 'rxjs';

import {
    CatalogueBackdropComponent,
    ImageComponent,
    MediaRatingDialogRequest,
    MediaRatingDialogService,
    MinutesToHoursPipe,
    PhotoViewerDialogService,
    RatingScaleComponent,
    RepeatPipe,
    SeoService,
    SigninDialogService,
    SkeletonComponent,
    SnackbarService,
    TmdbRatingComponent,
    VideosGridComponent,
    ViewerImage,
    YourLibraryComponent,
} from '../../../shared';
import { EpisodeDetailStoreService } from '../episode-detail-store.service';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';

@Component({
    selector: 'app-episode-detail-page',
    imports: [
        AsyncPipe,
        CatalogueBackdropComponent,
        DatePipe,
        DecimalPipe,
        ImageComponent,
        MatButtonModule,
        MediaCreditsSummaryComponent,
        MinutesToHoursPipe,
        RatingScaleComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        VideosGridComponent,
        YourLibraryComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './episode-detail-page.component.html',
    styleUrl: './episode-detail-page.component.scss',
})
export class EpisodeDetailPageComponent {
    readonly episodeDetail$ = this.store.episodeDetail$;

    constructor(
        private readonly store: EpisodeDetailStoreService,
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly mediaRatingDialogService: MediaRatingDialogService,
        private readonly signinDialogService: SigninDialogService,
        private readonly snackbarService: SnackbarService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store.load$(activatedRoute.paramMap).pipe(takeUntilDestroyed()).subscribe();

        this.store.episodeSeo$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(index: number, images: ViewerImage[]): void {
        this.photoViewerDialogService.open({ images, activeIndex: index });
    }

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    openUserRatingDialog(ratingRequest: MediaRatingDialogRequest | null): void {
        if (!ratingRequest) {
            return;
        }

        this.mediaRatingDialogService
            .open$(ratingRequest)
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not update your rating.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
