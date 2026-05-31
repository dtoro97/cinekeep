import { Routes } from '@angular/router';

import { CollectionDetailComponent } from './collection-detail-page/collection-detail.component';
import { CollectionStoreService } from './collection-store.service';

export const collectionRoutes: Routes = [
    {
        path: ':collectionId',
        component: CollectionDetailComponent,
        data: {
            seoDescription:
                'Explore every movie in a collection, with release order, ratings, cast highlights, posters, and backdrops.',
        },
        providers: [CollectionStoreService],
    },
];
