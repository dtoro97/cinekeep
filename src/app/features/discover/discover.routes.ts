import { Routes } from '@angular/router';

import { DiscoverPageComponent } from './discover-page/discover-page.component';
import { PopularPeoplePageComponent } from './popular-people-page/popular-people-page.component';

export const discoverRoutes: Routes = [
    {
        path: '',
        component: DiscoverPageComponent,
        title: 'Discover Movies & TV',
        data: {
            discoverPageKey: 'advanced',
            seoDescription:
                'Filter movies and TV series by genre, rating, release date, runtime, language, and where to watch.',
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
                'See the movies getting the most attention right now.',
        },
    },
    {
        path: 'top-rated',
        component: DiscoverPageComponent,
        title: 'Top Rated Movies',
        data: {
            discoverPageKey: 'movie-top-rated',
            seoDescription:
                'Explore standout movies ranked by audience ratings.',
        },
    },
    {
        path: 'now-playing',
        component: DiscoverPageComponent,
        title: 'Now Playing Movies',
        data: {
            discoverPageKey: 'movie-now-playing',
            seoDescription: 'Browse movies now playing in theaters.',
        },
    },
    {
        path: 'upcoming',
        component: DiscoverPageComponent,
        title: 'Upcoming Movies',
        data: {
            discoverPageKey: 'movie-upcoming',
            seoDescription:
                'Browse upcoming theatrical releases and plan what to watch next.',
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
                'See the TV series getting the most attention right now.',
        },
    },
    {
        path: 'top-rated',
        component: DiscoverPageComponent,
        title: 'Top Rated TV Series',
        data: {
            discoverPageKey: 'tv-top-rated',
            seoDescription:
                'Explore standout TV series ranked by audience ratings.',
        },
    },
    {
        path: 'airing-today',
        component: DiscoverPageComponent,
        title: 'TV Series Airing Today',
        data: {
            discoverPageKey: 'tv-airing-today',
            seoDescription: 'Find TV episodes scheduled to air today.',
        },
    },
    {
        path: 'on-the-air',
        component: DiscoverPageComponent,
        title: 'TV Series Airing This Week',
        data: {
            discoverPageKey: 'tv-on-the-air',
            seoDescription:
                'Track TV series with new episodes airing this week.',
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
                'Browse actors, filmmakers, and creators trending across movies and TV.',
        },
    },
];
