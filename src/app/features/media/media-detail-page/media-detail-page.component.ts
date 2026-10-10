import { AsyncPipe, DOCUMENT, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { catchError, filter } from 'rxjs';

import {
    buildYoutubeWatchUrl,
    EpisodeListItemComponent,
    ExternalLinksComponent,
    HeroSurfaceComponent,
    ImageComponent,
    isDefined,
    MediaCarouselPanelComponent,
    MediaRatingDialogService,
    MinutesToHoursPipe,
    PageSectionComponent,
    PhotoViewerDialogService,
    PluralizePipe,
    RepeatPipe,
    RouteCommands,
    SeoService,
    SkeletonComponent,
    SnackbarService,
    TmdbRatingComponent,
    VideoCardComponent,
    ViewerImage,
} from '../../../shared';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { MediaDetailActionsStoreService } from '../media-detail-actions-store.service';
import { MediaDetailStoreService, MediaRatingRequest } from '../media-detail-store.service';
import { toMediaSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { KeywordsListComponent } from './keywords-list/keywords-list.component';
import { MediaLibraryPanelComponent } from './media-library-panel/media-library-panel.component';

@Component({
    selector: 'app-media-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        DecimalPipe,
        EpisodeListItemComponent,
        ExternalLinksComponent,
        HeroSurfaceComponent,
        ImageComponent,
        KeywordsListComponent,
        MatButtonModule,
        MediaCarouselPanelComponent,
        MediaCreditsSummaryComponent,
        MediaLibraryPanelComponent,
        MinutesToHoursPipe,
        NgTemplateOutlet,
        PageSectionComponent,
        PluralizePipe,
        RepeatPipe,
        ReviewCardComponent,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        VideoCardComponent,
    ],
    templateUrl: './media-detail-page.component.html',
    styleUrl: './media-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDetailPageComponent {
    readonly mediaDetail$ = this.store.mediaDetail$;

    constructor(
        private readonly store: MediaDetailStoreService,
        private readonly actionsStore: MediaDetailActionsStoreService,
        private readonly activatedRoute: ActivatedRoute,
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly mediaRatingDialogService: MediaRatingDialogService,
        private readonly router: Router,
        private readonly snackbarService: SnackbarService,
        @Inject(DOCUMENT) private readonly document: Document,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSeoMetadata(media)));
    }

    openPhotoViewer(index: number, images: ViewerImage[], photosLink: RouteCommands | null, title: string): void {
        this.photoViewerDialogService.open({ images, activeIndex: index, photosLink, title });
    }

    openPhotosPage(): void {
        this.router.navigate(['photos'], { relativeTo: this.activatedRoute });
    }

    openTrailer(key: string): void {
        this.document.defaultView?.open(buildYoutubeWatchUrl(key), '_blank', 'noopener,noreferrer');
    }

    openUserRatingDialog(ratingRequest: MediaRatingRequest | null): void {
        if (!ratingRequest) {
            return;
        }

        const { target, title, currentRating } = ratingRequest;

        this.mediaRatingDialogService
            .open$({
                title,
                currentRating,
                save: (value) =>
                    this.actionsStore
                        .submitUserRating$(target, value)
                        .pipe(catchError(() => this.snackbarService.showError$('Could not save your rating.'))),
                remove: () =>
                    this.actionsStore
                        .deleteUserRating$(target)
                        .pipe(catchError(() => this.snackbarService.showError$('Could not remove your rating.'))),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
    }
}
