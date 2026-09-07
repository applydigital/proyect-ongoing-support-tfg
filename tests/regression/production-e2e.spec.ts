/**
 * Regression E2E — Production
 *
 * Cubre: Hobbs · Phase Eight · Inside Story × UK · AU · EU · ROW · DACH
 *
 * Flujo:
 *   Home → búsqueda → PLP → PDP → añadir al carrito → checkout → PARA antes del pago
 *
 * No se completa ningún pago real. El test verifica que el botón de
 * confirmar pedido es visible y accesible, luego termina.
 *
 * Ejecución:
 *   npm run test:regression:prod
 */

import { test, expect } from '@playwright/test';
import { regressionBrands, regions } from '@data/regression.data';
import { guestEmail, shippingAddress } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { SearchResultsPage } from '@pages/common/search-results.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';

for (const brand of regressionBrands) {
  for (const region of regions) {
    const baseUrl = brand.prodUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

    test.describe(`[${brand.name}] [${region.name}] Production regression`, () => {

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

      test('add to cart → basket has item', { tag: '@non-transactional' }, async ({ page }) => {
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

      test('checkout is reachable — stops before payment', { tag: '@non-transactional' }, async ({ page }) => {
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

        // Verificamos que el paso de pago es accesible — no se confirma el pedido
        const placeOrderVisible = await checkout.isPlaceOrderVisible();
        expect(
          placeOrderVisible,
          `[${brand.name}][${region.name}] El paso de pago debería ser visible en producción`
        ).toBe(true);
      });

    });
  }
}
