import { Routes } from '@angular/router';
import { HomePageComponent } from './home-page/home.component';
import { TrailersPageComponent } from './trailers-page/trailers-page.component';

export const homeRoutes: Routes = [
    {
        path: '',
        component: HomePageComponent,
        pathMatch: 'full',
        title: 'Browse Movies, TV Series, and People',
        data: {
            seoDescription:
                'Track what to watch next with trending movies, TV series, trailers, people, reviews, and photos.',
        },
    },
    {
        path: 'trailers',
        redirectTo: 'trailers/trending',
        pathMatch: 'full',
    },
    {
        path: 'trailers/:feedType',
        component: TrailersPageComponent,
        data: {
            seoDescription:
                'Watch trending and newly released movie and TV series trailers on CineKeep.',
        },
    },
];
