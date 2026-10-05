import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import type { ViewerImage } from '../../models';
import { ImagePipe } from '../../pipes/image.pipe';
import { VoteCountPipe } from '../../pipes/vote-count.pipe';
import type { RouteCommands } from '../../types';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { RatingComponent } from '../rating/rating.component';
import { PhotoViewerStoreService } from './photo-viewer-store.service';

export interface PhotoViewerData {
    readonly images: readonly ViewerImage[];
    readonly activeIndex: number;
    readonly photosLink?: RouteCommands;
}

export const PHOTO_VIEWER_DIALOG_CONFIG: MatDialogConfig = {
    panelClass: 'photo-viewer-panel',
    maxWidth: '100vw',
    maxHeight: '100vh',
    width: '100vw',
    height: '100vh',
    autoFocus: false,
};

@Component({
    selector: 'app-photo-viewer',
    imports: [AsyncPipe, IconButtonComponent, ImagePipe, MatIconModule, RatingComponent, VoteCountPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [PhotoViewerStoreService],
    templateUrl: './photo-viewer.component.html',
    styleUrl: './photo-viewer.component.scss',
})
export class PhotoViewerComponent {
    readonly photoViewer$ = this.photoViewerStoreService.photoViewer$;

    constructor(
        @Inject(MAT_DIALOG_DATA) private readonly data: PhotoViewerData,
        private readonly photoViewerStoreService: PhotoViewerStoreService,
        private readonly matDialogRef: MatDialogRef<PhotoViewerComponent>,
        private readonly router: Router,
    ) {
        this.photoViewerStoreService.initialize(data);

        if (data.images.length === 0) {
            this.matDialogRef.close();
        }
    }

    previous(): void {
        this.photoViewerStoreService.previous();
    }

    next(): void {
        this.photoViewerStoreService.next();
    }

    close(): void {
        this.matDialogRef.close();
    }

    openPhotosPage(): void {
        if (!this.data.photosLink) {
            return;
        }

        this.matDialogRef.close();
        this.router.navigate(this.data.photosLink);
    }

    @HostListener('document:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.previous();
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.next();
        }
    }
}
