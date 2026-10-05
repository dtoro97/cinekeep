import { Injectable } from '@angular/core';

import { map, shareReplay } from 'rxjs';

import { GenreRestControllerService, ItemWithNameAndId } from '../../api';
import { hasIdAndName } from '../utils/has-id-and-name';

@Injectable({ providedIn: 'root' })
export class GenreService {
    readonly movieGenres$ = this.genreRestControllerService.genreMovieList().pipe(
        map((response) => toGenreMap(response.genres)),
        shareReplay(1),
    );

    readonly tvGenres$ = this.genreRestControllerService.genreTvList().pipe(
        map((response) => toGenreMap(response.genres)),
        shareReplay(1),
    );

    constructor(private readonly genreRestControllerService: GenreRestControllerService) {}
}

const toGenreMap = (genres: readonly ItemWithNameAndId[] | undefined): Map<number, string> =>
    new Map((genres ?? []).filter(hasIdAndName).map(({ id, name }) => [id, name]));
