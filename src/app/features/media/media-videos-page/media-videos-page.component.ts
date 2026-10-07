import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { filter } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    isDefined,
    PluralizePipe,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    SortButtonComponent,
    SubPageHeaderComponent,
    VideoCardComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { MediaVideosPageStoreService, VideoSortField } from './media-videos-page-store.service';

@Component({
    selector: 'app-media-videos-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        PluralizePipe,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
        SubPageHeaderComponent,
        VideoCardComponent,
    ],
    providers: [MediaVideosPageStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './media-videos-page.component.html',
    styleUrl: './media-videos-page.component.scss',
})
export class MediaVideosPageComponent {
    readonly skeletonCount = 9;
    readonly mediaVideos$ = this.store.mediaVideos$;

    constructor(
        private readonly store: MediaVideosPageStoreService,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Videos')));
    }

    setSortField(sortField: VideoSortField): void {
        this.store.setSortField(sortField);
    }

    toggleSortDirection(): void {
        this.store.toggleSortDirection();
    }
}
