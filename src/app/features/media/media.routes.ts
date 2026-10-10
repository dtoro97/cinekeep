import { Routes } from '@angular/router';
import { EpisodeDetailPageComponent } from './episode-detail-page/episode-detail-page.component';
import { SeasonDetailPageComponent } from './season-detail-page/season-detail-page.component';
import { MediaWrapperComponent } from './media-wrapper/media-wrapper.component';
import { MediaVideosPageComponent } from './media-videos-page/media-videos-page.component';
import { MediaCastPageComponent } from './media-cast-page/media-cast-page.component';
import { MediaPhotosPageComponent } from './media-photos-page/media-photos-page.component';
import { MediaReviewsPageComponent } from './media-reviews-page/media-reviews-page.component';
import { ReviewDetailPageComponent } from './review-detail-page/review-detail-page.component';
import { EpisodePhotosPageComponent } from './episode-photos-page/episode-photos-page.component';
import { MediaDetailPageComponent } from './media-detail-page/media-detail-page.component';

export const mediaRoutes: Routes = [
    {
        path: ':id/:type',
        component: MediaWrapperComponent,
        data: {
            seoDescription:
                'Explore movie and TV series details, cast, trailers, photos, reviews, ratings, and episodes.',
        },
        children: [
            {
                path: '',
                component: MediaDetailPageComponent,
            },
            {
                path: 'cast',
                component: MediaCastPageComponent,
            },
            {
                path: 'episodes',
                component: SeasonDetailPageComponent,
            },
            {
                path: 'episodes/:seasonNumber/photos',
                redirectTo: 'episodes/:seasonNumber',
            },
            {
                path: 'episodes/:seasonNumber/:episodeNumber/cast',
                component: MediaCastPageComponent,
            },
            {
                path: 'episodes/:seasonNumber/:episodeNumber/photos',
                component: EpisodePhotosPageComponent,
            },
            {
                path: 'episodes/:seasonNumber/:episodeNumber',
                component: EpisodeDetailPageComponent,
            },
            {
                path: 'episodes/:seasonNumber',
                component: SeasonDetailPageComponent,
            },
            {
                path: 'videos',
                component: MediaVideosPageComponent,
            },
            {
                path: 'photos',
                component: MediaPhotosPageComponent,
            },
            {
                path: 'reviews',
                component: MediaReviewsPageComponent,
            },
            {
                path: 'reviews/:reviewId',
                component: ReviewDetailPageComponent,
            },
        ],
    },
];
