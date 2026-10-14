import { Routes } from '@angular/router';

import { authenticatedGuard } from '../../shared';
import { UserFavouritesPageComponent } from './user-favourites-page/user-favourites-page.component';
import { UserListCreatePageComponent } from './user-list-create-page/user-list-create-page.component';
import { UserListDetailPageComponent } from './user-list-detail-page/user-list-detail-page.component';
import { UserListsPageComponent } from './user-lists-page/user-lists-page.component';
import { UserProfilePageComponent } from './user-profile-page/user-profile-page.component';
import { UserRatingsPageComponent } from './user-ratings-page/user-ratings-page.component';
import { UserWatchlistPageComponent } from './user-watchlist-page/user-watchlist-page.component';

export const userRoutes: Routes = [
    {
        path: '',
        canActivate: [authenticatedGuard],
        children: [
            {
                path: '',
                pathMatch: 'full',
                component: UserProfilePageComponent,
                title: 'Your Profile',
            },
            {
                path: 'lists/new',
                component: UserListCreatePageComponent,
                title: 'Create List',
            },
            {
                path: 'watchlists',
                component: UserWatchlistPageComponent,
                title: 'Your Watchlist',
            },
            {
                path: 'favorites',
                component: UserFavouritesPageComponent,
                title: 'Your Favorites',
            },
            {
                path: 'ratings',
                component: UserRatingsPageComponent,
                title: 'Your Ratings',
            },
            {
                path: 'lists/:listId',
                component: UserListDetailPageComponent,
            },
            {
                path: 'lists',
                component: UserListsPageComponent,
                title: 'Your Lists',
            },
        ],
    },
];
