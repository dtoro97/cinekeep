import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import type { ViewerImage } from '../../models';
import type { RemoteData } from '../../types';
import { interleave } from '../../utils/interleave';
import { toPhotoLayoutAspectRatio } from '../../utils/photo-layout';
import type { ImageType } from '../image/image.component';

export type PhotosPreviewMode = 'media' | 'person';
export type PhotosPreviewVariant = 'mosaic' | 'compact';

export interface PhotosPreviewOptions {
    readonly state: RemoteData<ViewerImage[]>;
    readonly totalCount: number;
    readonly mode: PhotosPreviewMode;
    readonly variant: PhotosPreviewVariant;
}

const MEDIA_PREVIEW_COUNT = 9;
const PERSON_PREVIEW_COUNT = 7;
const COMPACT_PREVIEW_COUNT = 4;
const PERSON_PROFILE_COUNT = 3;
const MAX_MORE_COUNT = 99;
// Summed tile aspect ratios that fit two mosaic rows; row height scales with the
// viewport, so a row holds roughly 6.3 units on any desktop width.
const MOSAIC_ASPECT_BUDGET = 11;

@Injectable()
export class PhotosPreviewStoreService extends ComponentStore<PhotosPreviewOptions> {
    readonly photosPreview$ = this.select(({ state, totalCount, mode, variant }) => {
        const images = state.state === 'success' ? state.data : [];
        const visibleCount =
            variant === 'compact'
                ? COMPACT_PREVIEW_COUNT
                : mode === 'person'
                  ? PERSON_PREVIEW_COUNT
                  : MEDIA_PREVIEW_COUNT;
        const entries = images.map((image, clickIndex) => ({ image, clickIndex }));
        const typeOf = (entry: (typeof entries)[number]) => entry.image.photoType ?? 'photo';
        // Photo types take turns, so one type can't fill the preview; a person shows a few profiles among tagged photos.
        const groups =
            mode === 'person'
                ? [
                      entries.filter((entry) => typeOf(entry) === 'profile').slice(0, PERSON_PROFILE_COUNT),
                      entries.filter((entry) => typeOf(entry) === 'tagged'),
                  ]
                : [...new Set(entries.map(typeOf))].map((type) => entries.filter((entry) => typeOf(entry) === type));
        const mixed = interleave(groups).slice(0, visibleCount);
        const candidates = mixed.length ? mixed : entries.slice(0, visibleCount);
        const selected: typeof entries = [];
        let usedAspect = 0;

        for (const entry of candidates) {
            const aspectRatio = toPhotoLayoutAspectRatio(entry.image, true);

            if (variant === 'mosaic' && selected.length && usedAspect + aspectRatio > MOSAIC_ASPECT_BUDGET) {
                break;
            }

            selected.push(entry);
            usedAspect += aspectRatio;
        }

        const sourceCount = totalCount || images.length;
        const moreCount = sourceCount > selected.length ? sourceCount - selected.length + 1 : null;

        const tiles = selected.map(({ image, clickIndex }, index) => {
            const tileMoreCount = index === selected.length - 1 ? moreCount : null;

            const imageType: ImageType = image.photoType === 'profile' ? 'person' : 'media';

            return {
                image,
                clickIndex,
                imageType,
                imageParams: image.aspect_ratio && image.aspect_ratio > 1.9 ? 'w780' : 'w500',
                layoutAspectRatio: toPhotoLayoutAspectRatio(image, true),
                hasMore: !!tileMoreCount,
                moreLabel: tileMoreCount ? `+${Math.min(tileMoreCount, MAX_MORE_COUNT)}` : null,
                ariaLabel: tileMoreCount ? `Browse all photos, ${tileMoreCount} more` : `Open photo ${clickIndex + 1}`,
            };
        });
        return {
            tiles,
            hasTiles: tiles.length > 0,
            showSkeleton: state.state === 'loading',
            isCompact: variant === 'compact',
            skeletonCount: variant === 'compact' ? COMPACT_PREVIEW_COUNT : MEDIA_PREVIEW_COUNT,
        };
    });

    constructor() {
        super({ state: { state: 'notAsked' }, totalCount: 0, mode: 'media', variant: 'mosaic' });
    }

    setOptions(options: PhotosPreviewOptions): void {
        this.setState(options);
    }
}
