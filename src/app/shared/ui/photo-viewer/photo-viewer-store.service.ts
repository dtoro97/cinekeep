import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import type { ViewerImage } from '../../models';
import type { RouteCommands } from '../../types';
import type { PhotoViewerData } from './photo-viewer.component';

interface PhotoViewerState {
    readonly images: readonly ViewerImage[];
    readonly index: number;
    readonly photosLink: RouteCommands | null;
}

@Injectable()
export class PhotoViewerStoreService extends ComponentStore<PhotoViewerState> {
    readonly photoViewer$ = this.select(({ images, index, photosLink }) => {
        const image = images[index];

        return {
            image,
            imageSource: image?.file_path ?? '',
            counter: images.length ? `${index + 1} / ${images.length}` : '',
            canPrevious: index > 0,
            canNext: index < images.length - 1,
            showDimensions: !!image?.width && !!image.height,
            showPhotosLink: !!photosLink,
        };
    });

    constructor() {
        super({ images: [], index: 0, photosLink: null });
    }

    initialize(data: PhotoViewerData): void {
        const index = Number.isFinite(data.activeIndex) ? Math.trunc(data.activeIndex) : 0;

        this.setState({
            images: data.images,
            index: Math.min(Math.max(index, 0), Math.max(data.images.length - 1, 0)),
            photosLink: data.photosLink ?? null,
        });
    }

    previous(): void {
        this.patchState(({ index }) => ({ index: Math.max(index - 1, 0) }));
    }

    next(): void {
        this.patchState(({ images, index }) => ({ index: Math.min(index + 1, Math.max(images.length - 1, 0)) }));
    }
}
