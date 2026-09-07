/**
 * Datos para la suite de regresión cross-site multi-región.
 *
 * Cada marca define su URL de staging y producción.
 * Las regiones son comunes a las 3 marcas (mismas rutas).
 */

// Regiones generales (inglés)
export const regions = [
  { name: 'UK',  path: '/' },
  { name: 'AU',  path: '/au/' },
  { name: 'EU',  path: '/eu/' },
  { name: 'ROW', path: '/row/' },
];

// DACH se trata aparte: sitio en alemán, términos de búsqueda distintos
export const dachRegion = { name: 'DACH', path: '/de/' };

// DACH es solo Phase Eight — única marca con región alemana
export const dachBrands = [
  {
    name: 'Phase Eight',
    stagingUrl: process.env.PHASE_EIGHT_BASE_URL ?? 'https://stage.phase-eight.com',
    prodUrl: process.env.PHASE_EIGHT_PROD_URL ?? 'https://www.phase-eight.com',
    searchTerm: 'Kleid',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Phase Eight/i,
  },
];

export const regressionBrands = [
  {
    name: 'Hobbs',
    stagingUrl: process.env.HOBBS_BASE_URL ?? 'https://stage.hobbs.com',
    prodUrl: process.env.HOBBS_PROD_URL ?? 'https://www.hobbs.com',
    searchTerm: 'dress',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Hobbs/i,
  },
  {
    name: 'Phase Eight',
    stagingUrl: process.env.PHASE_EIGHT_BASE_URL ?? 'https://stage.phase-eight.com',
    prodUrl: process.env.PHASE_EIGHT_PROD_URL ?? 'https://www.phase-eight.com',
    searchTerm: 'dress',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Phase Eight/i,
  },
  {
    name: 'Inside Story',
    stagingUrl: process.env.INSIDE_STORY_BASE_URL ?? 'https://stage.insidestory.com',
    prodUrl: process.env.INSIDE_STORY_PROD_URL ?? 'https://www.insidestory.com',
    searchTerm: 'table',
    categoryPath: '/all-products/',
    expectedTitlePattern: /Inside Story/i,
  },
];
