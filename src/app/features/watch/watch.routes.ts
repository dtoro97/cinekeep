import { Routes } from '@angular/router';

import { StreamingHubPageComponent } from './streaming-hub/streaming-hub-page.component';
import { StreamingListPageComponent } from './streaming-list/streaming-list-page.component';

export const watchRoutes: Routes = [
    {
        path: '',
        redirectTo: 'streaming',
        pathMatch: 'full',
    },
    {
        path: 'streaming',
        component: StreamingHubPageComponent,
        title: 'Streaming Guide',
        data: {
            seoDescription:
                'Browse popular streaming movies and TV series by provider, availability, and current watch lists.',
        },
    },
    {
        path: 'streaming/provider/:providerId',
        component: StreamingListPageComponent,
        data: {
            streamingListKind: 'provider',
            seoDescription:
                'Browse movies and TV series currently available on a streaming provider.',
        },
    },
    {
        path: 'streaming/list/:listSlug',
        component: StreamingListPageComponent,
        data: {
            streamingListKind: 'editorial',
            seoDescription:
                'Browse curated streaming movies and TV series on CineKeep.',
        },
    },
];
