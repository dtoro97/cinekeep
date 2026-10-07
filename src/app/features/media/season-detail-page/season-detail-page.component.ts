import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { map } from 'rxjs';

import {
    HeroSurfaceComponent,
    ImageComponent,
    PageSectionComponent,
    PhotosPreviewComponent,
    PhotoViewerDialogService,
    RouteCommands,
    SeoService,
    SkeletonComponent,
    TmdbRatingComponent,
    ToggleGroupComponent,
    VideosGridComponent,
    ViewerImage,
} from '../../../shared';
import { EpisodeListComponent } from './episode-list/episode-list.component';
import { SeasonDetailPageStoreService } from './season-detail-page-store.service';
import { SeasonRatingsStripComponent } from './season-ratings-strip/season-ratings-strip.component';

@Component({
    selector: 'app-season-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        EpisodeListComponent,
        HeroSurfaceComponent,
        ImageComponent,
        PageSectionComponent,
        PhotosPreviewComponent,
        RouterLink,
        SeasonRatingsStripComponent,
        SkeletonComponent,
        TmdbRatingComponent,
        ToggleGroupComponent,
        VideosGridComponent,
    ],
    providers: [SeasonDetailPageStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './season-detail-page.component.html',
    styleUrl: './season-detail-page.component.scss',
})
export class SeasonDetailPageComponent {
    readonly seasonDetail$ = this.store.seasonDetail$;

    constructor(
        private readonly store: SeasonDetailPageStoreService,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly router: Router,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store
            .load$(activatedRoute.paramMap.pipe(map((paramMap) => paramMap.get('seasonNumber'))))
            .pipe(takeUntilDestroyed())
            .subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    changeSeason(seasonNumber: number): void {
        this.store.changeSeason$(seasonNumber).subscribe();
    }

    openPhotoViewer(index: number, images: ViewerImage[]): void {
        this.photoViewerDialogService.open({ images, activeIndex: index });
    }

    openSeasonPhotos(photosLink: RouteCommands | null): void {
        if (photosLink) {
            this.router.navigate(photosLink);
        }
    }
}
