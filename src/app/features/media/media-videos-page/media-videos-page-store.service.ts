import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import { SelectOption, SortDirection, remoteData, sortBy, toVideoCardItems } from '../../../shared';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';

export type VideoSortField = 'published_at' | 'name';

interface MediaVideosPageState {
    readonly sortField: VideoSortField;
    readonly sortDirection: SortDirection;
}

const SORT_OPTIONS: SelectOption<VideoSortField>[] = [
    { label: 'Published date', value: 'published_at' },
    { label: 'Video title', value: 'name' },
];

const INITIAL_STATE: MediaVideosPageState = {
    sortField: 'published_at',
    sortDirection: 'desc',
};

@Injectable()
export class MediaVideosPageStoreService extends ComponentStore<MediaVideosPageState> {
    readonly mediaVideos$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        this.mediaVideoStore.videosState$,
        ({ sortField, sortDirection }, media, videos) => {
            const videoItems = media
                ? sortBy(
                      toVideoCardItems(remoteData(videos, []), media),
                      (video) => (sortField === 'name' ? video.title : video.publishedAt),
                      sortDirection,
                  )
                : [];

            return {
                media,
                showLoading: videos.state === 'notAsked' || videos.state === 'loading',
                hasVideos: videoItems.length > 0,
                videoItems,
                videoCount: videoItems.length,
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
}
