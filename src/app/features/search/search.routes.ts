import { Routes } from '@angular/router';
import { SearchPageComponent } from './search-page/search-page.component';

export const searchRoutes: Routes = [
    {
        path: '',
        component: SearchPageComponent,
        title: 'Search',
        data: {
            seoDescription:
                'Search CineKeep for movies, TV series, people, trailers, photos, and reviews.',
            robots: 'noindex, follow',
        },
    },
];
