import { Routes } from '@angular/router';

import { CollectionDetailPageComponent } from './collection-detail-page/collection-detail-page.component';

export const collectionRoutes: Routes = [
    {
        path: ':collectionId',
        component: CollectionDetailPageComponent,
        data: {
            seoDescription:
                'Every movie in a collection in release order, with ratings and cast.',
        },
    },
];
