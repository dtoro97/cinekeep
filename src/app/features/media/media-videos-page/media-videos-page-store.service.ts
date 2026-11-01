import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import {
    SelectOption,
    SortDirection,
    isDefined,
    pickBestYoutubeTrailer,
    remoteData,
    sortBy,
    toVideoCardItems,
} from '../../../shared';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';

export type VideoSortField = 'published_at' | 'name';

interface MediaVideosPageState {
    readonly sortField: VideoSortField;
    readonly sortDirection: SortDirection;
    // A TMDb video type such as "Trailer"; `null` shows every type.
    readonly type: string | null;
    readonly visibleCount: number;
}

const SORT_OPTIONS: SelectOption<VideoSortField>[] = [
    { label: 'Published date', value: 'published_at' },
    { label: 'Video title', value: 'name' },
];

// Three rows of the four-up grid.
const VIDEO_BATCH = 12;

const INITIAL_STATE: MediaVideosPageState = {
    sortField: 'published_at',
    sortDirection: 'desc',
    type: null,
    visibleCount: VIDEO_BATCH,
};

@Injectable()
export class MediaVideosPageStoreService extends ComponentStore<MediaVideosPageState> {
    readonly mediaVideos$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        this.mediaVideoStore.videosState$,
        ({ sortField, sortDirection, type, visibleCount }, media, videos) => {
            const videoList = remoteData(videos, []);
            const allItems = media ? toVideoCardItems(videoList, media) : [];
            const featuredId = type === null ? (pickBestYoutubeTrailer(videoList)?.id ?? null) : null;
            const featured = allItems.find((item) => item.id === featuredId) ?? null;
            const filteredItems = sortBy(
                allItems.filter((item) => (type === null || item.typeLabel === type) && item.id !== featured?.id),
                (video) => (sortField === 'name' ? video.title : video.publishedAt),
                sortDirection,
            );
            const types = [...new Set(allItems.map((item) => item.typeLabel).filter(isDefined))];
            const shownCount = Math.min(visibleCount, filteredItems.length) + (featured ? 1 : 0);
            const totalCount = filteredItems.length + (featured ? 1 : 0);

            return {
                media,
                showLoading: videos.state === 'notAsked' || videos.state === 'loading',
                hasVideos: allItems.length > 0,
                videoCount: allItems.length,
                // The plural reads as the chip's label: "Trailers", "Behind the Scenes".
                typeChips: [
                    { value: null, label: 'All', isActive: type === null },
                    ...types.map((value) => ({
                        value,
                        label: /s$/i.test(value) ? value : `${value}s`,
                        isActive: type === value,
                    })),
                ],
                showTypeChips: types.length > 1,
                featured,
                videoItems: filteredItems.slice(0, visibleCount),
                hasMore: filteredItems.length > visibleCount,
                shownLabel: `Showing ${shownCount} of ${totalCount}`,
                sortOptions: SORT_OPTIONS,
                sortField,
                sortDirection,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaVideoStore: MediaVideoStoreService,
    ) {
        super(INITIAL_STATE);
    }

    load$(): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(switchMap((target) => this.mediaVideoStore.load$(target)));
    }

    setSortField(sortField: VideoSortField): void {
        this.patchState({ sortField });
    }

    toggleSortDirection(): void {
        this.patchState((state) => ({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' }));
    }

    setType(type: string | null): void {
        this.patchState({ type, visibleCount: VIDEO_BATCH });
    }

    showMore(): void {
        this.patchState((state) => ({ visibleCount: state.visibleCount + VIDEO_BATCH }));
    }
}
