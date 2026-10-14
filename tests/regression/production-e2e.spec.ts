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
import { guestEmail } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';
import { ProductListPage } from '@pages/common/product-list.page';

// Ocultar navigator.webdriver antes de cada navegación para evitar detección de bots.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
});

for (const brand of regressionBrands) {
  for (const region of brand.regions) {
    const baseUrl = brand.prodUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Production regression`, () => {

      // Los sites de producción cargan analytics pesados que retrasan el cierre del contexto.
      // 150s garantiza tiempo suficiente tanto para el cuerpo del test como para teardown.
      test.setTimeout(150000);

      test('homepage loads with correct title', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        const home = new HomePage(page);
        await home.acceptCookiesIfPresent();
        await home.dismissModalsIfPresent();
        await expect(page).toHaveTitle(brand.expectedTitlePattern);
      });

      test('search returns results', { tag: '@non-transactional' }, async ({ page }) => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
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
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
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
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
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

        // Verificar que el formulario de entrega es visible — suficiente para confirmar
        // que el checkout es accesible. No se completa el pedido en producción.
        const deliveryFormVisible = await checkout.isDeliveryFormVisible();
        expect(
          deliveryFormVisible,
          `[${brand.name}][${region.name}] El formulario de entrega debería ser visible en producción`
        ).toBe(true);
      });

    });
  }
}
