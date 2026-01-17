import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/content-similarity/content-similarity.component').then(
        (m) => m.ContentSimilarityComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
