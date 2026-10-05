import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import {
    BrowseToolbarComponent,
    buildTmdbImageUrl,
    EmptyStateComponent,
    LibraryToggleComponent,
    MediaListItemComponent,
    PluralizePipe,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    SortButtonComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { StreamingListStoreService } from './streaming-list-store.service';

@Component({
    selector: 'app-streaming-list-page',
    imports: [
        AsyncPipe,
        MatButtonModule,
        RouterLink,
        BrowseToolbarComponent,
        EmptyStateComponent,
        LibraryToggleComponent,
        MediaListItemComponent,
        PluralizePipe,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
        ToggleGroupComponent,
    ],
    providers: [StreamingListStoreService],
    templateUrl: './streaming-list-page.component.html',
    styleUrl: './streaming-list-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingListPageComponent {
    readonly streamingList$ = this.store.streamingList$;

    constructor(
        private store: StreamingListStoreService,
        private destroyRef: DestroyRef,
        seoService: SeoService,
    ) {
        this.streamingList$
            .pipe(
                filter(({ title }) => !!title),
                takeUntilDestroyed(),
            )
            .subscribe(({ title, description, seoImagePath }) =>
                seoService.setPage({
                    title,
                    description,
                    image: buildTmdbImageUrl(seoImagePath, 'w780'),
                    imageAlt: `${title} streaming preview`,
                }),
            );
    }

    setSortKey(value: unknown): void {
        this.store.setSortKey(value);
    }

    setMediaType(value: unknown): void {
        this.store.setMediaType(value);
    }

    toggleSortDirection(): void {
        this.store.toggleSortDirection();
    }

    loadMore(): void {
        this.store.loadMore$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
