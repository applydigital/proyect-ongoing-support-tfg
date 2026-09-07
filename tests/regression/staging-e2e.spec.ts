/**
 * Regression E2E — Staging
 *
 * Hobbs (UK · AU · US · ROW) · Phase Eight (UK · AU · EU · ROW) · Inside Story (UK)
 *
 * Flujo completo:
 *   Home → búsqueda → PDP → añadir al carrito → checkout → pago Adyen
 *
 * Ejecución:
 *   npm run test:regression:staging
 */

import { test, expect } from '@playwright/test';
import { regressionBrands } from '@data/regression.data';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';
import { ProductListPage } from '@pages/common/product-list.page';

for (const brand of regressionBrands) {
  for (const region of brand.regions) {
    const baseUrl = brand.stagingUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Staging regression`, () => {

      test('homepage loads with correct title', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        await expect(page).toHaveTitle(brand.expectedTitlePattern);
      });

      test('search returns results', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        const results = await home.search(brand.searchTerm);
        expect(await results.getProductCount()).toBeGreaterThan(0);
      });

      test('PLP loads with products', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl + brand.categoryPath);
        const plp = new ProductListPage(page);
        await plp.acceptCookiesIfPresent();
        await plp.dismissModalsIfPresent();
        await plp.waitForLoaded();
        expect(await plp.getProductCount()).toBeGreaterThan(0);
      });

      test('add to cart → basket has item', { tag: '@transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();

        const results = await home.search(brand.searchTerm);
        const pdp: ProductDetailPage = await results.clickFirstProduct();
        await pdp.selectFirstAvailableSize();
        const basket: BasketPage = await pdp.addToCartAndGoToBasket();

        expect(await basket.hasItems()).toBe(true);
      });

      test('full checkout with payment', { tag: '@transactional' }, async ({ page }) => {
        await page.goto(baseUrl);
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();

        const results = await home.search(brand.searchTerm);
        const pdp: ProductDetailPage = await results.clickFirstProduct();
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
