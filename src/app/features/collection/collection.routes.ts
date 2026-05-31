import { Routes } from '@angular/router';

import { CollectionDetailComponent } from './collection-detail-page/collection-detail.component';
import { CollectionStoreService } from './collection-store.service';

export const collectionRoutes: Routes = [
    {
        path: ':collectionId',
        component: CollectionDetailComponent,
        data: {
            seoDescription:
                'Explore movie collections, entries, release timelines, ratings, and cast highlights on CineKeep.',
        },
        providers: [CollectionStoreService],
    },
];
