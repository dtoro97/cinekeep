import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import type { ViewerImage } from '../../models';
import { RepeatPipe } from '../../pipes/repeat.pipe';
import type { RemoteData } from '../../types';
import { ImageComponent } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { PhotosPreviewMode, PhotosPreviewStoreService, PhotosPreviewVariant } from './photos-preview-store.service';

@Component({
    selector: 'app-photos-preview',
    imports: [AsyncPipe, ImageComponent, RepeatPipe, SkeletonComponent],
    templateUrl: './photos-preview.component.html',
    styleUrl: './photos-preview.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [PhotosPreviewStoreService],
})
export class PhotosPreviewComponent implements OnChanges {
    @Input() state: RemoteData<ViewerImage[]> = { state: 'notAsked' };
    @Input() totalCount = 0;
    @Input() mode: PhotosPreviewMode = 'media';
    @Input() variant: PhotosPreviewVariant = 'mosaic';
    @Output() readonly photoClick = new EventEmitter<number>();
    @Output() readonly moreClick = new EventEmitter<void>();

    readonly photosPreview$ = this.photosPreviewStoreService.photosPreview$;

    constructor(private readonly photosPreviewStoreService: PhotosPreviewStoreService) {}

    ngOnChanges(): void {
        this.photosPreviewStoreService.setOptions({
            state: this.state,
            totalCount: this.totalCount,
            mode: this.mode,
            variant: this.variant,
        });
    }

    selectPhoto(index: number, hasMore: boolean): void {
        if (hasMore) {
            this.moreClick.emit();
            return;
        }

        this.photoClick.emit(index);
    }
}
