import { Routes } from '@angular/router';

import { HOME_SEO_DESCRIPTION, TRAILERS_SEO_DESCRIPTION } from './home-seo';
import { HomePageComponent } from './home-page/home-page.component';
import { TrailersPageComponent } from './trailers-page/trailers-page.component';

export const homeRoutes: Routes = [
    {
        path: '',
        component: HomePageComponent,
        pathMatch: 'full',
        title: 'CineKeep',
        data: { seoDescription: HOME_SEO_DESCRIPTION },
    },
    {
        path: 'trailers',
        redirectTo: 'trailers/trending',
        pathMatch: 'full',
    },
    {
        path: 'trailers/:feedType',
        component: TrailersPageComponent,
        data: { seoDescription: TRAILERS_SEO_DESCRIPTION },
    },
];
