import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';

import { PhotoViewerComponent, PhotoViewerData } from './photo-viewer.component';

const PHOTO_VIEWER_DIALOG_CONFIG: MatDialogConfig = {
    panelClass: 'photo-viewer-panel',
    maxWidth: '100vw',
    maxHeight: '100vh',
    width: '100vw',
    height: '100vh',
    autoFocus: false,
};

@Injectable({ providedIn: 'root' })
export class PhotoViewerDialogService {
    constructor(private readonly matDialog: MatDialog) {}

    /** Opens the fullscreen photo viewer at `activeIndex`. */
    open(data: PhotoViewerData): void {
        this.matDialog.open(PhotoViewerComponent, { ...PHOTO_VIEWER_DIALOG_CONFIG, data });
    }
}
