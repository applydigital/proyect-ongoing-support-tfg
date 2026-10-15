/**
 * Regression E2E — Staging
 *
 * Cubre: Hobbs · Phase Eight · Inside Story × sus regiones disponibles
 * (definidas en data/regression.data.ts, no todas las marcas tienen las mismas).
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
        // ROW no pasa por el checkout nativo SFCC/Adyen: usa el checkout internacional de
        // GlobalE (otro dominio, otra marca visual, formulario de email propio, sin Adyen).
        // Confirmado con captura en staging el 06/10 — no es timing, es una página distinta que
        // CheckoutPage no soporta. Hasta que se automatice ese flujo, se deja como limitación
        // conocida en vez de fallar cada corrida esperando algo que nunca va a aparecer.
        test.skip(region.name === 'ROW', 'ROW usa el checkout internacional de GlobalE (sin Adyen) — no automatizado todavía');

        // El flujo completo (popups, widget de direcciones, Adyen) en staging supera los 90s por
        // defecto. test.slow() (x3 = 270s) no alcanzaba en días de stage lento — confirmado:
        // 5 de 6 regiones dieron timeout justo ahí. Se fija un valor explícito más amplio.
        test.setTimeout(420_000);
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

        // En Hobbs/Phase Eight la confirmación es /secure/checkout/confirmation/?ID=...
        await expect(page).toHaveURL(/order-confirmation|checkout\/confirmation|checkout\/receipt|thank-you/i, { timeout: 30000 });
      });

    });
  }
}
