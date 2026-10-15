// TFGTRS-4577 — Regresión de la validación de contacto de facturación de Apple Pay,
// sin dispositivo Apple.
//
// Contexto: en septiembre un contacto de Wallet sin apellido (familyName vacío) hizo que
// ApplePay-PaymentAuthorized rechazara miles de pedidos en producción (ver TFGTRS-4577,
// orderNo=19594868: givenName="Home", familyName=""). El fix ya está en producción, pero
// no teníamos ninguna forma de detectar una regresión de este tipo sin un dispositivo Apple.
//
// Qué SÍ se puede probar sin dispositivo: Hobbs y Phase Eight comparten el mismo cartridge
// int_applepay que usa Whistles (confirmado en vivo en stage — mismo script
// internal/jscript/applepay.js, mismos nombres de acción en window.dw.applepay.action,
// solo con el site ID de cada marca). La hoja nativa de pago y la autenticación biométrica
// siguen sin poder probarse — eso es manual (ver apple-pay-manual-checklist.md) — pero la
// validación del contacto de facturación ocurre ANTES de llegar a esa hoja, en el servidor,
// así que se puede probar con un token falso (no decodificable, sin cargo real), siempre
// que primero se dispare ApplePay-PrepareBasket seleccionando Apple Pay como método de pago
// en el checkout real. Sin ese paso previo, el endpoint devuelve un error genérico sin
// llegar a validar nada (confirmado empíricamente).
//
// Lo que esto NO prueba: la hoja nativa de Apple Pay, Face ID/Touch ID, ni el token real de
// Apple. Para eso hace falta Safari en un dispositivo Apple o BrowserStack.
//
// IMPORTANTE — solo stage: este spec nunca debe tocar producción. guardAgainstProduction()
// bloquea cualquier request a los hosts de producción de cada marca.
import { test, expect } from '@fixtures/pages.fixture';
import type { Page } from '@playwright/test';
import { sanitySiteData } from '@data/sanity.data';
import { shippingAddress, guestEmail } from '@data/checkout.data';

const BRANDS = sanitySiteData.filter((b) => b.name === 'Hobbs' || b.name === 'Phase Eight');

async function guardAgainstProduction(page: Page, prodHostname: string): Promise<void> {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    // Las páginas de stage cargan algunos assets estáticos (imágenes, fuentes, CSS) desde el
    // host de producción; eso es inofensivo y no se bloquea. Lo que sí se bloquea es cualquier
    // otra request (navegaciones, XHR, POST) a producción.
    const isStaticAsset =
      url.pathname.includes('/on/demandware.static/') ||
      ['image', 'font', 'stylesheet', 'media'].includes(route.request().resourceType());
    if (url.hostname === prodHostname && !isStaticAsset) {
      route.abort('blockedbyclient');
      throw new Error(
        `Este spec no debe tocar producción. Request bloqueado a ${prodHostname}: ${route.request().url()}`
      );
    }
    route.continue();
  });
}

// El gate de visibilidad del botón de Apple Pay vive en el mismo script en los tres sitios:
// `window.ApplePaySession && ApplePaySession.canMakePayments()`. Hay que stubearlo ANTES de
// la primera navegación, porque ese gate corre apenas carga el script.
async function stubApplePaySession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeApplePaySession {
      static canMakePayments() { return true; }
      static supportsVersion() { return true; }
      constructor(public version: number, public paymentRequest: unknown) {}
      begin() {}
      abort() {}
      completeMerchantValidation() {}
      completePaymentMethodSelection() {}
      completeShippingContactSelection() {}
      completeShippingMethodSelection() {}
      completePayment() {}
    }
    (window as any).ApplePaySession = FakeApplePaySession;
  });
}

