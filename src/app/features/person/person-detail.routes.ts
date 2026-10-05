import { Routes } from '@angular/router';
import { PersonDetailPageComponent } from './person-detail-page/person-detail-page.component';
import { PersonPhotosPageComponent } from './person-photos-page/person-photos-page.component';
import { PersonDetailWrapperComponent } from './person-detail-wrapper.component';

export const personDetailRoutes: Routes = [
    {
        path: ':personId',
        component: PersonDetailWrapperComponent,
        data: {
            seoDescription:
                'Explore a person profile with biography, movie and TV credits, known-for titles, and photos.',
            seoType: 'profile',
        },
        children: [
            {
                path: '',
                component: PersonDetailPageComponent,
            },
            {
                path: 'photos',
                component: PersonPhotosPageComponent,
            },
        ],
    },
];
