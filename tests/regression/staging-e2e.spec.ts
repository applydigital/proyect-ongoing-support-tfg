/**
 * Regression E2E — Staging
 *
 * Cubre: Hobbs · Phase Eight · Inside Story × UK · AU · EU · ROW · DACH
 *
 * Flujo completo:
 *   Home → búsqueda → PLP → PDP → añadir al carrito → checkout → pago Adyen
 *
 * Ejecución:
 *   npm run test:regression:staging
 */

import { test, expect } from '@playwright/test';
import { regressionBrands, regions } from '@data/regression.data';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { SearchResultsPage } from '@pages/common/search-results.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';

for (const brand of regressionBrands) {
  for (const region of regions) {
    const baseUrl = brand.stagingUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Staging regression`, () => {

      test('homepage loads with correct title', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await expect(page).toHaveTitle(brand.expectedTitlePattern);
      });

      test('search returns results', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        const results: SearchResultsPage = await home.search(brand.searchTerm);
        expect(await results.getProductCount()).toBeGreaterThan(0);
      });

      test('PLP loads with products', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl + brand.categoryPath);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        const tiles = page.locator('.product-tile');
        await expect(tiles.first()).toBeVisible();
        expect(await tiles.count()).toBeGreaterThan(0);
      });

      test('add to cart → basket has item', { tag: '@transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();

        const results: SearchResultsPage = await home.search(brand.searchTerm);
        await results.productTiles.first().locator('a').first().click();
        await page.waitForLoadState('domcontentloaded');

        const pdp = new ProductDetailPage(page);
        await pdp.acceptCookiesIfPresent();
        await pdp.selectFirstAvailableSize();
        const basket: BasketPage = await pdp.addToCartAndGoToBasket();

        expect(await basket.hasItems()).toBe(true);
      });

      test('full checkout with payment', { tag: '@transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();

        const results: SearchResultsPage = await home.search(brand.searchTerm);
        await results.productTiles.first().locator('a').first().click();
        await page.waitForLoadState('domcontentloaded');

        const pdp = new ProductDetailPage(page);
        await pdp.acceptCookiesIfPresent();
        await pdp.selectFirstAvailableSize();
        const basket: BasketPage = await pdp.addToCartAndGoToBasket();

        const checkout: CheckoutPage = await basket.proceedToCheckout();
        await page.waitForLoadState('domcontentloaded');

        await checkout.continueAsGuest(guestEmail);
        await checkout.fillShippingAddress(shippingAddress);
        await checkout.submitShippingMethod();
        await checkout.fillAdyenCard(adyenTestCard);
        await checkout.placeOrder();

        await expect(page).toHaveURL(/order-confirmation|checkout\/receipt|thank-you/i, { timeout: 30000 });
      });

    });
  }
}
