import { Routes } from '@angular/router';
import { NotFoundComponent, v4AccountAccessGuard } from './shared';

export const routes: Routes = [
    {
        path: 'name',
        loadChildren: () =>
            import('./features/person/person-detail.routes').then(
                (m) => m.personDetailRoutes,
            ),
    },
    {
        path: 'title',
        loadChildren: () =>
            import('./features/media/media.routes').then(
                (m) => m.mediaRoutes,
            ),
    },
    {
        path: 'collection',
        loadChildren: () =>
            import('./features/collection/collection.routes').then(
                (m) => m.collectionRoutes,
            ),
    },
    {
        path: 'discover',
        loadChildren: () =>
            import('./features/discover/discover.routes').then(
                (m) => m.discoverRoutes,
            ),
    },
    {
        path: 'movies',
        loadChildren: () =>
            import('./features/discover/discover.routes').then(
                (m) => m.movieBrowseRoutes,
            ),
    },
    {
        path: 'tv',
        loadChildren: () =>
            import('./features/discover/discover.routes').then(
                (m) => m.tvBrowseRoutes,
            ),
    },
    {
        path: 'people',
        loadChildren: () =>
            import('./features/discover/discover.routes').then(
                (m) => m.peopleBrowseRoutes,
            ),
    },
    {
        path: 'search',
        title: 'Search',
        data: {
            seoDescription:
                'Search CineKeep for movies, TV series, people, trailers, photos, and reviews powered by TMDb.',
            robots: 'noindex, follow',
        },
        loadChildren: () =>
            import('./features/search/search.routes').then(
                (m) => m.searchRoutes,
            ),
    },
    {
        path: 'me',
        data: { robots: 'noindex, nofollow' },
        loadChildren: () =>
            import('./features/user/user.routes').then(
                (m) => m.userRoutes,
            ),
    },
    {
        path: 'lists/:listId',
        canActivate: [v4AccountAccessGuard],
        data: { robots: 'noindex, nofollow' },
        loadComponent: () =>
            import(
                './features/user/user-list-detail-page/user-list-detail-page.component'
            ).then((m) => m.UserListDetailPageComponent),
    },
    {
        path: 'watch',
        loadChildren: () =>
            import('./features/watch/watch.routes').then((m) => m.watchRoutes),
    },
    {
        path: '',
        loadChildren: () =>
            import('./features/home/home.routes').then((m) => m.homeRoutes),
    },
    {
        path: 'not-found',
        component: NotFoundComponent,
        title: 'Page Not Found',
        data: { robots: 'noindex, nofollow' },
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'Page Not Found',
        data: { robots: 'noindex, nofollow' },
    },
];
