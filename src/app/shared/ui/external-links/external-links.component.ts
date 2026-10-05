import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';

import { ExternalIds, TvExternalIds } from '../../../api';

export interface ExternalLink {
    readonly url: string;
    readonly label: string;
    readonly iconClass: string;
    /** The official website sits apart from the social profiles. */
    readonly hasDividerBefore: boolean;
}

/** The social profiles and official website of a title or person; `null` when there is nothing to link to. */
export const buildExternalLinks = ({
    links,
    homepage,
    imdbType,
}: {
    readonly links: ExternalIds | TvExternalIds | null | undefined;
    readonly homepage: string | null | undefined;
    readonly imdbType: 'name' | 'title';
}): ExternalLink[] | null => {
    const profiles = [
        { id: links?.facebook_id, label: 'Facebook', iconClass: 'fa-brands fa-facebook', baseUrl: 'https://facebook.com/' },
        { id: links?.imdb_id, label: 'IMDb', iconClass: 'fa-brands fa-imdb', baseUrl: `https://imdb.com/${imdbType}/` },
        {
            id: links?.instagram_id,
            label: 'Instagram',
            iconClass: 'fa-brands fa-instagram',
            baseUrl: 'https://instagram.com/',
        },
        { id: links?.twitter_id, label: 'X', iconClass: 'fa-brands fa-x-twitter', baseUrl: 'https://twitter.com/' },
    ].flatMap(({ id, label, iconClass, baseUrl }) =>
        id ? [{ url: `${baseUrl}${id}`, label, iconClass, hasDividerBefore: false }] : [],
    );
    const externalLinks = homepage
        ? [
              ...profiles,
              {
                  url: homepage,
                  label: 'Official website',
                  iconClass: 'fa-solid fa-link',
                  hasDividerBefore: profiles.length > 0,
              },
          ]
        : profiles;

    return externalLinks.length ? externalLinks : null;
};

@Component({
    selector: 'app-external-links',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDividerModule],
    templateUrl: './external-links.component.html',
    styleUrl: './external-links.component.scss',
})
export class ExternalLinksComponent {
    @Input() externalLinks: readonly ExternalLink[] | null = null;
}
