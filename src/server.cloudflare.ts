import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

interface CloudflareEnvironment {
    readonly TMDB_API_KEY?: string;
}

interface CloudflareExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
}

type TmdbProxyCredential = 'app' | 'client';

interface TmdbProxyRoute {
    readonly version: string;
    readonly methods: readonly string[];
    readonly pattern: RegExp;
    readonly credential: TmdbProxyCredential;
    readonly cacheable?: boolean;
    readonly allowsSessionQuery?: boolean;
}

const TMDB_PROXY_PATH_PATTERN = /^\/api\/tmdb\/(3|4)(\/.*)?$/;
const TMDB_ORIGIN = 'https://api.themoviedb.org';
const PUBLIC_CACHE_MAX_AGE_SECONDS = 300;
const SESSION_QUERY_KEYS = ['guest_session_id', 'session_id'];
const NUMBER_PATH_SEGMENT = String.raw`\d+`;
const STRING_PATH_SEGMENT = String.raw`[^/]+`;
const V3_PUBLIC_GET_ROUTES: readonly RegExp[] = [
    /^\/certification\/movie\/list$/,
    /^\/collection\/\d+$/,
    /^\/company\/\d+$/,
    /^\/configuration(?:\/(?:countries|languages))?$/,
    /^\/discover\/(?:movie|tv)$/,
    /^\/genre\/(?:movie|tv)\/list$/,
    /^\/keyword\/\d+$/,
    /^\/movie\/(?:popular|\d+(?:\/(?:credits|images|keywords|recommendations|release_dates|reviews|similar|videos|watch\/providers))?)$/,
    /^\/person\/(?:popular|\d+(?:\/combined_credits)?)$/,
    /^\/review\/[^/]+$/,
    /^\/search\/(?:company|keyword|movie|multi|person|tv)$/,
    /^\/trending\/all\/(?:day|week)$/,
    /^\/tv\/(?:popular|\d+(?:\/(?:aggregate_credits|content_ratings|images|keywords|recommendations|reviews|similar|videos|watch\/providers))?)$/,
    /^\/tv\/\d+\/season\/\d+(?:\/(?:images|videos))?$/,
    /^\/tv\/\d+\/season\/\d+\/episode\/\d+(?:\/(?:images|videos))?$/,
    /^\/watch\/providers\/(?:movie|tv)$/,
];
const TMDB_PROXY_ROUTES: readonly TmdbProxyRoute[] = [
    ...V3_PUBLIC_GET_ROUTES.map((pattern) =>
        tmdbRoute('3', 'GET', pattern, 'app', { cacheable: true }),
    ),
    tmdbRoute('3', 'GET', /^\/authentication\/guest_session\/new$/, 'app'),
    tmdbRoute(
        '3',
        'POST',
        /^\/authentication\/session\/convert\/4$/,
        'app',
    ),
    tmdbRoute('3', 'DELETE', /^\/authentication\/session$/, 'app'),
    tmdbRoute(
        '3',
        'GET',
        new RegExp(
            `^/account/${STRING_PATH_SEGMENT}(?:/(?:favorite/(?:movies|tv)|rated/(?:movies|tv|tv/episodes)|watchlist/(?:movies|tv)))?$`,
        ),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        'POST',
        new RegExp(`^/account/${STRING_PATH_SEGMENT}/(?:favorite|watchlist)$`),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        'GET',
        new RegExp(`^/movie/${NUMBER_PATH_SEGMENT}/account_states$`),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        ['POST', 'DELETE'],
        new RegExp(`^/movie/${NUMBER_PATH_SEGMENT}/rating$`),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        'GET',
        new RegExp(`^/tv/${NUMBER_PATH_SEGMENT}/account_states$`),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        ['POST', 'DELETE'],
        new RegExp(`^/tv/${NUMBER_PATH_SEGMENT}/rating$`),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        'GET',
        new RegExp(
            `^/tv/${NUMBER_PATH_SEGMENT}/season/${NUMBER_PATH_SEGMENT}/episode/${NUMBER_PATH_SEGMENT}/account_states$`,
        ),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute(
        '3',
        ['POST', 'DELETE'],
        new RegExp(
            `^/tv/${NUMBER_PATH_SEGMENT}/season/${NUMBER_PATH_SEGMENT}/episode/${NUMBER_PATH_SEGMENT}/rating$`,
        ),
        'app',
        { allowsSessionQuery: true },
    ),
    tmdbRoute('4', 'POST', /^\/auth\/(?:access_token|request_token)$/, 'app'),
    tmdbRoute(
        '4',
        'GET',
        new RegExp(`^/account/${STRING_PATH_SEGMENT}/lists$`),
        'client',
    ),
    tmdbRoute('4', 'POST', /^\/list$/, 'client'),
    tmdbRoute(
        '4',
        ['GET', 'PUT', 'DELETE'],
        new RegExp(`^/list/${NUMBER_PATH_SEGMENT}$`),
        'client',
    ),
    tmdbRoute(
        '4',
        'GET',
        new RegExp(
            `^/list/${NUMBER_PATH_SEGMENT}/(?:clear|item_status)$`,
        ),
        'client',
    ),
    tmdbRoute(
        '4',
        ['POST', 'PUT', 'DELETE'],
        new RegExp(`^/list/${NUMBER_PATH_SEGMENT}/items$`),
        'client',
    ),
];

const angularApp = new AngularAppEngine();

export const reqHandler = createRequestHandler((request: Request) =>
    angularApp.handle(request),
);

export default {
    async fetch(
        request: Request,
        env: CloudflareEnvironment,
        context: CloudflareExecutionContext,
    ): Promise<Response> {
        const tmdbResponse = proxyTmdbRequest(request, env, context);

        if (tmdbResponse) {
            return tmdbResponse;
        }

        const response = await reqHandler(request);

        return response ?? new Response('Not found', { status: 404 });
    },
};

function proxyTmdbRequest(
    request: Request,
    env: CloudflareEnvironment,
    context: CloudflareExecutionContext,
): Promise<Response> | null {
    const requestUrl = new URL(request.url);
    const pathMatch = requestUrl.pathname.match(TMDB_PROXY_PATH_PATTERN);

    if (!pathMatch) {
        return null;
    }

    if (isCrossSiteBrowserRequest(request, requestUrl)) {
        return Promise.resolve(new Response('Forbidden', { status: 403 }));
    }

    const version = pathMatch[1];
    const restPath = pathMatch[2] ?? '';
    const route = findTmdbProxyRoute(version, restPath, request.method);

    if (!route) {
        return Promise.resolve(
            new Response('Method not allowed', { status: 405 }),
        );
    }

    if (
        !route.allowsSessionQuery &&
        hasSessionQueryParameter(requestUrl.searchParams)
    ) {
        return Promise.resolve(new Response('Forbidden', { status: 403 }));
    }

    const existingAuthorization = request.headers.get('authorization')?.trim();
    const appToken = env.TMDB_API_KEY?.trim();

    if (route.credential === 'app' && !appToken) {
        return Promise.resolve(
            new Response('TMDb API key is not configured.', { status: 500 }),
        );
    }

    if (route.credential === 'client' && !existingAuthorization) {
        return Promise.resolve(new Response('Unauthorized', { status: 401 }));
    }

    const targetUrl = new URL(`${version}${restPath}`, `${TMDB_ORIGIN}/`);
    targetUrl.search = requestUrl.search;

    const headers = new Headers();
    const accept = request.headers.get('accept');
    const contentType = request.headers.get('content-type');

    if (accept) {
        headers.set('Accept', accept);
    }

    if (contentType) {
        headers.set('Content-Type', contentType);
    }

    headers.set(
        'Authorization',
        getProxyAuthorization(route, appToken, existingAuthorization),
    );

    const tmdbRequest = new Request(targetUrl, {
        method: request.method,
        headers,
        body:
            request.method === 'GET' || request.method === 'HEAD'
                ? undefined
                : request.body,
        redirect: 'manual',
    });

    return shouldCachePublicRequest(request, route)
        ? fetchCachedTmdbRequest(tmdbRequest, context)
        : fetchPrivateTmdbRequest(tmdbRequest);
}

function tmdbRoute(
    version: string,
    methods: string | readonly string[],
    pattern: RegExp,
    credential: TmdbProxyCredential,
    options: Pick<TmdbProxyRoute, 'allowsSessionQuery' | 'cacheable'> = {},
): TmdbProxyRoute {
    return {
        version,
        methods: typeof methods === 'string' ? [methods] : methods,
        pattern,
        credential,
        ...options,
    };
}

function findTmdbProxyRoute(
    version: string,
    path: string,
    method: string,
): TmdbProxyRoute | null {
    return (
        TMDB_PROXY_ROUTES.find(
            (route) =>
                route.version === version &&
                route.methods.includes(method) &&
                route.pattern.test(path),
        ) ?? null
    );
}

function hasSessionQueryParameter(searchParams: URLSearchParams): boolean {
    return SESSION_QUERY_KEYS.some((key) => searchParams.has(key));
}

function getProxyAuthorization(
    route: TmdbProxyRoute,
    appToken: string | undefined,
    clientAuthorization: string | undefined,
): string {
    return route.credential === 'app'
        ? `Bearer ${appToken}`
        : clientAuthorization ?? '';
}

function isCrossSiteBrowserRequest(request: Request, requestUrl: URL): boolean {
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
        return true;
    }

    if (!hasBrowserFetchMetadata(request)) {
        return false;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    return (
        isDifferentOrigin(origin, requestUrl.origin) ||
        isDifferentOrigin(referer, requestUrl.origin)
    );
}

function hasBrowserFetchMetadata(request: Request): boolean {
    return (
        request.headers.has('sec-fetch-site') ||
        request.headers.has('sec-fetch-mode') ||
        request.headers.has('sec-fetch-dest')
    );
}

function isDifferentOrigin(
    headerValue: string | null,
    requestOrigin: string,
): boolean {
    if (!headerValue) {
        return false;
    }

    try {
        return new URL(headerValue).origin !== requestOrigin;
    } catch {
        return true;
    }
}

function shouldCachePublicRequest(
    request: Request,
    route: TmdbProxyRoute,
): boolean {
    return request.method === 'GET' && route.cacheable === true;
}

async function fetchCachedTmdbRequest(
    request: Request,
    context: CloudflareExecutionContext,
): Promise<Response> {
    const cache = (caches as CacheStorage & { readonly default: Cache })
        .default;
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return withCacheHeaders(cachedResponse, 'HIT');
    }

    const response = await fetch(request);

    if (isPublicCacheableResponse(response)) {
        const responseForCache = withCacheHeaders(response.clone(), 'MISS');
        const cachePut = cache.put(request, responseForCache);

        context.waitUntil(cachePut);
    }

    return withCacheHeaders(response, 'MISS');
}

async function fetchPrivateTmdbRequest(request: Request): Promise<Response> {
    const response = await fetch(request);

    return withNoStoreHeaders(response);
}

function isPublicCacheableResponse(response: Response): boolean {
    return (
        response.ok &&
        response.headers.get('content-type')?.includes('application/json') ===
            true
    );
}

function withCacheHeaders(response: Response, cacheStatus: 'HIT' | 'MISS') {
    const headers = new Headers(response.headers);

    headers.set(
        'Cache-Control',
        `public, max-age=${PUBLIC_CACHE_MAX_AGE_SECONDS}`,
    );
    headers.set('X-CineKeep-Cache', cacheStatus);

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function withNoStoreHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    headers.set('Cache-Control', 'no-store');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
