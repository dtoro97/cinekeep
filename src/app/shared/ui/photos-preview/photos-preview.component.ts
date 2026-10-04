import { ChangeDetectionStrategy, Component, computed, EventEmitter, input, Output } from '@angular/core';

import { RemoteData } from '../../types';
import type { ViewerImage } from '../../models';
import { ImageComponent, type ImageType } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

type PhotosPreviewMode = 'media' | 'person';
type PhotosPreviewVariant = 'mosaic' | 'compact';

interface PhotosPreviewEntry {
    image: ViewerImage;
    clickIndex: number;
}

interface PhotosPreviewTile extends PhotosPreviewEntry {
    imageType: ImageType;
    imageParams: string;
    layoutAspectRatio: number;
    moreCount: number | null;
    ariaLabel: string;
}

const MAX_MEDIA_PREVIEW_PHOTOS = 9;
const MAX_PERSON_PREVIEW_PHOTOS = 7;
const MAX_COMPACT_PREVIEW_PHOTOS = 4;
const PERSON_PROFILE_COUNT = 3;
const SKELETON_TILE_COUNT = 9;
const COMPACT_SKELETON_TILE_COUNT = 4;
// Summed tile aspect ratios that fit two mosaic rows; row height scales with the
// viewport, so a row holds roughly 6.3 units on any desktop width.
const MOSAIC_ASPECT_BUDGET = 11;

