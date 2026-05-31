import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const angularApp = new AngularAppEngine();

export const reqHandler = createRequestHandler((request: Request) =>
    angularApp.handle(request),
);

export default {
    async fetch(request: Request): Promise<Response> {
        const response = await reqHandler(request);

        return response ?? new Response('Not found', { status: 404 });
    },
};
