import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    buildTmdbImageUrl,
    EmptyStateComponent,
    MediaListItemComponent,
    SeoService,
    ToggleGroupComponent,
    RepeatPipe,
    SkeletonComponent,
    SortButtonComponent,
    WatchlistToggleComponent,
} from '../../../shared';
import { StreamingListStoreService } from './streaming-list-store.service';

@Component({
    selector: 'app-streaming-list-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        MediaListItemComponent,
        MatButtonModule,
        ToggleGroupComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        SortButtonComponent,
        WatchlistToggleComponent,
    ],
    providers: [StreamingListStoreService],
    templateUrl: './streaming-list-page.component.html',
    styleUrl: './streaming-list-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingListPageComponent {
    readonly vm$ = this.store.vm$;

    constructor(
        private readonly store: StreamingListStoreService,
        private readonly seo: SeoService,
    ) {
        this.vm$
            .pipe(
                tap((vm) => {
                    if (!vm.title) {
                        return;
                    }

                    const preview =
                        vm.displayItems.find(({ item }) => !!item.thumb) ??
                        vm.displayItems[0] ??
                        null;
                    const imagePath = preview?.item.thumb ?? null;

                    this.seo.setPage({
                        title: vm.title,
                        description: vm.description,
                        image: buildTmdbImageUrl(imagePath, 'w780'),
                        imageAlt: `${vm.title} streaming preview`,
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    onSortChange(value: unknown): void {
        this.store.updateSort(value);
    }

    onMediaTypeChange(value: unknown): void {
        this.store.updateMediaType(value);
    }

    toggleSortDirection(): void {
        this.store.toggleSortDirection();
    }

    loadMore(): void {
        this.store.loadMore();
    }
}
