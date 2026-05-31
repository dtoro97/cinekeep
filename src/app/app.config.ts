import { isPlatformBrowser } from '@angular/common';
import {
    provideHttpClient,
    withFetch,
    withInterceptors,
} from '@angular/common/http';
import {
    ApplicationConfig,
    inject,
    PLATFORM_ID,
    provideAppInitializer,
    REQUEST,
    REQUEST_CONTEXT,
    provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
    provideRouter,
    TitleStrategy,
    withComponentInputBinding,
    withInMemoryScrolling,
} from '@angular/router';

import { routes } from './app.routes';
import { Configuration as V3Configuration } from './api/configuration';
import { Configuration as V4Configuration } from './api-v4/configuration';
import { environment } from '../environments/environment';
import {
    provideClientHydration,
    withEventReplay,
} from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import {
    SeoTitleStrategy,
    UserSessionStoreService,
    WatchProviderStoreService,
} from './shared';
import { TmdbUserAuthService } from './shared/services/tmdb-user-auth.service';
import { delayInterceptor } from './shared/utils/delay-interceptor';
import { localeInterceptor } from './shared/utils/locale-interceptor';

interface CloudflareRequestContext {
    readonly env?: {
        readonly TMDB_API_KEY?: string;
    };
}

const TMDB_V3_ORIGIN = 'https://api.themoviedb.org/3';
const TMDB_V4_ORIGIN = 'https://api.themoviedb.org/4';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(
            routes,
            withComponentInputBinding(),
            withInMemoryScrolling({
                scrollPositionRestoration: 'top',
            }),
        ),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
        provideAnimationsAsync(),
        provideHttpClient(
            withFetch(),
            withInterceptors([localeInterceptor, delayInterceptor]),
        ),
        {
            provide: V3Configuration,
            useFactory: () => {
                const serverApiKey = resolveServerApiKey();

                return new V3Configuration({
                    basePath: resolveApiBasePath(
                        environment.apiUrl,
                        serverApiKey ? TMDB_V3_ORIGIN : undefined,
                    ),
                    credentials: {
                        bearerAuth: serverApiKey ?? environment.apiKey,
                    },
                });
            },
        },
        {
            provide: V4Configuration,
            useFactory: () => {
                const userSessionStore = inject(UserSessionStoreService);
                const serverApiKey = resolveServerApiKey();

                return new V4Configuration({
                    basePath: resolveApiBasePath(
                        environment.apiV4Url,
                        serverApiKey ? TMDB_V4_ORIGIN : undefined,
                    ),
                    credentials: {
                        bearerAuth: () =>
                            userSessionStore.v4AccessToken() ??
                            serverApiKey ??
                            environment.apiKey,
                    },
                });
            },
        },
        provideAppInitializer(() =>
            firstValueFrom(inject(TmdbUserAuthService).tryCompleteLoginFromUrl$()),
        ),
        provideAppInitializer(() => {
            const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
            const request = inject(REQUEST, { optional: true });

            if (!isBrowser && !request) {
                return;
            }

            inject(WatchProviderStoreService).load();
        }),
        provideClientHydration(withEventReplay()),
        //provideServerRendering(withRoutes(serverRoutes)),
    ],
};

function resolveApiBasePath(
    basePath: string,
    serverBasePath?: string,
): string {
    const request = inject(REQUEST, { optional: true });

    if (request && serverBasePath) {
        return serverBasePath;
    }

    if (!basePath.startsWith('/')) {
        return basePath;
    }

    if (request) {
        return new URL(basePath, request.url).toString();
    }

    return basePath;
}

function resolveServerApiKey(): string | null {
    const request = inject(REQUEST, { optional: true });

    if (!request) {
        return null;
    }

    const context = inject(REQUEST_CONTEXT, { optional: true });

    if (!isCloudflareRequestContext(context)) {
        return null;
    }

    const apiKey = context.env?.TMDB_API_KEY?.trim();

    return apiKey || null;
}

function isCloudflareRequestContext(
    value: unknown,
): value is CloudflareRequestContext {
    if (typeof value !== 'object' || value === null || !('env' in value)) {
        return false;
    }

    const env = (value as CloudflareRequestContext).env;

    return (
        env === undefined ||
        (typeof env === 'object' &&
            env !== null &&
            (env.TMDB_API_KEY === undefined ||
                typeof env.TMDB_API_KEY === 'string'))
    );
}
