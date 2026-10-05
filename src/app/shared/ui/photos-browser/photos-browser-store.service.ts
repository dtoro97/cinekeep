import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComponentStore } from '@ngrx/component-store';

import type { ConfigurationImages } from '../../../api';
import type { ViewerImage } from '../../models';
import { ConfigStoreService } from '../../services/config-store.service';
import type { SelectOption, SortDirection } from '../../types';
import { isDefined } from '../../utils/is-defined';
import { toPhotoLayoutAspectRatio } from '../../utils/photo-layout';
import { pluralize } from '../../utils/pluralize';
import { sortBy } from '../../utils/sort';

export type PhotoSortField = 'rating' | 'votes' | 'resolution';

interface PhotosBrowserState {
    readonly images: readonly ViewerImage[];
    readonly configurationImages: ConfigurationImages | undefined;
    readonly selectedTypes: readonly string[];
    readonly visibleCount: number;
    readonly sortField: PhotoSortField;
    readonly sortDirection: SortDirection;
}

interface ThumbnailSizeRule {
    readonly configuredSizes: readonly ('poster_sizes' | 'profile_sizes' | 'still_sizes' | 'backdrop_sizes')[];
    readonly preferredSizes: readonly string[];
    readonly fallbackSize: string;
}

const PHOTOS_BATCH = 18;

// The first configured size list wins; backdrops and stills stand in for each other.
const THUMBNAIL_SIZE_RULES: Record<'poster' | 'profile' | 'tagged' | 'backdrop', ThumbnailSizeRule> = {
    poster: { configuredSizes: ['poster_sizes'], preferredSizes: ['w342', 'w300', 'w185'], fallbackSize: 'w342' },
    profile: { configuredSizes: ['profile_sizes'], preferredSizes: ['h632', 'w185', 'w45'], fallbackSize: 'w185' },
    tagged: {
        configuredSizes: ['still_sizes', 'backdrop_sizes'],
        preferredSizes: ['w300', 'w185'],
        fallbackSize: 'w300',
    },
    backdrop: {
        configuredSizes: ['backdrop_sizes', 'still_sizes'],
        preferredSizes: ['w500', 'w300'],
        fallbackSize: 'w500',
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
    selectedTypes: [],
    visibleCount: PHOTOS_BATCH,
    sortField: 'rating',
    sortDirection: 'desc',
};

@Injectable()
export class PhotosBrowserStoreService extends ComponentStore<PhotosBrowserState> {
    readonly photosBrowser$ = this.select(
        ({ images, configurationImages, selectedTypes, visibleCount, sortField, sortDirection }) => {
            const filteredImages = selectedTypes.length
                ? images.filter((image) => selectedTypes.includes(image.photoType ?? ''))
                : images;
            const sortedImages = sortBy(
                filteredImages,
                (image) =>
                    sortField === 'votes'
                        ? (image.vote_count ?? 0)
                        : sortField === 'resolution'
                          ? (image.width ?? 0) * (image.height ?? 0)
                          : (image.vote_average ?? 0),
                sortDirection,
            );
            const visibleImages = sortedImages.slice(0, visibleCount);
            const typeOptions = [...new Set(images.map((image) => image.photoType).filter(isDefined))]
                .sort((left, right) => left.localeCompare(right))
                .map((type) => ({ label: `${type.charAt(0).toUpperCase()}${type.slice(1)}`, value: type }));

            return {
                hasImages: images.length > 0,
                countLabel: sortedImages.length ? pluralize(sortedImages.length, 'photo') : null,
                typeOptions,
                showTypeFilter: typeOptions.length > 0,
                selectedTypes,
                sortField,
                sortDirection,
                visibleImages,
                hasVisibleImages: visibleImages.length > 0,
                tiles: visibleImages.map((image, index) => {
                    const rule =
                        image.photoType === 'poster' || image.photoType === 'profile' || image.photoType === 'tagged'
                            ? THUMBNAIL_SIZE_RULES[image.photoType]
                            : THUMBNAIL_SIZE_RULES.backdrop;
                    const sizes = rule.configuredSizes.map((key) => configurationImages?.[key]).find(isDefined) ?? [];
                    const thumbnailSize =
                        rule.preferredSizes.find((size) => sizes.includes(size)) ??
                        [...sizes].reverse().find((size) => size !== 'original') ??
                        rule.fallbackSize;

                    return {
                        image,
                        index,
                        thumbnailSize,
                        layoutAspectRatio: toPhotoLayoutAspectRatio(image),
                        ariaLabel: `Open photo ${index + 1}`,
                    };
                }),
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

    // A new gallery resets its filter and batch while retaining the preferred sort.
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

    setSelectedTypes(selectedTypes: readonly string[]): void {
        this.patchState({ selectedTypes, visibleCount: PHOTOS_BATCH });
    }

    showMore(): void {
        this.patchState(({ visibleCount }) => ({ visibleCount: visibleCount + PHOTOS_BATCH }));
    }
}
