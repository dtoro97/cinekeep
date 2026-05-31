import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BehaviorSubject, combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    SortButtonComponent,
    SubPageHeaderComponent,
    VideoCardComponent,
    MediaType,
    SortDirection,
    VideoCardItem,
    compareValues,
} from '../../../shared';
import { MediaVideoStoreService } from '../media-video-store.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MediaStoreService } from '../media-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

type SortField = 'published_at' | 'name';

@Component({
    selector: 'app-videos-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
        SubPageHeaderComponent,
        VideoCardComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './videos-page.component.html',
    styleUrl: './videos-page.component.scss',
})
export class VideosPageComponent {
    readonly skeletonCount = 9;

    readonly sortOptions = [
        { label: 'Published date', value: 'published_at' as const },
        { label: 'Video title', value: 'name' as const },
    ];

    readonly sortFieldSubject = new BehaviorSubject<SortField>('published_at');
    readonly sortDirectionSubject = new BehaviorSubject<SortDirection>('desc');

    readonly sortField$ = this.sortFieldSubject.asObservable();
    readonly sortDirection$ = this.sortDirectionSubject.asObservable();

    readonly videos$ = combineLatest([
        this.mediaVideoStoreService.videoItems$,
        this.sortField$,
        this.sortDirection$,
    ]).pipe(
        map(([videoItems, field, direction]) => {
            const sorted = [...videoItems].sort((a, b) => {
                const valueComparison = compareValues(
                    this.getVideoSortValue(a, field),
                    this.getVideoSortValue(b, field),
                );

                return direction === 'desc' ? valueComparison * -1 : valueComparison;
            });
            return sorted;
        }),
    );

    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        videosState: this.mediaVideoStoreService.videosState$,
        videoItems: this.videos$,
        sortField: this.sortField$,
        sortDirection: this.sortDirection$,
    }).pipe(
        map(({ mediaState, videosState, videoItems, sortField, sortDirection }) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;

            return {
                media,
                videosState,
                videoItems,
                sortField,
                sortDirection,
                isLoading: videosState.state === 'loading',
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        public mediaVideoStoreService: MediaVideoStoreService,
        private readonly seo: SeoService,
        private route: ActivatedRoute,
    ) {
        this.route.parent!.paramMap
            .pipe(
                map((params) => ({
                    id: Number(params.get('id')),
                    type: (params.get('type') ?? 'movie') as MediaType,
                })),
                filter(({ id }) => Number.isInteger(id)),
                switchMap((target) => this.mediaVideoStoreService.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaStore.mediaDetailsState$
            .pipe(
                takeUntilDestroyed(),
                map((state) => (state.state === 'success' ? state.data : null)),
                filter((media): media is MediaDetails => !!media),
                tap((media) =>
                    this.seo.setPage(toMediaSectionSeoMetadata(media, 'Videos')),
                ),
            )
            .subscribe();
    }

    setSortField(value: unknown): void {
        this.sortFieldSubject.next(value as SortField);
    }

    toggleSortDirection(): void {
        this.sortDirectionSubject.next(
            this.sortDirectionSubject.value === 'asc' ? 'desc' : 'asc',
        );
    }

    private getVideoSortValue(
        video: VideoCardItem,
        field: SortField,
    ): string | undefined {
        switch (field) {
            case 'published_at':
                return video.publishedAt;
            case 'name':
                return video.title;
        }
    }

}
