import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import type { ViewerImage } from '../../models';
import { BrowseToolbarComponent } from '../browse-toolbar/browse-toolbar.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ImageComponent } from '../image/image.component';
import { SortButtonComponent } from '../sort-button/sort-button.component';
import { ToggleGroupComponent } from '../toggle-group/toggle-group.component';
import { PHOTO_SORT_OPTIONS, PhotoSortField, PhotosBrowserStoreService } from './photos-browser-store.service';

export interface PhotosBrowserSelection {
    readonly images: readonly ViewerImage[];
    readonly index: number;
}

@Component({
    selector: 'app-photos-browser',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        ImageComponent,
        MatButtonModule,
        SortButtonComponent,
        ToggleGroupComponent,
    ],
    templateUrl: './photos-browser.component.html',
    styleUrl: './photos-browser.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [PhotosBrowserStoreService],
})
export class PhotosBrowserComponent {
    @Input({ required: true }) set images(images: readonly ViewerImage[]) {
        this.photosBrowserStoreService.setImages(images);
    }
    @Output() readonly photoSelect = new EventEmitter<PhotosBrowserSelection>();

    readonly sortOptions = PHOTO_SORT_OPTIONS;
    readonly photosBrowser$ = this.photosBrowserStoreService.photosBrowser$;

    constructor(private readonly photosBrowserStoreService: PhotosBrowserStoreService) {}

    setSortField(value: PhotoSortField): void {
        this.photosBrowserStoreService.setSortField(value);
    }

    toggleSortDirection(): void {
        this.photosBrowserStoreService.toggleSortDirection();
    }

    setSelectedTypes(selectedTypes: readonly string[]): void {
        this.photosBrowserStoreService.setSelectedTypes(selectedTypes);
    }

    showMore(): void {
        this.photosBrowserStoreService.showMore();
    }
}
