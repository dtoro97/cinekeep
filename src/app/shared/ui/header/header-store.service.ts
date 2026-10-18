import { Injectable } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router } from '@angular/router';
import { ComponentStore } from '@ngrx/component-store';
import { filter, map, Observable, tap } from 'rxjs';

import { UserSessionStoreService } from '../../services/user-session-store.service';

type HeaderSection = 'movie' | 'tv' | 'people' | 'library' | 'streaming' | 'trailers';

interface HeaderTab {
    readonly section: HeaderSection;
    readonly label: string;
    readonly routerLink: string;
}

interface HeaderSubNavLink {
    readonly label: string;
    readonly routerLink: string;
    readonly queryParams?: Readonly<Record<string, string>>;
}

interface HeaderState {
    readonly url: string;
}

// The four sections, then Streaming and Trailers after a divider.
const SECTION_TABS: readonly HeaderTab[] = [
    { section: 'movie', label: 'Movies', routerLink: '/movies/popular' },
    { section: 'tv', label: 'TV series', routerLink: '/tv/popular' },
    { section: 'people', label: 'People', routerLink: '/people/popular' },
    { section: 'library', label: 'Library', routerLink: '/me' },
];

const WATCH_TABS: readonly HeaderTab[] = [
    { section: 'streaming', label: 'Streaming', routerLink: '/watch/streaming' },
    { section: 'trailers', label: 'Trailers', routerLink: '/trailers' },
];

const SUB_NAV: Partial<Record<HeaderSection, { readonly label: string; readonly links: readonly HeaderSubNavLink[] }>> = {
    movie: {
        label: 'Movies',
        links: [
            { label: 'Popular', routerLink: '/movies/popular' },
            { label: 'Top rated', routerLink: '/movies/top-rated' },
            { label: 'Now playing', routerLink: '/movies/now-playing' },
            { label: 'Upcoming', routerLink: '/movies/upcoming' },
            { label: 'Discover', routerLink: '/discover', queryParams: { type: 'movie' } },
        ],
    },
    tv: {
        label: 'TV series',
        links: [
            { label: 'Popular', routerLink: '/tv/popular' },
            { label: 'Top rated', routerLink: '/tv/top-rated' },
            { label: 'Airing today', routerLink: '/tv/airing-today' },
            { label: 'On the air', routerLink: '/tv/on-the-air' },
            { label: 'Discover', routerLink: '/discover', queryParams: { type: 'tv' } },
        ],
    },
    library: {
        label: 'Library',
        links: [
            { label: 'Profile', routerLink: '/me' },
            { label: 'Watchlist', routerLink: '/me/watchlists' },
            { label: 'Favourites', routerLink: '/me/favorites' },
            { label: 'Ratings', routerLink: '/me/ratings' },
            { label: 'Lists', routerLink: '/me/lists' },
        ],
    },
};

const SUB_NAV_MATCH: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'subset',
    fragment: 'ignored',
    matrixParams: 'ignored',
};

@Injectable()
export class HeaderStoreService extends ComponentStore<HeaderState> {
    // Not debounced: the header must render on the first change detection so hydration matches the server render.
    readonly header$ = this.select(
        this.state$,
        this.userSessionStoreService.authSession$,
        ({ url }, { isAuthenticated }) => {
            const [path, query = ''] = url.split('#')[0].split('?');
            const segments = path.split('/').filter(Boolean);
            const discoverType = new URLSearchParams(query).get('type');
            // Detail pages belong to the section of what they show: `/title/:id/:type`, collections are films.
            const section: HeaderSection | null =
                segments[0] === 'movies' || segments[0] === 'collection'
                    ? 'movie'
                    : segments[0] === 'tv'
                      ? 'tv'
                      : segments[0] === 'title'
                        ? segments[2] === 'tv'
                            ? 'tv'
                            : 'movie'
                        : segments[0] === 'discover'
                          ? discoverType === 'tv'
                              ? 'tv'
                              : 'movie'
                          : segments[0] === 'people' || segments[0] === 'name'
                            ? 'people'
                            : segments[0] === 'me'
                              ? 'library'
                              : segments[0] === 'watch'
                                ? 'streaming'
                                : segments[0] === 'trailers'
                                  ? 'trailers'
                                  : null;
            const subNav = section ? SUB_NAV[section] : undefined;

            return {
                tabs: SECTION_TABS.map((tab) => ({
                    ...tab,
                    isActive: tab.section === section,
                    // Library pages need an account, so a visitor's Library tab opens sign-in instead.
                    opensSignIn: tab.section === 'library' && !isAuthenticated,
                })),
                watchTabs: WATCH_TABS.map((tab) => ({ ...tab, isActive: tab.section === section })),
                showSubNav: !!subNav && (section !== 'library' || isAuthenticated),
                subNavLabel: subNav?.label ?? '',
                subNavLinks: subNav?.links ?? [],
                subNavMatch: SUB_NAV_MATCH,
            };
        },
    );

    constructor(
        router: Router,
        private readonly userSessionStoreService: UserSessionStoreService,
    ) {
        super({ url: router.url });

        this.trackUrl(
            router.events.pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                map((event) => event.urlAfterRedirects),
            ),
        );
    }

    private readonly trackUrl = this.effect((url$: Observable<string>) =>
        url$.pipe(tap((url) => this.patchState({ url }))),
    );
}
