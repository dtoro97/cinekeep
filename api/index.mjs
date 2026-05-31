let angularHandler;

export default async function handler(request, response) {
    angularHandler ??= import('../dist/cinekeep/server/server.mjs').then(
        ({ reqHandler }) => {
            if (typeof reqHandler !== 'function') {
                throw new Error('Angular SSR request handler was not found.');
            }

            return reqHandler;
        },
    );

    return (await angularHandler)(request, response);
}
