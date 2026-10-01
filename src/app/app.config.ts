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
import { Configuration as BackendConfiguration } from './api-cinekeep/configuration';
import { environment } from '../environments/environment';
import {
    provideClientHydration,
    withEventReplay,
    withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import {
    AuthService,
    SeoTitleStrategy,
    WatchProviderStoreService,
} from './shared';
import { authInterceptor, isBackendApiRequest } from './shared/utils/auth-interceptor';
import { delayInterceptor } from './shared/utils/delay-interceptor';
import { localeInterceptor } from './shared/utils/locale-interceptor';

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
            withInterceptors([
                localeInterceptor,
                authInterceptor,
                delayInterceptor,
            ]),
        ),
        {
            provide: V3Configuration,
            useFactory: () => {
                return new V3Configuration({
                    basePath: resolveApiBasePath(environment.apiUrl),
                    credentials: {
                        bearerAuth: environment.apiKey,
                    },
                });
            },
        },
        {
            provide: BackendConfiguration,
            useFactory: () =>
                new BackendConfiguration({
                    basePath: environment.backendApiUrl,
                    // Needed when dev calls the backend cross-origin, so the refresh cookie is
                    // stored and sent. Harmless for same-origin production calls.
                    withCredentials: true,
                }),
        },
        // Not awaited: routes and the header wait on the session status instead of blocking boot.
        provideAppInitializer(() => {
            inject(AuthService).restoreSession$().subscribe();
        }),
        provideAppInitializer(() => {
            const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
            const request = inject(REQUEST, { optional: true });

            if (!isBrowser && !request) {
                return;
            }

            inject(WatchProviderStoreService).load();
        }),
        provideClientHydration(
            withEventReplay(),
            withHttpTransferCacheOptions({
                filter: (req) => !isBackendApiRequest(req.url),
            }),
        ),
        //provideServerRendering(withRoutes(serverRoutes)),
    ],
};

function resolveApiBasePath(basePath: string): string {
    const request = inject(REQUEST, { optional: true });

    if (!basePath.startsWith('/')) {
        return basePath;
    }

    if (request) {
        return new URL(basePath, request.url).toString();
    }

    return basePath;
}
