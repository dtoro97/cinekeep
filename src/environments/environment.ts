declare const __TMDB_API_KEY__: string | undefined;

export const environment = {
  production: true,
  apiUrl: 'https://api.themoviedb.org/3',
  apiV4Url: 'https://api.themoviedb.org/4',
  apiKey:
    typeof __TMDB_API_KEY__ === 'string'
      ? __TMDB_API_KEY__
      : '${API_KEY}',
};
