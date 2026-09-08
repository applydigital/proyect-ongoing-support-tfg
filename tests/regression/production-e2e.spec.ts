/**
 * Regression E2E — Production
 *
 * Cubre: Hobbs · Phase Eight · Inside Story × sus regiones disponibles
 * (definidas en data/regression.data.ts, no todas las marcas tienen las mismas).
 *
 * Flujo:
 *   Home → búsqueda → PDP → añadir al carrito → checkout → PARA antes del pago
 *
 * No se confirma ningún pedido real.
 *
 * Ejecución:
 *   npm run test:regression:prod
 */

import { test, expect } from '@playwright/test';
import { regressionBrands } from '@data/regression.data';
import { guestEmail, shippingAddress } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';
import { ProductListPage } from '@pages/common/product-list.page';

// Ocultar navigator.webdriver antes de cada navegación para evitar detección de bots
// (Globale bloquea el seteo de cookies en modo headless cuando detecta automatización).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
});

for (const brand of regressionBrands) {
  for (const region of brand.regions) {
    const baseUrl = brand.prodUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Production regression`, () => {

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

      test('add to cart → basket has item', { tag: '@non-transactional' }, async ({ page }) => {
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

      test('checkout is reachable — stops before payment', { tag: '@non-transactional' }, async ({ page }) => {
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

        const placeOrderVisible = await checkout.isPlaceOrderVisible();
        expect(
          placeOrderVisible,
          `[${brand.name}][${region.name}] El paso de pago debería ser visible en producción`
        ).toBe(true);
      });

    });
  }
}
