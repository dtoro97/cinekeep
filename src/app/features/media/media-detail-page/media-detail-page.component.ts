import { AsyncPipe, DOCUMENT, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { filter, map } from 'rxjs';

import {
    buildYoutubeWatchUrl,
    CardComponent,
    CardSkeletonComponent,
    CatalogueBackdropComponent,
    EpisodeListItemComponent,
    ExternalLinksComponent,
    ImageComponent,
    isDefined,
    LibraryToggleComponent,
    MinutesToHoursPipe,
    PhotosPreviewComponent,
    PhotoViewerDialogService,
    RatingScaleComponent,
    RepeatPipe,
    RouteCommands,
    scrollToSection,
    SeoService,
    SigninDialogService,
    SkeletonComponent,
    TmdbRatingComponent,
    VideosGridComponent,
    ViewerImage,
    watchActiveSectionId$,
    YourLibraryComponent,
} from '../../../shared';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { toMediaSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { WhereToWatchComponent } from '../where-to-watch/where-to-watch.component';
import { KeywordsListComponent } from './keywords-list/keywords-list.component';
import { MediaListActionsComponent } from './media-list-actions/media-list-actions.component';

@Component({
    selector: 'app-media-detail-page',
    imports: [
        AsyncPipe,
        CardComponent,
        CardSkeletonComponent,
        CatalogueBackdropComponent,
        DatePipe,
        DecimalPipe,
        EpisodeListItemComponent,
        ExternalLinksComponent,
        ImageComponent,
        KeywordsListComponent,
        LibraryToggleComponent,
        MatButtonModule,
        MediaCreditsSummaryComponent,
        MediaListActionsComponent,
        MinutesToHoursPipe,
        PhotosPreviewComponent,
        RatingScaleComponent,
        RepeatPipe,
        ReviewCardComponent,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        VideosGridComponent,
        WhereToWatchComponent,
        YourLibraryComponent,
    ],
    templateUrl: './media-detail-page.component.html',
    styleUrl: './media-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDetailPageComponent {
    readonly mediaDetail$ = this.store.mediaDetail$;

    readonly activeSectionId$ = watchActiveSectionId$(
        this.document,
        this.platformId,
        this.mediaDetail$.pipe(map(({ sectionIndex }) => sectionIndex.map((section) => section.id))),
    );

    constructor(
        private readonly store: MediaDetailStoreService,
        private readonly activatedRoute: ActivatedRoute,
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly router: Router,
        private readonly signinDialogService: SigninDialogService,
        @Inject(DOCUMENT) private readonly document: Document,
        @Inject(PLATFORM_ID) private readonly platformId: object,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSeoMetadata(media)));
    }

    openPhotoViewer(index: number, images: ViewerImage[], photosLink: RouteCommands | null): void {
        this.photoViewerDialogService.open({ images, activeIndex: index, photosLink });
    }

    openPhotosPage(): void {
        this.router.navigate(['photos'], { relativeTo: this.activatedRoute });
    }

    scrollToSection(id: string): void {
        scrollToSection(this.document, id);
    }

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    openTrailer(key: string): void {
        this.document.defaultView?.open(buildYoutubeWatchUrl(key), '_blank', 'noopener,noreferrer');
    }
}
