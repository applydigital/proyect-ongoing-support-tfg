/**
 * Regression E2E — Staging
 *
 * Cubre: Hobbs · Phase Eight · Inside Story × sus regiones disponibles
 * (definidas en data/regression.data.ts, no todas las marcas tienen las mismas).
 *
 * Flujo completo:
 *   Home → búsqueda → PLP → PDP → añadir al carrito → checkout → pago Adyen
 *
 * Ejecución:
 *   npm run test:regression:staging
 */

import { test, expect } from '@playwright/test';
import { regressionBrands } from '@data/regression.data';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { SearchResultsPage } from '@pages/common/search-results.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';

for (const brand of regressionBrands) {
  for (const region of brand.regions) {
    const baseUrl = brand.stagingUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Staging regression`, () => {

      test('homepage loads with correct title', async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        await expect(page).toHaveTitle(brand.expectedTitlePattern);
      });

      test('search returns results', async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        const results: SearchResultsPage = await home.search(brand.searchTerm);
        expect(await results.getProductCount()).toBeGreaterThan(0);
      });

      test('PLP loads with products', async ({ page }) => {
        await page.goto(baseUrl + brand.categoryPath);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        const tiles = page.locator('.product-tile:not([data-cnstrc-item])');
        await expect(tiles.first()).toBeVisible();
        expect(await tiles.count()).toBeGreaterThan(0);
      });

      test('add to cart → basket has item', async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();

        const results: SearchResultsPage = await home.search(brand.searchTerm);
        await results.clickFirstProduct();

        const pdp = new ProductDetailPage(page);
        await pdp.acceptCookiesIfPresent();
        await pdp.dismissModalsIfPresent();
        await pdp.selectFirstAvailableSize();
        const basket: BasketPage = await pdp.addToCartAndGoToBasket();

        expect(await basket.hasItems()).toBe(true);
      });

      test('full checkout with payment', async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();

        const results: SearchResultsPage = await home.search(brand.searchTerm);
        await results.clickFirstProduct();

        const pdp = new ProductDetailPage(page);
        await pdp.acceptCookiesIfPresent();
        await pdp.dismissModalsIfPresent();
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
