import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import { SelectOption, SortDirection, VideoCardItem, remoteData, sortBy, toVideoCardItems } from '../../../shared';
import { MediaStoreService } from '../media-store.service';
import { MediaVideoStoreService } from '../media-video-store.service';

export type VideoSortField = 'published_at' | 'name';

interface MediaVideosPageState {
    readonly type: string;
    readonly sortField: VideoSortField;
    readonly sortDirection: SortDirection;
}

const ALL_TYPES = 'all';
const FEATURED_TYPE = 'Trailer';
const FEATURED_SIDE_COUNT = 2;
const GROUP_PREVIEW_COUNT = 8;

// TMDb's video types in the order a title's videos are usually browsed; unknown types follow.
const TYPE_LABELS: Record<string, string> = {
    Trailer: 'Trailers',
    Teaser: 'Teasers',
    Clip: 'Clips',
    Featurette: 'Featurettes',
    'Behind the Scenes': 'Behind the scenes',
    Bloopers: 'Bloopers',
    'Opening Credits': 'Opening credits',
    Recap: 'Recaps',
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

const SORT_OPTIONS: SelectOption<VideoSortField>[] = [
    { label: 'Published date', value: 'published_at' },
    { label: 'Video title', value: 'name' },
];

const INITIAL_STATE: MediaVideosPageState = {
    type: ALL_TYPES,
    sortField: 'published_at',
    sortDirection: 'desc',
};

@Injectable()
export class MediaVideosPageStoreService extends ComponentStore<MediaVideosPageState> {
    readonly mediaVideos$ = this.select(
        this.state$,
        this.mediaStore.mediaDetails$,
        this.mediaVideoStore.videosState$,
        ({ type, sortField, sortDirection }, media, videos) => {
            const videoItems = media
                ? sortBy(
                      toVideoCardItems(remoteData(videos, []), media),
                      (video) => (sortField === 'name' ? video.title : video.publishedAt),
                      sortDirection,
                  )
                : [];
            const typeRank = (videoType: string): number => {
                const index = TYPE_ORDER.indexOf(videoType);
                return index === -1 ? TYPE_ORDER.length : index;
            };
            const itemsByType = new Map<string, VideoCardItem[]>();

            for (const video of videoItems) {
                const videoType = video.typeLabel ?? 'Other';
                itemsByType.set(videoType, [...(itemsByType.get(videoType) ?? []), video]);
            }

            const typeGroups = Array.from(itemsByType, ([groupType, items]) => ({
                groupType,
                items,
                label: TYPE_LABELS[groupType] ?? groupType,
            })).sort(
                (left, right) =>
                    typeRank(left.groupType) - typeRank(right.groupType) ||
                    left.groupType.localeCompare(right.groupType),
            );
            const activeType = itemsByType.has(type) ? type : ALL_TYPES;
            const isAll = activeType === ALL_TYPES;
            const groups = typeGroups
                .filter(({ groupType }) => isAll || groupType === activeType)
                .map(({ groupType, items, label }) => {
                    const isFeatured = groupType === FEATURED_TYPE;
                    const featured = isFeatured ? (items[0] ?? null) : null;
                    const sideItems = isFeatured ? items.slice(1, 1 + FEATURED_SIDE_COUNT) : [];
                    const gridItems = isFeatured ? items.slice(1 + FEATURED_SIDE_COUNT) : items;
                    const isCollapsed = isAll && gridItems.length > GROUP_PREVIEW_COUNT;

                    return {
                        type: groupType,
                        title: label,
                        countLabel: `${items.length}`,
                        featured,
                        hasFeatured: featured !== null,
                        sideItems,
                        hasSideItems: sideItems.length > 0,
                        items: isCollapsed ? gridItems.slice(0, GROUP_PREVIEW_COUNT) : gridItems,
                        hasItems: gridItems.length > 0,
                        showAll: isCollapsed,
                        showAllLabel: `All ${items.length} ${label.toLocaleLowerCase()}`,
                    };
                });

            return {
                media,
                showLoading: videos.state === 'notAsked' || videos.state === 'loading',
                hasVideos: videoItems.length > 0,
                showTypeFilter: typeGroups.length > 1,
                typeOptions: [
                    { label: `All (${videoItems.length})`, value: ALL_TYPES },
                    ...typeGroups.map(({ groupType, items, label }) => ({
                        label: `${label} (${items.length})`,
                        value: groupType,
                    })),
                ] satisfies SelectOption<string>[],
                type: activeType,
                groups,
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

    setType(type: string): void {
        this.patchState({ type });
    }

    setSortField(sortField: VideoSortField): void {
        this.patchState({ sortField });
    }

    toggleSortDirection(): void {
        this.patchState((state) => ({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' }));
    }
}
