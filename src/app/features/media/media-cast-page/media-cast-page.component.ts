import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    remoteData,
    SeoService,
    SkeletonComponent,
    SubPageHeaderComponent,
    ToggleGroupComponent,
    ToggleGroupOption,
} from '../../../shared';
import { CastCrewGridComponent } from '../cast-crew-grid/cast-crew-grid.component';
import { countCrewPeople, filterCreditPeople, toCastPeople, toCrewDepartments } from '../mappers/cast-crew.mapper';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

type CreditSection = 'cast' | 'crew';

const ALL_DEPARTMENTS = 'all';

@Component({
    selector: 'app-media-cast-crew',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        CastCrewGridComponent,
        EmptyStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        SkeletonComponent,
        SubPageHeaderComponent,
        ToggleGroupComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './media-cast-page.component.html',
    styleUrl: './media-cast-page.component.scss',
})
export class MediaCastPageComponent {
    private readonly section = signal<CreditSection>('cast');
    private readonly query = signal('');
    private readonly department = signal(ALL_DEPARTMENTS);

    /** Credits mapped once per load; the filters below only narrow them. */
    private readonly credits$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        creditsState: this.mediaCreditsStore.creditsState$,
    }).pipe(
        map(({ mediaState, creditsState }) => {
            const credits = remoteData(creditsState, { cast: [], crew: [] });
            const castPeople = toCastPeople(credits.cast);
            const departments = toCrewDepartments(credits.crew);

            return {
                media: mediaState.state === 'success' ? mediaState.data : null,
                castPeople,
                departments,
                crewCount: countCrewPeople(departments),
                isLoading: creditsState.state === 'loading',
                isEmpty: creditsState.state === 'success' && !castPeople.length && !departments.length,
            };
        }),
    );

    readonly vm$ = combineLatest({
        credits: this.credits$,
        section: toObservable(this.section),
        query: toObservable(this.query),
        department: toObservable(this.department),
    }).pipe(
        map(({ credits, section, query, department }) => {
            const { castPeople, departments, crewCount } = credits;
            const activeSection: CreditSection = !castPeople.length ? 'crew' : !departments.length ? 'cast' : section;
            const normalizedQuery = query.trim().toLocaleLowerCase();
            const cast = filterCreditPeople(castPeople, normalizedQuery);
            const visibleDepartments = departments
                .filter((item) => department === ALL_DEPARTMENTS || item.id === department)
                .map((item) => ({ ...item, people: filterCreditPeople(item.people, normalizedQuery) }))
                .filter((item) => item.people.length);
            const hasMatches = activeSection === 'cast' ? cast.length > 0 : visibleDepartments.length > 0;

            return {
                media: credits.media,
                isLoading: credits.isLoading,
                isEmpty: credits.isEmpty,
                query,
                showCast: activeSection === 'cast',
                showDepartments: activeSection === 'crew' && departments.length > 1,
                sectionOptions: [
                    ...(castPeople.length ? [{ label: `Cast (${castPeople.length})`, value: 'cast' }] : []),
                    ...(crewCount ? [{ label: `Crew (${crewCount})`, value: 'crew' }] : []),
                ] satisfies ToggleGroupOption[],
                section: activeSection,
                departmentOptions: [
                    { label: 'All', value: ALL_DEPARTMENTS },
                    ...departments.map((item) => ({ label: item.name, value: item.id })),
                ] satisfies ToggleGroupOption[],
                department,
                cast,
                departments: visibleDepartments,
                noMatchesText: hasMatches || credits.isLoading ? null : `No one matches “${query.trim()}”.`,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaCreditsStore: MediaCreditsStoreService,
        private readonly seo: SeoService,
    ) {
        this.mediaStore.currentTarget$
            .pipe(
                switchMap((target) => this.mediaCreditsStore.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaStore.mediaDetailsState$
            .pipe(
                takeUntilDestroyed(),
                map((state) => (state.state === 'success' ? state.data : null)),
                filter((media): media is MediaDetails => !!media),
                tap((media) => this.seo.setPage(toMediaSectionSeoMetadata(media, 'Cast & Crew'))),
            )
            .subscribe();
    }

    onSectionChange(value: unknown): void {
        if (value === 'cast' || value === 'crew') {
            this.section.set(value);
        }
    }

    onDepartmentChange(value: unknown): void {
        if (typeof value === 'string') {
            this.department.set(value);
        }
    }

    onQueryInput(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.query.set(event.target.value);
        }
    }

    clearQuery(): void {
        this.query.set('');
    }
}
