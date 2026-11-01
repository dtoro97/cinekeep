import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { map } from 'rxjs';

import {
    CatalogueBackdropComponent,
    ImageComponent,
    PhotoViewerDialogService,
    RepeatPipe,
    SeoService,
    SigninDialogService,
    SkeletonComponent,
    TmdbRatingComponent,
    ViewerImage,
    YourLibraryComponent,
} from '../../../shared';
import { WhereToWatchComponent } from '../where-to-watch/where-to-watch.component';
import { EpisodeListComponent } from './episode-list/episode-list.component';
import { SeasonDetailPageStoreService } from './season-detail-page-store.service';

@Component({
    selector: 'app-season-detail-page',
    imports: [
        AsyncPipe,
        CatalogueBackdropComponent,
        DatePipe,
        EpisodeListComponent,
        ImageComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        WhereToWatchComponent,
        YourLibraryComponent,
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
        private readonly destroyRef: DestroyRef,
        private readonly photoViewerDialogService: PhotoViewerDialogService,
        private readonly signinDialogService: SigninDialogService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store
            .load$(activatedRoute.paramMap.pipe(map((paramMap) => paramMap.get('seasonNumber'))))
            .pipe(takeUntilDestroyed())
            .subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    openPhotoViewer(index: number, images: ViewerImage[]): void {
        this.photoViewerDialogService.open({ images, activeIndex: index });
    }

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
