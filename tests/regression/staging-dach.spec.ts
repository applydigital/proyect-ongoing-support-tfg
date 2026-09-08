/**
 * Regression E2E — Staging DACH (DE/AT/CH)
 *
 * Suite separada para la región DACH porque el sitio está en alemán.
 * Usa "Kleid" como término de búsqueda en lugar de "dress".
 *
 * Nota: verificar que categoryPath (/clothing/) sea válida en la versión
 * alemana — puede ser /bekleidung/ o similar según la configuración de SFCC.
 *
 * Ejecución:
 *   npm run test:regression:staging:dach
 */

import { test, expect } from '@playwright/test';
import { dachBrands, dachRegion } from '@data/regression.data';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';
import { HomePage } from '@pages/common/home.page';
import { SearchResultsPage } from '@pages/common/search-results.page';
import { ProductDetailPage } from '@pages/common/product-detail.page';
import { BasketPage } from '@pages/common/basket.page';
import { CheckoutPage } from '@pages/common/checkout.page';

for (const brand of dachBrands) {
  const baseUrl = brand.stagingUrl + dachRegion.path.replace(/\/$/, '');

  test.describe(`[${brand.name}] [${dachRegion.name}] Staging regression`, () => {

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

      await expect(page).toHaveURL(/order-confirmation|checkout\/receipt|thank-you|bestellbestaetigung/i, { timeout: 30000 });
    });

  });
}
