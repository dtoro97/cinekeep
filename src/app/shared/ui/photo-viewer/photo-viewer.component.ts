import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import type { ViewerImage } from '../../models';
import { ImagePipe } from '../../pipes/image.pipe';
import type { RouteCommands } from '../../types';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { PhotoViewerStoreService } from './photo-viewer-store.service';

export interface PhotoViewerData {
    readonly images: readonly ViewerImage[];
    readonly activeIndex: number;
    /** The title the photos belong to, shown above the photo. */
    readonly title?: string | null;
    readonly photosLink?: RouteCommands | null;
}

@Component({
    selector: 'app-photo-viewer',
    imports: [AsyncPipe, IconButtonComponent, ImagePipe, MatIconModule],
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

    show(index: number): void {
        this.photoViewerStoreService.show(index);
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
