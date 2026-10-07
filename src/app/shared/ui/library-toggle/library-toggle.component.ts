import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import type { MediaStateResponse } from '../../../api-cinekeep';
import type { LibraryFlag, RemoteData } from '../../types';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { LibraryToggleMedia, LibraryToggleStoreService } from './library-toggle-store.service';

@Component({
    selector: 'app-library-toggle',
    imports: [AsyncPipe, IconButtonComponent, MatButtonModule],
    templateUrl: './library-toggle.component.html',
    styleUrl: './library-toggle.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [LibraryToggleStoreService],
})
export class LibraryToggleComponent implements OnChanges {
    @Input({ required: true }) flag!: LibraryFlag;
    @Input({ required: true }) media!: LibraryToggleMedia;
    @Input() iconOnly = false;
    @Input() primary = false;
    @Input() libraryState: RemoteData<MediaStateResponse> | null = null;

    readonly libraryToggle$ = this.libraryToggleStoreService.libraryToggle$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly libraryToggleStoreService: LibraryToggleStoreService,
    ) {}

    ngOnChanges(): void {
        this.libraryToggleStoreService.setContext({
            media: this.media,
            flag: this.flag,
            libraryState: this.libraryState,
        });
    }

    toggle(event?: Event): void {
        event?.preventDefault();
        event?.stopPropagation();
        this.libraryToggleStoreService.toggle$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
