import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-not-found',
    templateUrl: './not-found.component.html',
    styleUrl: './not-found.component.scss',
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
    readonly links = [
        { label: 'Popular movies', section: 'Movies', route: '/movies/popular' },
        { label: 'Popular TV series', section: 'TV series', route: '/tv/popular' },
        { label: 'Search', section: 'Search', route: '/search' },
        { label: 'Home', section: 'Home', route: '/' },
    ];
}
