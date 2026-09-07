/**
 * Cross-Site Sanity Suite — Hobbs · Phase Eight · Inside Story
 *
 * 5 checks por marca/región:
 *   1. Homepage responde con 200
 *   2. Búsqueda devuelve resultados
 *   3. PLP carga con productos
 *   4. PDP carga correctamente (botón add-to-cart visible)
 *   5. Footer visible
 *
 * Entorno:
 *   TARGET_ENV=staging     → staging SFCC (por defecto)
 *   TARGET_ENV=production  → producción real
 *
 * Ejecución:
 *   npm run test:sanity
 *   $env:TARGET_ENV="production"; npm run test:sanity   (PowerShell)
 */

import { test, expect } from '@playwright/test';
import { sanitySiteData, targetEnv } from '@data/sanity.data';
import { HomePage } from '@pages/common/home.page';
import { ProductListPage } from '@pages/common/product-list.page';

test.beforeAll(() => {
  console.log(`[Sanity Suite] Target environment: ${targetEnv.toUpperCase()}`);
});

for (const brand of sanitySiteData) {
  for (const region of brand.regions) {
    const baseUrl = (targetEnv === 'production' ? brand.prodUrl : brand.stagingUrl)
      + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    const searchTerm = region.searchTerm ?? brand.searchTerm;

    test.describe(`[${brand.name}] [${region.name}]`, () => {

      test('homepage responds with 200', { tag: '@non-transactional' }, async ({ page }) => {
        const response = await page.goto(baseUrl);
        expect(
          response?.status(),
          `${brand.name} [${region.name}] homepage should return 200`
        ).toBe(200);
      });

      test('search returns product results', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        const results = await home.search(searchTerm);
        expect(
          await results.getProductCount(),
          `Expected products for "${searchTerm}" on ${brand.name} [${region.name}]`
        ).toBeGreaterThan(0);
      });

      test('PLP loads with products', { tag: '@non-transactional' }, async ({ page }) => {
        const response = await page.goto(baseUrl + brand.categoryPath);
        expect(response?.status()).toBe(200);
        const plp = new ProductListPage(page);
        await plp.acceptCookiesIfPresent();
        await plp.dismissModalsIfPresent();
        await plp.waitForLoaded();
        expect(
          await plp.getProductCount(),
          `Expected products on ${brand.name} [${region.name}] PLP`
        ).toBeGreaterThan(0);
      });

      test('PDP loads and add-to-cart is available', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl + brand.categoryPath);
        const plp = new ProductListPage(page);
        await plp.acceptCookiesIfPresent();
        await plp.dismissModalsIfPresent();
        await plp.waitForLoaded();
        const pdp = await plp.clickFirstProduct();
        // Verifica que el botón de añadir al carrito es visible — señal de que la PDP cargó correctamente
        await expect(pdp.addToCartButton).toBeVisible();
      });

      test('footer is visible', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        await expect(page.locator('footer').first()).toBeVisible();
      });

    });
  }
}
