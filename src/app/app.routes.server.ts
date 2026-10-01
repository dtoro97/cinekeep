import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    // Private pages need the browser-restored session, so they render on the client only.
    {
        path: 'me',
        renderMode: RenderMode.Client,
    },
    {
        path: 'me/**',
        renderMode: RenderMode.Client,
    },
    {
        path: 'lists/:listId',
        renderMode: RenderMode.Client,
    },
    {
        path: '**',
        renderMode: RenderMode.Server,
    },
];
