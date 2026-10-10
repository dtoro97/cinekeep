import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { filter } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    isDefined,
    PageSectionComponent,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    SortButtonComponent,
    ToggleGroupComponent,
    VideoCardComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { MediaSubPageHeaderComponent } from '../media-sub-page-header/media-sub-page-header.component';
import { MediaVideosPageStoreService, VideoSortField } from './media-videos-page-store.service';

@Component({
    selector: 'app-media-videos-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        MatButtonModule,
        MediaSubPageHeaderComponent,
        PageSectionComponent,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
        ToggleGroupComponent,
        VideoCardComponent,
    ],
    providers: [MediaVideosPageStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './media-videos-page.component.html',
    styleUrl: './media-videos-page.component.scss',
})
export class MediaVideosPageComponent {
    readonly skeletonCount = 8;
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

    setType(type: string): void {
        this.store.setType(type);
    }

    setSortField(sortField: VideoSortField): void {
        this.store.setSortField(sortField);
    }

    toggleSortDirection(): void {
        this.store.toggleSortDirection();
    }
}
