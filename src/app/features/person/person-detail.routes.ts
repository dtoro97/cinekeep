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
                'Biography, movie and TV credits, and photos.',
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
