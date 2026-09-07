/**
 * Datos para la suite de regresión cross-site multi-región.
 *
 * Cada marca define su URL de staging/producción y sus regiones disponibles.
 * No todas las marcas tienen las mismas regiones (Hobbs no tiene EU, Inside
 * Story solo UK). El export `regions` global se conserva por compatibilidad
 * con `production-e2e.spec.ts`, pero las specs nuevas deberían usar
 * `brand.regions`.
 */

// Regiones legacy (mantener hasta migrar production-e2e.spec.ts)
export const regions = [
  { name: 'UK',  path: '/' },
  { name: 'AU',  path: '/au/' },
  { name: 'EU',  path: '/eu/' },
  { name: 'ROW', path: '/row/' },
];

// DACH se trata aparte: sitio en alemán, términos de búsqueda distintos
export const dachRegion = { name: 'DACH', path: '/de/' };

export const dachBrands = [
  {
    name: 'Hobbs',
    stagingUrl: process.env.HOBBS_BASE_URL ?? 'https://stage.hobbs.com',
    prodUrl: process.env.HOBBS_PROD_URL ?? 'https://www.hobbs.com',
    searchTerm: 'Kleid',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Hobbs/i,
  },
  {
    name: 'Phase Eight',
    stagingUrl: process.env.PHASE_EIGHT_BASE_URL ?? 'https://stage.phase-eight.com',
    prodUrl: process.env.PHASE_EIGHT_PROD_URL ?? 'https://www.phase-eight.com',
    searchTerm: 'Kleid',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Phase Eight/i,
  },
  {
    name: 'Inside Story',
    stagingUrl: process.env.INSIDE_STORY_BASE_URL ?? 'https://stage.insidestory.com',
    prodUrl: process.env.INSIDE_STORY_PROD_URL ?? 'https://www.insidestory.com',
    searchTerm: 'Kleid',
    categoryPath: '/all-products/',
    expectedTitlePattern: /Inside Story/i,
  },
];

type Region = { name: string; path: string };

type RegressionBrand = {
  name: string;
  stagingUrl: string;
  prodUrl: string;
  searchTerm: string;
  categoryPath: string;
  expectedTitlePattern: RegExp;
  regions: Region[];
};

export const regressionBrands: RegressionBrand[] = [
  {
    name: 'Hobbs',
    stagingUrl: process.env.HOBBS_BASE_URL ?? 'https://stage.hobbs.com',
    prodUrl: process.env.HOBBS_PROD_URL ?? 'https://www.hobbs.com',
    searchTerm: 'dress',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Hobbs/i,
    regions: [
      { name: 'UK',  path: '/' },
      { name: 'AU',  path: '/au/' },
      { name: 'US',  path: '/us/' },
      { name: 'ROW', path: '/row/' },
    ],
  },
  {
    name: 'Phase Eight',
    stagingUrl: process.env.PHASE_EIGHT_BASE_URL ?? 'https://stage.phase-eight.com',
    prodUrl: process.env.PHASE_EIGHT_PROD_URL ?? 'https://www.phase-eight.com',
    searchTerm: 'dress',
    categoryPath: '/clothing/',
    expectedTitlePattern: /Phase Eight/i,
    regions: [
      { name: 'UK',  path: '/' },
      { name: 'AU',  path: '/au/' },
      { name: 'EU',  path: '/eu/' },
      { name: 'ROW', path: '/row/' },
    ],
  },
  {
    name: 'Inside Story',
    stagingUrl: process.env.INSIDE_STORY_BASE_URL ?? 'https://stage.insidestory.com',
    prodUrl: process.env.INSIDE_STORY_PROD_URL ?? 'https://www.insidestory.com',
    searchTerm: 'dress',
    categoryPath: '/all-products/',
    expectedTitlePattern: /Inside Story/i,
    regions: [
      { name: 'UK', path: '/' },
    ],
  },
];