@Component({
    selector: 'app-photos-preview',
    imports: [ImageComponent, SkeletonComponent],
    templateUrl: './photos-preview.component.html',
    styleUrl: './photos-preview.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosPreviewComponent {
    readonly state = input<RemoteData<ViewerImage[]>>({ state: 'notAsked' });
    readonly totalCount = input(0);
    readonly maxVisible = input<number | null>(null);
    readonly mode = input<PhotosPreviewMode>('media');
    readonly variant = input<PhotosPreviewVariant>('mosaic');
    readonly showMoreTile = input(true);
    @Output() photoClick = new EventEmitter<number>();
    @Output() moreClick = new EventEmitter<void>();

    readonly skeletonTiles = computed(() => toRange(getSkeletonCount(this.variant())));
    readonly tiles = computed(() =>
        toPreviewTiles(
            this.state(),
            this.totalCount(),
            this.maxVisible(),
            this.mode(),
            this.variant(),
            this.showMoreTile(),
        ),
    );
}

function toPreviewTiles(
    state: RemoteData<ViewerImage[]>,
    totalCount: number,
    maxVisible: number | null,
    mode: PhotosPreviewMode,
    variant: PhotosPreviewVariant,
    showMoreTile: boolean,
): PhotosPreviewTile[] {
    if (state.state !== 'success' || !state.data.length) {
        return [];
    }

    const visibleCount = getVisibleCount(maxVisible, mode, variant);
    const entries = selectEntries(state.data, visibleCount, mode);
    const selectedEntries = variant === 'mosaic' ? fitAspectBudget(entries, MOSAIC_ASPECT_BUDGET) : entries;
    const sourceCount = totalCount || state.data.length;
    const moreCount = showMoreTile && sourceCount > selectedEntries.length ? sourceCount - selectedEntries.length + 1 : null;

    return selectedEntries.map((entry, index) =>
        toPreviewTile(entry, index === selectedEntries.length - 1 ? moreCount : null),
    );
}

function getVisibleCount(
    maxVisible: number | null,
    mode: PhotosPreviewMode,
    variant: PhotosPreviewVariant,
): number {
    const defaultCount = getDefaultVisibleCount(mode, variant);
    const resolvedMaxVisible = maxVisible ?? defaultCount;

    return Math.min(Math.max(resolvedMaxVisible, 0), MAX_MEDIA_PREVIEW_PHOTOS);
}

function getDefaultVisibleCount(
    mode: PhotosPreviewMode,
    variant: PhotosPreviewVariant,
): number {
    if (variant === 'compact') {
        return MAX_COMPACT_PREVIEW_PHOTOS;
    }

    return mode === 'person' ? MAX_PERSON_PREVIEW_PHOTOS : MAX_MEDIA_PREVIEW_PHOTOS;
}

function getSkeletonCount(variant: PhotosPreviewVariant): number {
    return variant === 'compact' ? COMPACT_SKELETON_TILE_COUNT : SKELETON_TILE_COUNT;
}

function selectEntries(
    images: readonly ViewerImage[],
    visibleCount: number,
    mode: PhotosPreviewMode,
): PhotosPreviewEntry[] {
    const entries = images.map((image, clickIndex) => ({ image, clickIndex }));

    if (mode === 'person') {
        return selectPersonEntries(entries, visibleCount);
    }

    return selectMediaEntries(entries, visibleCount);
}

function selectMediaEntries(
    entries: readonly PhotosPreviewEntry[],
    visibleCount: number,
): PhotosPreviewEntry[] {
    const groups = [...groupByPhotoType(entries).values()];

    return mixEntries(groups, visibleCount);
}

function selectPersonEntries(
    entries: readonly PhotosPreviewEntry[],
    visibleCount: number,
): PhotosPreviewEntry[] {
    const profiles = entries.filter((entry) => entry.image.photoType === 'profile').slice(0, PERSON_PROFILE_COUNT);
    const tagged = entries.filter((entry) => entry.image.photoType === 'tagged');
    const mixed = mixEntries([profiles, tagged], visibleCount);

    return mixed.length ? mixed : entries.slice(0, visibleCount);
}

function fitAspectBudget(entries: readonly PhotosPreviewEntry[], budget: number): PhotosPreviewEntry[] {
    const fitted: PhotosPreviewEntry[] = [];
    let used = 0;

    for (const entry of entries) {
        const aspectRatio = getLayoutAspectRatio(entry.image);

        if (fitted.length && used + aspectRatio > budget) {
            break;
        }

        fitted.push(entry);
        used += aspectRatio;
    }

    return fitted;
}

function groupByPhotoType(entries: readonly PhotosPreviewEntry[]): Map<string, PhotosPreviewEntry[]> {
    const groups = new Map<string, PhotosPreviewEntry[]>();

    for (const entry of entries) {
        const key = entry.image.photoType ?? 'photo';
        groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    return groups;
}

function mixEntries(groups: readonly PhotosPreviewEntry[][], count: number): PhotosPreviewEntry[] {
    const selected: PhotosPreviewEntry[] = [];
    const queues = groups.map((group) => [...group]).filter((group) => group.length);

    while (selected.length < count && queues.length) {
        const queue = queues.shift()!;
        const next = queue.shift()!;

        selected.push(next);

        if (queue.length) {
            queues.push(queue);
        }
    }

    return selected;
}

function toPreviewTile(entry: PhotosPreviewEntry, moreCount: number | null): PhotosPreviewTile {
    const imageType: ImageType = entry.image.photoType === 'profile' ? 'person' : 'media';

    return {
        ...entry,
        imageType,
        imageParams: entry.image.aspect_ratio && entry.image.aspect_ratio > 1.9 ? 'w780' : 'w500',
        layoutAspectRatio: getLayoutAspectRatio(entry.image),
        moreCount,
        ariaLabel: moreCount ? `Browse all photos, ${moreCount} more` : `Open photo ${entry.clickIndex + 1}`,
    };
}

function getLayoutAspectRatio(image: ViewerImage): number {
    if (image.photoType === 'profile' || image.photoType === 'poster') {
        return 0.75;
    }

    if (!image.aspect_ratio) {
        return 1.5;
    }

    return Math.min(Math.max(image.aspect_ratio, 0.75), 2.35);
}

function toRange(count: number): readonly number[] {
    return Array.from({ length: count }, (_, index) => index);
}
