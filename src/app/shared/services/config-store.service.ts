import { isPlatformBrowser } from '@angular/common';
import {
    Inject,
    Injectable,
    Optional,
    PLATFORM_ID,
    REQUEST,
} from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
    ConfigurationRestControllerService,
    Country,
    Language,
    TmdbConfiguration,
} from '../../api';
import { API_JSON_OPTIONS } from '../../constants';
import { filter, tap } from 'rxjs';
import { isDefined } from '../utils';

export type ConfigStoreState = {
    languages?: Language[];
    countries?: Country[];
    config?: TmdbConfiguration;
};

@Injectable({ providedIn: 'root' })
export class ConfigStoreService extends ComponentStore<ConfigStoreState> {
    languages$ = this.select((state) => state.languages).pipe(
        filter(isDefined),
    );
    countries$ = this.select((state) => state.countries).pipe(
        filter(isDefined),
    );
    configuration$ = this.select((state) => state.config).pipe(
        filter(isDefined),
    );
    constructor(
        private configRestControllerService: ConfigurationRestControllerService,
        @Inject(PLATFORM_ID) private readonly platformId: object,
        @Optional() @Inject(REQUEST) private readonly request: Request | null,
    ) {
        super({});

        if (!this.canLoadAtStartup()) {
            return;
        }

        this.getLanguages$().subscribe();
        this.getCountries$().subscribe();
        this.getConfiguration$().subscribe();
    }

    languages(): readonly Language[] {
        return this.get().languages ?? [];
    }

    getLanguages$() {
        return this.configRestControllerService
            .configurationLanguages(undefined, undefined, API_JSON_OPTIONS)
            .pipe(tap((response) => this.patchState({ languages: response })));
    }

    getCountries$() {
        return this.configRestControllerService
            .configurationCountries(undefined, undefined, undefined, API_JSON_OPTIONS)
            .pipe(tap((response) => this.patchState({ countries: response })));
    }

    getConfiguration$() {
        return this.configRestControllerService
            .configurationDetails(undefined, undefined, API_JSON_OPTIONS)
            .pipe(tap((response) => this.patchState({ config: response })));
    }

    private canLoadAtStartup(): boolean {
        return isPlatformBrowser(this.platformId) || !!this.request;
    }
}
