import { Routes } from '@angular/router';

import { DiscoverPageComponent } from './discover-page/discover-page.component';
import { PopularPeoplePageComponent } from './popular-people-page/popular-people-page.component';

export const discoverRoutes: Routes = [
    {
        path: '',
        component: DiscoverPageComponent,
        title: 'Discover',
        data: {
            discoverPageKey: 'advanced',
            seoDescription:
                'Find movies and TV series by genre, rating, runtime, release dates, and provider availability.',
        },
    },
];

export const movieBrowseRoutes: Routes = [
    {
        path: '',
        redirectTo: 'popular',
        pathMatch: 'full',
    },
    {
        path: 'popular',
        component: DiscoverPageComponent,
        title: 'Popular Movies',
        data: {
            discoverPageKey: 'movie-popular',
            seoDescription:
                'Browse popular movies currently getting the most attention from viewers.',
        },
    },
    {
        path: 'top-rated',
        component: DiscoverPageComponent,
        title: 'Top Rated Movies',
        data: {
            discoverPageKey: 'movie-top-rated',
            seoDescription:
                'Browse highly rated movies with enough audience activity to keep the list stable.',
        },
    },
    {
        path: 'now-playing',
        component: DiscoverPageComponent,
        title: 'Now Playing Movies',
        data: {
            discoverPageKey: 'movie-now-playing',
            seoDescription: 'Browse movies currently listed as playing in theaters.',
        },
    },
    {
        path: 'upcoming',
        component: DiscoverPageComponent,
        title: 'Upcoming Movies',
        data: {
            discoverPageKey: 'movie-upcoming',
            seoDescription:
                'Browse theatrical movie releases scheduled over the next two weeks.',
        },
    },
];

export const tvBrowseRoutes: Routes = [
    {
        path: '',
        redirectTo: 'popular',
        pathMatch: 'full',
    },
    {
        path: 'popular',
        component: DiscoverPageComponent,
        title: 'Popular TV Series',
        data: {
            discoverPageKey: 'tv-popular',
            seoDescription:
                'Browse popular TV series currently getting the most attention from viewers.',
        },
    },
    {
        path: 'top-rated',
        component: DiscoverPageComponent,
        title: 'Top Rated TV Series',
        data: {
            discoverPageKey: 'tv-top-rated',
            seoDescription:
                'Browse highly rated TV series with enough audience activity to keep the list stable.',
        },
    },
    {
        path: 'airing-today',
        component: DiscoverPageComponent,
        title: 'TV Series Airing Today',
        data: {
            discoverPageKey: 'tv-airing-today',
            seoDescription: 'Browse TV series with episodes scheduled to air today.',
        },
    },
    {
        path: 'on-the-air',
        component: DiscoverPageComponent,
        title: 'TV Series Airing This Week',
        data: {
            discoverPageKey: 'tv-on-the-air',
            seoDescription:
                'Browse TV series with episodes scheduled over the next seven days.',
        },
    },
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
                'Browse popular actors, creators, and filmmakers currently trending.',
        },
    },
];
