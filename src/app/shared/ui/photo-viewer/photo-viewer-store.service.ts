import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import type { ViewerImage } from '../../models';
import type { RouteCommands } from '../../types';
import type { PhotoViewerData } from './photo-viewer.component';

interface PhotoViewerState {
    readonly images: readonly ViewerImage[];
    readonly index: number;
    readonly title: string | null;
    readonly photosLink: RouteCommands | null;
}

/** How many thumbnails the filmstrip shows around the open photo. */
const FILMSTRIP_SIZE = 7;

const PHOTO_TYPE_LABELS: Record<string, string> = {
    backdrop: 'Backdrops',
    still: 'Stills',
    poster: 'Posters',
    logo: 'Logos',
    profile: 'Profiles',
    tagged: 'Tagged photos',
};

@Injectable()
export class PhotoViewerStoreService extends ComponentStore<PhotoViewerState> {
    readonly photoViewer$ = this.select(({ images, index, title, photosLink }) => {
        const image = images[index];
        const start = Math.max(0, Math.min(index - Math.floor(FILMSTRIP_SIZE / 2), images.length - FILMSTRIP_SIZE));
        const filmstrip = images.slice(start, start + FILMSTRIP_SIZE);
        const hiddenCount = images.length - filmstrip.length;

        return {
            image,
            imageSource: image?.file_path ?? '',
            title,
            typeLabel: image?.photoType ? (PHOTO_TYPE_LABELS[image.photoType] ?? null) : null,
            counter: images.length ? `${index + 1} of ${images.length}` : '',
            canPrevious: index > 0,
            canNext: index < images.length - 1,
            sizeLabel: image?.width && image.height ? `${image.width} × ${image.height}` : null,
            showFilmstrip: images.length > 1,
            filmstrip: filmstrip.map((item, offset) => ({
                key: `${item.file_path}-${start + offset}`,
                index: start + offset,
                source: item.file_path ?? '',
                isCurrent: start + offset === index,
                label: `Show photo ${start + offset + 1}`,
            })),
            showMoreLink: !!photosLink && hiddenCount > 0,
            moreLabel: `+${hiddenCount} more`,
        };
    });

    constructor() {
        super({ images: [], index: 0, title: null, photosLink: null });
    }

    initialize(data: PhotoViewerData): void {
        const index = Number.isFinite(data.activeIndex) ? Math.trunc(data.activeIndex) : 0;

        this.setState({
            images: data.images,
            index: Math.min(Math.max(index, 0), Math.max(data.images.length - 1, 0)),
            title: data.title ?? null,
            photosLink: data.photosLink ?? null,
        });
    }

    previous(): void {
        this.patchState(({ index }) => ({ index: Math.max(index - 1, 0) }));
    }

    next(): void {
        this.patchState(({ images, index }) => ({ index: Math.min(index + 1, Math.max(images.length - 1, 0)) }));
    }

    show(index: number): void {
        this.patchState(({ images }) => ({ index: Math.min(Math.max(index, 0), Math.max(images.length - 1, 0)) }));
    }
}
