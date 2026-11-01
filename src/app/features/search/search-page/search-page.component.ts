import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, map, switchMap } from 'rxjs';

import {
    EmptyStateComponent,
    MediaListComponent,
    MediaOrPersonFilterType,
    MediaOrPersonType,
    SEARCH_TYPE_OPTIONS,
    SeoService,
} from '../../../shared';
import { PersonListComponent } from './person-list/person-list.component';
import { SearchStoreService } from './search-store.service';

@Component({
    selector: 'app-search-page',
    imports: [
        AsyncPipe,
        MatButtonModule,
        EmptyStateComponent,
        MediaListComponent,
        PersonListComponent,
    ],
    providers: [SearchStoreService],
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
    readonly searchResults$ = this.store.searchResults$;
    readonly typeOptions = SEARCH_TYPE_OPTIONS;

    constructor(
        private store: SearchStoreService,
        private destroyRef: DestroyRef,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        activatedRoute.queryParamMap
            .pipe(
                map((params): { query: string; type: MediaOrPersonFilterType } => {
                    const type = params.get('type');
                    return {
                        query: params.get('query') ?? '',
                        type: type === 'movie' || type === 'tv' || type === 'person' ? type : 'all',
                    };
                }),
                distinctUntilChanged(
                    (previous, current) => previous.query === current.query && previous.type === current.type,
                ),
                switchMap(({ query, type }) => this.store.search$(query, type)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.query$.pipe(takeUntilDestroyed()).subscribe((query) =>
            seoService.setPage({
                title: query ? `Results for “${query}”` : 'Search',
                description: query
                    ? `Search results for "${query}", including movies, TV series, actors, and creators.`
                    : 'Search movies, TV series, actors, creators, trailers, photos, and reviews across the catalogue.',
                robots: 'noindex, follow',
            }),
        );
    }

    setType(type: MediaOrPersonFilterType): void {
        this.store.setType(type);
    }

    loadMore(section: MediaOrPersonType): void {
        this.store.loadMore$(section).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
