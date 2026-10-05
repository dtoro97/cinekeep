import { Route, Routes } from '@angular/router';

import { DISCOVER_PAGE_DEFINITIONS, DiscoverPageKey } from './discover-page-definitions';
import { DiscoverPageComponent } from './discover-page/discover-page.component';
import { PopularPeoplePageComponent } from './popular-people-page/popular-people-page.component';

const toDiscoverRoute = (path: string, key: DiscoverPageKey): Route => ({
    path,
    component: DiscoverPageComponent,
    title: DISCOVER_PAGE_DEFINITIONS[key].title,
    data: { discoverPageKey: key, seoDescription: DISCOVER_PAGE_DEFINITIONS[key].seoDescription },
});

export const discoverRoutes: Routes = [toDiscoverRoute('', 'advanced')];

export const movieBrowseRoutes: Routes = [
    { path: '', redirectTo: 'popular', pathMatch: 'full' },
    toDiscoverRoute('popular', 'movie-popular'),
    toDiscoverRoute('top-rated', 'movie-top-rated'),
    toDiscoverRoute('now-playing', 'movie-now-playing'),
    toDiscoverRoute('upcoming', 'movie-upcoming'),
];

export const tvBrowseRoutes: Routes = [
    { path: '', redirectTo: 'popular', pathMatch: 'full' },
    toDiscoverRoute('popular', 'tv-popular'),
    toDiscoverRoute('top-rated', 'tv-top-rated'),
    toDiscoverRoute('airing-today', 'tv-airing-today'),
    toDiscoverRoute('on-the-air', 'tv-on-the-air'),
];

export const peopleBrowseRoutes: Routes = [
    {
        path: '',
        redirectTo: 'popular',
        pathMatch: 'full',
    },
    {
        path: 'popular',
        component: PopularPeoplePageComponent,
        title: 'Popular People',
        data: {
            seoDescription:
                'Browse actors, filmmakers, and creators trending across movies and TV.',
        },
    },
];
