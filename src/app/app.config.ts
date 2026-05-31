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
import { provideApi } from './api/provide-api';
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
        provideApi({
            basePath: environment.apiUrl,
            credentials: {
                bearerAuth: environment.apiKey,
            },
        }),
        {
            provide: V4Configuration,
            useFactory: () => {
                const userSessionStore = inject(UserSessionStoreService);

                return new V4Configuration({
                    basePath: environment.apiV4Url,
                    credentials: {
                        bearerAuth: () =>
                            userSessionStore.v4AccessToken() ??
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
