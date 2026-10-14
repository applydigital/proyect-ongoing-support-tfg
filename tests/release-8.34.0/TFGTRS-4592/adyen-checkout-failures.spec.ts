/**
 * TFGTRS-4592 — TFG Adyen checkout failures (HB-UK, WH-UK, P8-UK).
 *
 * Test plan del ticket (comentario del 2026-10-06):
 *   1. Sin método de pago seleccionado → Place order debe rechazar el pedido con el
 *      mensaje de validación existente (comportamiento visible al shopper sin cambios),
 *      sin spamear el log de errores de Adyen (eso lo verifica dev/BM, no este test).
 *   2. Happy path — Adyen card component con state data válida → el pedido se confirma,
 *      sin regresión.
 *   3. Happy path — método no-Adyen (ej. PayPal) → no se toca aquí: por política del
 *      proyecto solo la tarjeta de test Adyen está automatizada (ver checkout.data.ts).
 *
 * Entorno: dev (no hay project de Playwright para "dev" — se usan URLs absolutas,
 * igual que el resto de specs de manage-service). Solo tarjeta de test Adyen, nunca
 * en producción.
 */
import { test, expect } from '@fixtures/pages.fixture';
import { guestEmail, shippingAddress, adyenTestCard } from '@data/checkout.data';

const BRANDS = [
  { name: 'Hobbs (HB-UK)', pdp: 'https://dev.hobbs.com/product/libby-cotton-paisley-dress/0126-5481-1144L00-BLUE-MULTI.html' },
  { name: 'Phase Eight (P8-UK)', pdp: 'https://dev.phase-eight.com/product/yasmine-cover-up-10000480785.html' },
  // Whistles usa checkout React/SPC distinto: los Page Objects SFRA no lo cubren (se prueba a mano).
];

for (const brand of BRANDS) {
  test.describe(`[${brand.name}]`, () => {
    test.setTimeout(120000);

    // Evita el popup/redirect de GlobalE por IP no-UK (mismo patrón que TFGTRS-4066 / 4285).
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{
        name: 'GlobalE_Data',
        value: JSON.stringify({ countryCode: 'GB', currencyCode: 'GBP', cultureCode: 'en-GB', countryName: 'United Kingdom', isSelected: true }),
        domain: new URL(brand.pdp).hostname, path: '/', httpOnly: false, secure: true, sameSite: 'None',
      }]);
    });

    test('Scenario 1: no payment method selected — Place order is rejected without crashing', async ({
      page, productDetailPage,
    }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (e) => consoleErrors.push(e.message));
      let submitPaymentStatus: number | null = null;
      page.on('response', (r) => {
        if (/CheckoutServices-SubmitPayment/i.test(r.url())) submitPaymentStatus = r.status();
      });

      await page.goto(brand.pdp, { waitUntil: 'load' });
      await productDetailPage.acceptCookiesIfPresent();
      await productDetailPage.waitForLoaded();
      await productDetailPage.selectFirstAvailableSize();
      const basket = await productDetailPage.addToCartAndGoToBasket();
      await basket.waitForLoaded();
      expect(await basket.hasItems(), `${brand.name}: el carrito debería tener al menos 1 artículo`).toBeTruthy();

      const checkout = await basket.proceedToCheckout();
      await checkout.continueAsGuest(guestEmail);
      await checkout.fillShippingAddress(shippingAddress);
      await checkout.submitShippingMethod();

      const reachedPayment = await checkout.isPlaceOrderVisible();
      expect(reachedPayment, `${brand.name}: debería llegar al paso de pago`).toBeTruthy();

      await page.screenshot({ path: `tests/release-8.34.0/TFGTRS-4592/${brand.name.split(' ')[0]}-01-antes-place-order.png` });

      // Sin seleccionar ningún método de pago ni rellenar la tarjeta: pulsar Place order directamente.
      await checkout.placeOrder();
      await page.waitForTimeout(4000);

      await page.screenshot({ path: `tests/release-8.34.0/TFGTRS-4592/${brand.name.split(' ')[0]}-02-tras-place-order-sin-metodo.png` });

      // No debería haberse confirmado un pedido (no hay página de "thank you"/order confirmation).
      const orderConfirmed = /checkout\/confirmation|order-confirm|orderconfirmation|thank.?you/i.test(page.url());
      expect(orderConfirmed, `${brand.name}: NO debería confirmarse un pedido sin método de pago`).toBeFalsy();

      // Debería seguir en el checkout (no una página de error 500/crash).
      const stillOnCheckout = /checkout/i.test(page.url());
      expect(stillOnCheckout, `${brand.name}: debería permanecer en el checkout, no en una página de error`).toBeTruthy();

      console.log(`[${brand.name}] Scenario 1 — URL final: ${page.url()}`);
      console.log(`[${brand.name}] Scenario 1 — SubmitPayment status: ${submitPaymentStatus}`);
      console.log(`[${brand.name}] Scenario 1 — console/page errors: ${JSON.stringify(consoleErrors.slice(0, 5))}`);
    });

    test('Scenario 2: happy path — Adyen test card places the order (no regression)', async ({
      page, productDetailPage,
    }) => {
      await page.goto(brand.pdp, { waitUntil: 'load' });
      await productDetailPage.acceptCookiesIfPresent(); // el banner OneTrust tapa la opción de tarjeta
      await productDetailPage.waitForLoaded();
      await productDetailPage.selectFirstAvailableSize();
      const basket = await productDetailPage.addToCartAndGoToBasket();
      await basket.waitForLoaded();

      const checkout = await basket.proceedToCheckout();
      await checkout.continueAsGuest(guestEmail);
      await checkout.fillShippingAddress(shippingAddress);
      await checkout.submitShippingMethod();
      await checkout.fillAdyenCard(adyenTestCard);

      await page.screenshot({ path: `tests/release-8.34.0/TFGTRS-4592/${brand.name.split(' ')[0]}-03-antes-place-order-con-tarjeta.png` });

      await checkout.placeOrder();
      // La confirmación de SFRA en dev es /secure/checkout/confirmation/?ID=...
      await page.waitForURL(/checkout\/confirmation|order-confirm|orderconfirmation|thank.?you/i, { timeout: 30000 });

      await page.screenshot({ path: `tests/release-8.34.0/TFGTRS-4592/${brand.name.split(' ')[0]}-04-confirmacion.png` });
      console.log(`[${brand.name}] Scenario 2 — pedido confirmado en: ${page.url()}`);
    });
  });
}
