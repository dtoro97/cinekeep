import { Routes } from '@angular/router';

import { CollectionDetailPageComponent } from './collection-detail-page/collection-detail-page.component';

export const collectionRoutes: Routes = [
    {
        path: ':collectionId',
        component: CollectionDetailPageComponent,
        data: {
            seoDescription:
                'Explore every movie in a collection, with release order, ratings, cast highlights, posters, and backdrops.',
        },
    },
];
