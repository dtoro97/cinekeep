import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { combineLatest, distinctUntilChanged, EMPTY, filter, map, startWith, switchMap, tap } from 'rxjs';

import { buildTmdbImageUrl, SeoService } from '../../shared';
import { PersonDetailStoreService, PersonWithExternalIds } from './person-detail-store.service';

@Component({
    selector: 'app-person-detail-wrapper',
    template: '<router-outlet />',
    imports: [RouterOutlet],
    providers: [PersonDetailStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailWrapperComponent {
    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private personDetailStore: PersonDetailStoreService,
        private seo: SeoService,
    ) {
        this.route.paramMap
            .pipe(
                map((params) => Number(params.get('personId'))),
                switchMap((personId) => {
                    if (!Number.isFinite(personId) || personId <= 0) {
                        this.router.navigate(['not-found']);
                        return EMPTY;
                    }

                    return this.personDetailStore.getPersonDetails$(personId);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();

        combineLatest([this.personDetailStore.personDetailVm$, this.currentUrl$()])
            .pipe(
                map(([vm, url]) => ({
                    person: vm.person.state === 'success' ? vm.person.data : null,
                    knownForTitles:
                        vm.knownFor.state === 'success'
                            ? vm.knownFor.data
                                  .map((item) => item.title)
                                  .filter(Boolean)
                                  .slice(0, 3)
                            : [],
                    url,
                })),
                filter(
                    (
                        value,
                    ): value is {
                        readonly person: PersonWithExternalIds;
                        readonly knownForTitles: string[];
                        readonly url: string;
                    } =>
                        !!value.person,
                ),
                tap(({ person, knownForTitles, url }) => {
                    const isPhotosPage = url.split('?')[0]?.endsWith('/photos') ?? false;
                    const title = isPhotosPage
                        ? `${person.name} | Photos`
                        : `${person.name} | People`;
                    const description = buildPersonDescription(
                        person,
                        knownForTitles,
                        isPhotosPage,
                    );

                    this.seo.setPage({
                        title,
                        description,
                        image: buildTmdbImageUrl(person.profile_path, 'w780'),
                        imageAlt: `${person.name} profile photo`,
                        type: 'profile',
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    private currentUrl$() {
        return this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map((event) => event.urlAfterRedirects),
            startWith(this.router.url),
            distinctUntilChanged(),
        );
    }
}

const buildPersonDescription = (
    person: PersonWithExternalIds,
    knownForTitles: readonly string[],
    isPhotosPage: boolean,
): string => {
    const knownFor = knownForTitles.length
        ? `Known for: ${knownForTitles.join(', ')}.`
        : null;

    if (isPhotosPage) {
        return [knownFor, `Photos of ${person.name} on CineKeep.`]
            .filter(Boolean)
            .join(' ');
    }

    return [
        knownFor,
        person.biography ||
            `Explore ${person.name}'s biography, credits, photos, and known-for titles on CineKeep.`,
    ]
        .filter(Boolean)
        .join(' ');
};
