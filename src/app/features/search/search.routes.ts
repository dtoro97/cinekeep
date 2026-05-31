import { Routes } from '@angular/router';
import { SearchPageComponent } from './search-page/search-page.component';

export const searchRoutes: Routes = [
    {
        path: '',
        component: SearchPageComponent,
        title: 'Search',
        data: {
            seoDescription:
                'Search movies, TV series, actors, creators, trailers, photos, and reviews across the catalogue.',
            robots: 'noindex, follow',
        },
    },
];
