import { Routes } from '@angular/router';
import { EpisodeDetailComponent } from './episode-detail-page/episode-detail.component';
import { SeasonDetailPageComponent } from './season-detail-page/season-detail-page.component';
import { MediaWrapperComponent } from './media-wrapper/media-wrapper.component';
import { VideosPageComponent } from './videos-page/videos-page.component';
import { MediaCastPageComponent } from './media-cast-page/media-cast-page.component';
import { MediaPhotosPageComponent } from './photos-page/media-photos-page.component';
import { MediaReviewsPageComponent } from './reviews-page/reviews-page.component';
import { ReviewDetailPageComponent } from './review-detail-page/review-detail-page.component';
import { SeasonPhotosPageComponent } from './season-photos-page/season-photos-page.component';
import { EpisodePhotosPageComponent } from './episode-photos-page/episode-photos-page.component';
import { MediaDetailPageComponent } from './media-detail-page/media-detail-page.component';

export const mediaRoutes: Routes = [
    {
        path: ':id/:type',
        component: MediaWrapperComponent,
        data: {
            seoDescription:
                'Explore movie and TV series details, cast, trailers, photos, reviews, and recommendations on CineKeep.',
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
                component: SeasonPhotosPageComponent,
            },
            {
                path: 'episodes/:seasonNumber/:episodeNumber/photos',
                component: EpisodePhotosPageComponent,
            },
            {
                path: 'episodes/:seasonNumber/:episodeNumber',
                component: EpisodeDetailComponent,
            },
            {
                path: 'episodes/:seasonNumber',
                component: SeasonDetailPageComponent,
            },
            {
                path: 'videos',
                component: VideosPageComponent,
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
