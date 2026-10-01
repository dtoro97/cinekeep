import { Injectable } from '@angular/core';

import { map, Observable, shareReplay } from 'rxjs';

import { GenreRestControllerService } from '../../api';
import type { MediaType } from '../types';
import { isDefined } from '../utils';

@Injectable({
    providedIn: 'root',
})
export class GenreService {
    readonly movieGenres$ = this.genreService.genreMovieList().pipe(
        map((response) => this.toGenreMap(response.genres)),
        shareReplay(1),
    );

    readonly tvGenres$ = this.genreService.genreTvList().pipe(
        map((response) => this.toGenreMap(response.genres)),
        shareReplay(1),
    );

    constructor(private readonly genreService: GenreRestControllerService) {}

    getGenreNames(genreIds: number[], mediaType: MediaType): Observable<string[]> {
        const source$ = mediaType === 'movie' ? this.movieGenres$ : this.tvGenres$;

        return source$.pipe(map((genreMap) => genreIds.map((genreId) => genreMap.get(genreId)).filter(isDefined)));
    }

    private toGenreMap(genres: ReadonlyArray<{ id?: number; name?: string }> | null | undefined): Map<number, string> {
        return new Map(
            (genres ?? [])
                .filter(
                    (genre): genre is { id: number; name: string } =>
                        typeof genre.id === 'number' && typeof genre.name === 'string' && genre.name.length > 0,
                )
                .map((genre) => [genre.id, genre.name]),
        );
    }
}
