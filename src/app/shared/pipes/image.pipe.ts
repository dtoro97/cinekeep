import { Pipe, PipeTransform } from '@angular/core';

import { buildTmdbImageUrl } from '../utils/tmdb-image';

const MISSING_POSTER_URL = 'https://placehold.jp/8a8a8a/fcfcfc/500x750.jpg?text=No%20Poster';

@Pipe({
    name: 'imgSrc',
})
export class ImagePipe implements PipeTransform {
    transform(value?: string | null, options = 'w300'): string {
        return buildTmdbImageUrl(value, options) ?? MISSING_POSTER_URL;
    }
}
