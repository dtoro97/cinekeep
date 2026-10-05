import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LocaleStoreService } from '../services/locale-store.service';
import { environment } from '../../../environments/environment';

const TMDB_BASE = environment.apiUrl;
const TMDB_ORIGIN = 'https://api.themoviedb.org/3';
const EXCLUDED_URLS = ['/images', '/videos'];

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
    if (!isTmdbV3Request(req.url) || EXCLUDED_URLS.some((excl) => req.url.includes(excl))) {
        return next(req);
    }

    const localeStore = inject(LocaleStoreService);
    let params = req.params;

    if (!params.has('language')) {
        params = params.set('language', localeStore.language());
    }

    return next(req.clone({ params }));
};

function isTmdbV3Request(url: string): boolean {
    return url.startsWith(TMDB_BASE) || url.startsWith(TMDB_ORIGIN);
}
