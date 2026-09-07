/**
 * Datos para la suite de regresión cross-site multi-región.
 *
 * Regiones por marca (no todas comparten las mismas):
 *   Hobbs:        UK · AU · US · ROW
 *   Phase Eight:  UK · AU · EU · ROW
 *   Inside Story: UK
 *
 * DACH (solo Phase Eight) se gestiona aparte en staging-dach / production-dach.
 */

type Region = { name: string; path: string };

type BrandData = {
  name: string;
  stagingUrl: string;
  prodUrl: string;
  searchTerm: string;
  categoryPath: string;
  expectedTitlePattern: RegExp;
  regions: Region[];
};

export const regressionBrands: BrandData[] = [
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
    searchTerm: 'table',
    categoryPath: '/all-products/',
    expectedTitlePattern: /Inside Story/i,
    regions: [
      { name: 'UK', path: '/' },
    ],
  },
];

// DACH — solo Phase Eight tiene región alemana
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
