import { Routes } from '@angular/router';
import { PersonDetailsComponent } from './person-detail-page/person-details.component';
import { PersonPhotosPageComponent } from './photos-page/person-photos-page.component';
import { PersonDetailWrapperComponent } from './person-detail-wrapper.component';

export const personDetailRoutes: Routes = [
    {
        path: ':personId',
        component: PersonDetailWrapperComponent,
        data: {
            seoDescription:
                'Explore a person profile, credits, photos, biography, and known-for titles on CineKeep.',
            seoType: 'profile',
        },
        children: [
            {
                path: '',
                component: PersonDetailsComponent,
            },
            {
                path: 'photos',
                component: PersonPhotosPageComponent,
            },
        ],
    },
];
