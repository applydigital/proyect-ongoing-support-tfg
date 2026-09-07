/**
 * Regression E2E — Staging DACH (DE/AT/CH)
 *
 * Solo Phase Eight — única marca con región alemana.
 * Usa "Kleid" como término de búsqueda.
 *
 * Ejecución:
 *   npm run test:regression:staging:dach
 */

import { test, expect } from '@playwright/test';
import { dachBrands, dachRegion } from '@data/regression.data';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';
import { ProductListPage } from '@pages/common/product-list.page';

for (const brand of dachBrands) {
  const baseUrl = brand.stagingUrl + dachRegion.path.replace(/\/$/, '');

  test.describe(`[${brand.name}] [${dachRegion.name}] Staging regression`, () => {

    test('homepage loads with correct brand title', { tag: '@non-transactional' }, async ({ page }) => {
      await page.goto(baseUrl);
      const home = new HomePage(page);
      await home.acceptCookiesIfPresent();
      await home.dismissModalsIfPresent();
      await expect(page).toHaveTitle(brand.expectedTitlePattern);
    });

    test('search returns results for German term', { tag: '@non-transactional' }, async ({ page }) => {
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

      await expect(page).toHaveURL(/order-confirmation|checkout\/receipt|thank-you|bestellbestaetigung/i, { timeout: 30000 });
    });

  });
}
