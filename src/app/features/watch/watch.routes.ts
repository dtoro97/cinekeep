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
                'Find popular movies and TV series streaming now, by provider, release window, runtime, and mood.',
        },
    },
    {
        path: 'streaming/provider/:providerId',
        component: StreamingListPageComponent,
        data: {
            streamingListKind: 'provider',
            seoDescription:
                'Browse movies and TV series streaming on this provider.',
        },
    },
    {
        path: 'streaming/list/:listSlug',
        component: StreamingListPageComponent,
        data: {
            streamingListKind: 'editorial',
            seoDescription:
                'Browse curated streaming movies and TV series by theme, timing, and watchability.',
        },
    },
];
