/**
 * Regression E2E — Production DACH (DE/AT/CH)
 *
 * Suite separada para la región DACH porque el sitio está en alemán.
 * Para antes del pago — no se confirma ningún pedido real.
 *
 * Ejecución:
 *   npm run test:regression:prod:dach
 */

import { test, expect } from '@playwright/test';
import { dachBrands, dachRegion } from '@data/regression.data';
import { guestEmail, shippingAddress } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { SearchResultsPage } from '@pages/common/search-results.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';

for (const brand of dachBrands) {
  const baseUrl = brand.prodUrl + dachRegion.path.replace(/\/$/, '');

  test.describe(`[${brand.name}] [${dachRegion.name}] Production regression`, () => {

    test('homepage loads with correct brand title', async ({ page }) => {
      await page.goto(baseUrl);
      const home = new HomePage(page);
      await home.acceptCookiesIfPresent();
      await home.dismissModalsIfPresent();
      await expect(page).toHaveTitle(brand.expectedTitlePattern);
    });

    test('search returns results for German term', async ({ page }) => {
      await page.goto(baseUrl);
      const home = new HomePage(page);
      await home.acceptCookiesIfPresent();
      await home.dismissModalsIfPresent();
      const results: SearchResultsPage = await home.search(brand.searchTerm);
      expect(await results.getProductCount()).toBeGreaterThan(0);
    });

    test('PLP loads with products', async ({ page }) => {
      // TODO: verificar si la ruta /clothing/ es válida en DACH o usar /bekleidung/
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

    test('checkout is reachable — stops before payment', async ({ page }) => {
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

      const placeOrderVisible = await checkout.isPlaceOrderVisible();
      expect(
        placeOrderVisible,
        `[${brand.name}][DACH] El paso de pago debería ser visible en producción`
      ).toBe(true);
    });

  });
}
