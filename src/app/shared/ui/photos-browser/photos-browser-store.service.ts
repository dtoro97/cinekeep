import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';

import type { ConfigurationImages } from '../../../api';
import type { ViewerImage } from '../../models';
import { ConfigStoreService } from '../../services/config-store.service';
import type { SelectOption, SortDirection } from '../../types';
import { isDefined } from '../../utils/is-defined';
import { sortBy } from '../../utils/sort';

export type PhotoSortField = 'rating' | 'votes' | 'resolution';

interface PhotosBrowserState {
    readonly images: readonly ViewerImage[];
    readonly configurationImages: ConfigurationImages | undefined;
    readonly selectedType: string | null;
    readonly visibleCount: number;
    readonly sortField: PhotoSortField;
    readonly sortDirection: SortDirection;
}

interface ThumbnailSizeRule {
    readonly configuredSizes: readonly (
        'poster_sizes' | 'profile_sizes' | 'still_sizes' | 'backdrop_sizes' | 'logo_sizes'
    )[];
    readonly preferredSizes: readonly string[];
    readonly fallbackSize: string;
}

/** How a type's photos sit in the grid: wide frames, tall frames, or logos fitted on a plain tile. */
type PhotoGridShape = 'landscape' | 'portrait' | 'logo';

const PHOTOS_BATCH = 24;

// The order a title's photo types are offered in; types not listed follow alphabetically.
const PHOTO_TYPE_ORDER = ['backdrop', 'still', 'poster', 'logo', 'profile', 'tagged'];

const PHOTO_TYPE_LABELS: Record<string, string> = {
    backdrop: 'Backdrops',
    still: 'Stills',
    poster: 'Posters',
    logo: 'Logos',
    profile: 'Profiles',
    tagged: 'Tagged',
};

const PHOTO_GRID_SHAPES: Record<string, PhotoGridShape> = {
    poster: 'portrait',
    profile: 'portrait',
    logo: 'logo',
};

// The first configured size list wins; backdrops and stills stand in for each other.
const THUMBNAIL_SIZE_RULES: Record<'poster' | 'profile' | 'logo' | 'backdrop', ThumbnailSizeRule> = {
    poster: { configuredSizes: ['poster_sizes'], preferredSizes: ['w342', 'w300', 'w185'], fallbackSize: 'w342' },
    profile: { configuredSizes: ['profile_sizes'], preferredSizes: ['h632', 'w185', 'w45'], fallbackSize: 'w185' },
    logo: { configuredSizes: ['logo_sizes'], preferredSizes: ['w300', 'w185'], fallbackSize: 'w300' },
    backdrop: {
        configuredSizes: ['backdrop_sizes', 'still_sizes'],
        preferredSizes: ['w780', 'w500', 'w300'],
        fallbackSize: 'w780',
    },
};

export const PHOTO_SORT_OPTIONS: readonly SelectOption<PhotoSortField>[] = [
    { label: 'Rating', value: 'rating' },
    { label: 'Votes', value: 'votes' },
    { label: 'Resolution', value: 'resolution' },
];

const INITIAL_STATE: PhotosBrowserState = {
    images: [],
    configurationImages: undefined,
    selectedType: null,
    visibleCount: PHOTOS_BATCH,
    sortField: 'rating',
    sortDirection: 'desc',
};

@Injectable()
export class PhotosBrowserStoreService extends ComponentStore<PhotosBrowserState> {
    readonly photosBrowser$ = this.select(
        ({ images, configurationImages, selectedType, visibleCount, sortField, sortDirection }) => {
            const typeRank = (type: string): number => {
                const index = PHOTO_TYPE_ORDER.indexOf(type);
                return index === -1 ? PHOTO_TYPE_ORDER.length : index;
            };
            const types = [...new Set(images.map((image) => image.photoType ?? 'photo'))].sort(
                (left, right) => typeRank(left) - typeRank(right) || left.localeCompare(right),
            );
            const activeType = selectedType && types.includes(selectedType) ? selectedType : (types[0] ?? null);
            const typeImages = images.filter((image) => (image.photoType ?? 'photo') === activeType);
            const sortedImages = sortBy(
                typeImages,
                (image) =>
                    sortField === 'votes'
                        ? (image.vote_count ?? 0)
                        : sortField === 'resolution'
                          ? (image.width ?? 0) * (image.height ?? 0)
                          : (image.vote_average ?? 0),
                sortDirection,
            );
            const visibleImages = sortedImages.slice(0, visibleCount);
            const typeLabel = (type: string): string =>
                PHOTO_TYPE_LABELS[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
            const rule =
                THUMBNAIL_SIZE_RULES[
                    activeType === 'poster' || activeType === 'profile' || activeType === 'logo'
                        ? activeType
                        : 'backdrop'
                ];
            const sizes = rule.configuredSizes.map((key) => configurationImages?.[key]).find(isDefined) ?? [];
            const thumbnailSize =
                rule.preferredSizes.find((size) => sizes.includes(size)) ??
                [...sizes].reverse().find((size) => size !== 'original') ??
                rule.fallbackSize;
            const gridShape = (activeType && PHOTO_GRID_SHAPES[activeType]) ?? 'landscape';
            const noun = activeType ? typeLabel(activeType).toLocaleLowerCase() : 'photos';

            return {
                hasImages: images.length > 0,
                typeOptions: types.map((type) => ({
                    label: `${typeLabel(type)} (${images.filter((image) => (image.photoType ?? 'photo') === type).length})`,
                    value: type,
                })),
                showTypeFilter: types.length > 1,
                selectedType: activeType,
                isPortraitGrid: gridShape === 'portrait',
                isLogoGrid: gridShape === 'logo',
                sortField,
                sortDirection,
                visibleImages,
                hasVisibleImages: visibleImages.length > 0,
                tiles: visibleImages.map((image, index) => ({
                    image,
                    index,
                    thumbnailSize,
                    ariaLabel: `Open photo ${index + 1} of ${sortedImages.length}`,
                })),
                shownLabel: `Showing ${visibleImages.length} of ${sortedImages.length} ${noun}`,
                moreLabel: `Show more ${noun}`,
                hasMore: sortedImages.length > visibleImages.length,
            };
        },
    );

    constructor(configStoreService: ConfigStoreService) {
        super(INITIAL_STATE);
        configStoreService.configuration$
            .pipe(takeUntilDestroyed())
            .subscribe(({ images: configurationImages }) => this.patchState({ configurationImages }));
    }

    // A new gallery resets its type and batch while retaining the preferred sort.
    setImages(images: readonly ViewerImage[]): void {
        const { configurationImages, sortField, sortDirection } = this.get();
        this.setState({ ...INITIAL_STATE, images, configurationImages, sortField, sortDirection });
    }

    setSortField(sortField: PhotoSortField): void {
        this.patchState({ sortField });
    }

    toggleSortDirection(): void {
        this.patchState(({ sortDirection }) => ({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' }));
    }

    setSelectedType(selectedType: string): void {
        this.patchState({ selectedType, visibleCount: PHOTOS_BATCH });
    }

    showMore(): void {
        this.patchState(({ visibleCount }) => ({ visibleCount: visibleCount + PHOTOS_BATCH }));
    }
}
