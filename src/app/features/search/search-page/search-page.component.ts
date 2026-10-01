import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { combineLatest, map, switchMap, tap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { PAGE_SIZE, SMALL_LIST_COUNT } from '../../../constants';
import {
    EmptyStateComponent,
    MediaListComponent,
    ToggleGroupComponent,
    PersonListComponent,
    SEARCH_TYPE_OPTIONS,
    SeoService,
    toMediaListEntryState,
} from '../../../shared';
import { GenreService } from '../../../shared/services';
import { SearchStoreService, SearchType } from '../search-store.service';

@Component({
    selector: 'app-search-page',
    templateUrl: './search-page.component.html',
    styleUrl: './search-page.component.scss',
    imports: [
        AsyncPipe,
        MatButtonModule,
        EmptyStateComponent,
        MediaListComponent,
        ToggleGroupComponent,
        PersonListComponent,
    ],
    providers: [SearchStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
    readonly query = input<string>();
    readonly type = input<string>();
    readonly typeOptions = SEARCH_TYPE_OPTIONS;

    private readonly searchRequest = computed(() => ({
        query: this.query() ?? '',
        type: this.normalizeType(this.type()),
    }));

    readonly vm$ = combineLatest({
        query: this.store.query$,
        type: this.store.type$,
        movieState: this.store.movieResultsState$,
        tvState: this.store.tvResultsState$,
        personState: this.store.personResultsState$,
        movieHasMore: this.store.movieHasMore$,
        tvHasMore: this.store.tvHasMore$,
        personHasMore: this.store.personHasMore$,
        noSearchResults: this.store.noSearchResults$,
        movieGenreMap: this.genreService.movieGenres$,
        tvGenreMap: this.genreService.tvGenres$,
    }).pipe(
        map((vm) => {
            const hasQuery = vm.query.length > 0;

            return {
                ...vm,
                hasQuery,
                pageTitle: hasQuery ? `Results for "${vm.query}"` : 'Search',
                movieListState: toMediaListEntryState(vm.movieState, vm.movieGenreMap),
                tvListState: toMediaListEntryState(vm.tvState, vm.tvGenreMap),
                listSkeletonCount: vm.type === 'all' ? SMALL_LIST_COUNT : PAGE_SIZE,
            };
        }),
    );

    constructor(
        private readonly store: SearchStoreService,
        private readonly seo: SeoService,
        private readonly genreService: GenreService,
    ) {
        toObservable(this.searchRequest)
            .pipe(
                switchMap(({ query, type }) => this.store.search$(query, type)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.query$
            .pipe(
                tap((query) => {
                    this.seo.setPage({
                        title: query ? `Results for "${query}"` : 'Search',
                        description: query
                            ? `Search results for "${query}", including movies, TV series, actors, and creators.`
                            : 'Search movies, TV series, actors, creators, trailers, photos, and reviews across the catalogue.',
                        robots: 'noindex, follow',
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    loadMoreMovies(): void {
        this.store.loadMoreMovies$().subscribe();
    }

    loadMoreTv(): void {
        this.store.loadMoreTv$().subscribe();
    }

    loadMorePeople(): void {
        this.store.loadMorePeople$().subscribe();
    }

    setType(type: unknown): void {
        this.store.updateType(type as SearchType);
    }

    private normalizeType(value: string | undefined): SearchType {
        if (value === 'movie' || value === 'tv' || value === 'person') {
            return value;
        }

        return 'all';
    }
}
