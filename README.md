# CineKeep

CineKeep is a TMDb-powered movie and TV discovery app. It is basically my take on an IMDb-style browsing experience: search for titles and people, browse curated lists, open detailed pages, and move through cast, episodes, reviews, videos, and photos.

Live site: [https://dtoro97.github.io/cinekeep/](https://dtoro97.github.io/cinekeep/)

This project uses the TMDb API for data and images. It is not endorsed or certified by TMDb.

## What It Does

- Home page with trending titles, popular picks, people, trailers, TV airing today, streaming arrivals, and upcoming movies
- Movie and TV detail pages with overview, cast and crew, episodes, videos, photos, and reviews
- Search across movies, TV series, and people
- Browse pages for popular, top-rated, now-playing, upcoming, and airing titles
- Person detail pages with credits and photos
- Collection pages and streaming/provider browsing
- Account-related pages for watchlists, favorites, ratings, and lists where TMDb account access is available

## Tech Stack

- Angular 21
- TypeScript
- SCSS
- Angular Material/CDK
- RxJS
- `@ngrx/component-store`
- Generated TMDb API clients from OpenAPI specs
- Node SSR build for local rendering and GitHub Pages static deployment

## Running Locally

Prerequisites:

- Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`
- npm
- A TMDb API key or read access token

Install dependencies:

```bash
npm install
```

Add your TMDb token/key to the local environment file:

```text
src/environments/environment.development.ts
```

Then start the dev server:

```bash
npm start
```

The app runs at:

```text
http://localhost:4200
```