for (const brand of BRANDS) {
  test.describe(`TFGTRS-4577 - Apple Pay billing-contact validation without a device (${brand.name})`, () => {
    // Phase Eight en stage sigue teniendo algo de intermitencia (confirmado: a veces el carrito
    // queda vacío incluso con la región ya resuelta en GB — causa aún no identificada). Un solo
    // retry absorbe ese residual sin esconder una falla real, igual que el resto de la suite.
    test.describe.configure({ mode: 'serial', timeout: 240_000, retries: 1 });
    // La petición a ApplePay-PaymentAuthorized va directo con page.request (no por el browser
    // engine) — en stage su cadena de certificados no siempre está en el trust store por
    // defecto de Node, aunque la navegación normal del browser a ese mismo host funcione bien.
    test.use({ ignoreHTTPSErrors: true });

    // Fuerza la región UK/GBP antes de navegar. Sin esto el checkout puede caer en el flujo
    // internacional de Globale en vez del checkout nativo (donde vive Apple Pay/DW_APPLE_PAY).
    const setUkCookie = async (context: import('@playwright/test').BrowserContext) => {
      await context.addCookies([{
        name: 'GlobalE_Data',
        value: JSON.stringify({ countryCode: 'GB', currencyCode: 'GBP', cultureCode: 'en-GB', countryName: 'United Kingdom', isSelected: true }),
        domain: new URL(brand.stagingUrl).hostname, path: '/', httpOnly: false, secure: true, sameSite: 'None',
      }]);
    };
    test.beforeEach(async ({ context }) => { await setUkCookie(context); });

    test('Billing-contact validation rejects an empty familyName; a filled one does not hit that status', async (
      { page, homePage, searchResultsPage, checkoutPage },
    ) => {
      test.setTimeout(240_000);

      const prodHostname = new URL(brand.prodUrl).hostname;
      await guardAgainstProduction(page, prodHostname);
      await stubApplePaySession(page);

      await test.step('Fijar la región UK/GBP antes de cualquier otra navegación', async () => {
        // Confirmado en vivo: Globale detecta la región real por IP (ej. Argentina) e ignora la
        // cookie GlobalE_Data seteada de antemano. La única forma real de fijar la región es
        // clickear GUARDAR en el popup de Globale, que actualiza la sesión UK en el servidor (ver
        // comentario en product-detail.page.ts) — por eso se hace una vez acá, al principio, en
        // vez de reactivamente después de un carrito vacío (eso dejaba la página en un estado raro
        // con un segundo reload a mitad del flujo).
        // Navegación absoluta — esta suite no tiene baseURL seteado a stage.*, homePage.open()/
        // goto('/') resolvería contra el baseURL del proyecto (SANDBOX_URL).
        await page.goto(brand.stagingUrl, { waitUntil: 'domcontentloaded' });
        await homePage.acceptCookiesIfPresent();
        await homePage.dismissModalsIfPresent();
      });

      await test.step('Agregar un producto con stock al carrito', async () => {
        // Se va directo a la URL de búsqueda: en la home el buscador no siempre está visible
        // (HomePage.search() falló por eso en ambas marcas con un timeout de 30s).
        // domcontentloaded: 'load' esperaba assets de terceros y daba timeout de 60s en Hobbs.
        await page.goto(`${brand.stagingUrl}/search?q=${brand.searchTerm}`, { waitUntil: 'domcontentloaded' });
        await searchResultsPage.acceptCookiesIfPresent();
        await searchResultsPage.waitForLoaded();
        const pdp = await searchResultsPage.clickFirstProduct();
        await pdp.selectFirstAvailableSize();
        await pdp.addToCartAndGoToBasket();
      });

      await test.step('Llegar al checkout como invitado con la dirección de envío', async () => {
        // BasketPage.proceedToCheckout() busca textos como "Checkout Securely" y no matchea el
        // link de Hobbs ("View Bag And Checkout"); aquí se usa un locator más amplio.
        await page.goto(`${brand.stagingUrl}/bag`);
        await checkoutPage.dismissModalsIfPresent();
        const checkoutLink = page.locator('button:has-text("Checkout"), a:has-text("Checkout")').first();
        await expect(checkoutLink, 'No hay botón de checkout en la bolsa (¿carrito vacío?)').toHaveCount(1, { timeout: 15_000 });
        await checkoutLink.evaluate((el) => (el as HTMLElement).click());
        await page.waitForURL(/checkout/i, { timeout: 30_000 });
        await checkoutPage.continueAsGuest(guestEmail);
        await checkoutPage.fillShippingAddress(shippingAddress);
        // CheckoutPage.submitShippingMethod() busca el botón por rol y en estos sitios no lo
        // encuentra (confirmado: 0 matches por rol, 1 por texto; mide tamaño 0 pero es clickeable),
        // así que se hace click directo por texto.
        const continueToPayment = page.locator('button:has-text("Continue to Payment")').first();
        await expect(continueToPayment, 'No apareció "Continue to Payment"').toHaveCount(1, { timeout: 20_000 });
        await continueToPayment.evaluate((el) => (el as HTMLElement).click());
        await page.waitForTimeout(3_000);
      });

      const prepareBasketReq = await test.step('Seleccionar Apple Pay como método de pago (dispara ApplePay-PrepareBasket)', async () => {
        const applePayRadio = page.locator('input[value="DW_APPLE_PAY"]').first();
        await expect(applePayRadio, 'No apareció el método de pago Apple Pay en el checkout').toHaveCount(1, { timeout: 15_000 });
        const radioId = await applePayRadio.getAttribute('id');
        await page.locator(`label[for="${radioId}"]`).click({ force: true }).catch(async () => {
          await applePayRadio.evaluate((el) => (el as HTMLElement).click());
        });
        // El botón real de Apple Pay reemplaza al placeholder vía polling (~1s) una vez que
        // ApplePay-GetRequest resuelve — y, aunque exista y esté habilitado, el checkout mide
        // su tamaño como 0x0 un instante (acordeón en transición); confirmado en stage que
        // sigue siendo clickeable igual, así que no se espera por "visible" sino por el
        // propio click.
        await page.waitForTimeout(3_500);
        const applePayButton = page.locator('button.dw-apple-pay-button').first();
        await expect(applePayButton, 'El botón de Apple Pay nunca apareció en el DOM').toHaveCount(1, { timeout: 10_000 });

        const [req] = await Promise.all([
          page.waitForRequest((r) => /ApplePay-PrepareBasket/i.test(r.url()), { timeout: 10_000 }),
          applePayButton.evaluate((el) => (el as HTMLElement).click()),
        ]);
        return req;
      });
      expect(prepareBasketReq.method()).toBe('POST');

      const paymentAuthorizedUrl = await test.step('Leer el endpoint real de onpaymentauthorized desde la página', async () => {
        const action = await page.evaluate(() => (window as any).dw?.applepay?.action);
        expect(action?.onpaymentauthorized, 'window.dw.applepay.action no está poblado').toBeTruthy();
        const url = new URL(action.onpaymentauthorized);
        expect(url.hostname, 'el endpoint debe estar en stage — nunca en producción').toMatch(/^stage\./);
        return action.onpaymentauthorized as string;
      });

      // Contacto basado en el caso real de TFGTRS-4577 (orderNo=19594868): un contacto de
      // Wallet que llega como si fuera una tarjeta de "ubicación" (solo givenName="Home"),
      // no una de persona, sin apellido.
      const baseContact = {
        givenName: 'Home',
        addressLines: ['1 Test Street', 'Flat 2'],
        locality: 'London',
        administrativeArea: 'London',
        postalCode: 'W1A 1AA',
        country: 'United Kingdom',
        countryCode: 'GB',
      };

      // Token con forma sintácticamente válida pero no decodificable — nunca intenta ser un
      // token real de Apple. Solo necesita existir para que el controlador llegue a validar
      // el contacto en vez de fallar antes por falta de token.
      const fakeToken = {
        paymentData: {
          version: 'EC_v1',
          data: 'FAKEDATA==',
          signature: 'FAKESIGNATURE==',
          header: { ephemeralPublicKey: 'FAKEKEY==', publicKeyHash: 'FAKEHASH==', transactionId: 'deadbeefcafe' },
        },
        paymentMethod: { displayName: 'Visa 1234', network: 'Visa', type: 'debit' },
        transactionIdentifier: 'TESTTXN123',
      };

      await test.step('Un familyName vacío se rechaza con un status específico de facturación', async () => {
        const resp = await page.request.post(paymentAuthorizedUrl, {
          data: {
            payment: {
              token: fakeToken,
              billingContact: { ...baseContact, familyName: '' },
              shippingContact: { ...baseContact, familyName: '', emailAddress: guestEmail, phoneNumber: shippingAddress.phone },
            },
          },
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        });
        const body = await resp.json();
        expect(body.status).toBe('InvalidBillingPostalAddress');
      });

      await test.step('Control: el mismo payload con un familyName real no da ese status', async () => {
        const resp = await page.request.post(paymentAuthorizedUrl, {
          data: {
            payment: {
              token: fakeToken,
              billingContact: { ...baseContact, familyName: 'Buyer' },
              shippingContact: { ...baseContact, familyName: 'Buyer', emailAddress: guestEmail, phoneNumber: shippingAddress.phone },
            },
          },
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        });
        const body = await resp.json();
        // Se espera que falle más adelante por el token falso (esa es la barrera real de
        // dispositivo/criptografía que este spec no cruza a propósito) — pero NO debe ser el
        // status de facturación, lo que confirma que el familyName vacío fue la causa real.
        expect(body.status).not.toBe('InvalidBillingPostalAddress');
      });
    });
  });
}
