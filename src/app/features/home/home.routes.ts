import { Routes } from '@angular/router';
import { HomePageComponent } from './home-page/home.component';
import { TrailersPageComponent } from './trailers-page/trailers-page.component';

export const homeRoutes: Routes = [
    {
        path: '',
        component: HomePageComponent,
        pathMatch: 'full',
        title: 'CineKeep',
        data: {
            seoDescription:
                'Find what to watch next: trending movies and TV series, trailers, cast, photos, reviews, and people in a clean cinematic guide.',
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
                'Watch the trailers people are talking about, from new movie drops to TV series teasers.',
        },
    },
];
