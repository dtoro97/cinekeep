import { Routes } from '@angular/router';

import { StreamingHubPageComponent } from './streaming-hub-page/streaming-hub-page.component';
import { StreamingListPageComponent } from './streaming-list-page/streaming-list-page.component';

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
                'Popular movies and TV series on streaming services in your region, by service and by list.',
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
                'A list of streaming movies and TV series, filtered by service, release date and runtime.',
        },
    },
];
