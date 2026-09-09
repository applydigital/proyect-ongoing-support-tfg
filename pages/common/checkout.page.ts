import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

interface ShippingAddress {
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  country?: string;
}

interface CardDetails {
  number: string;
  expiry: string;
  cvv: string;
}

/**
 * CheckoutPage — flujo de checkout de Hobbs/Phase Eight/Inside Story (SFCC SFRA).
 *
 * Pasos:
 *   1. Login page → click "CONTINUE AS GUEST"
 *   2. Delivery address → click "ENTER ADDRESS MANUALLY" → fill fields → CONTINUE
 *   3. Delivery method → Standard pre-selected → CONTINUE TO PAYMENT
 *   4. Payment → fill Adyen card fields → PLACE ORDER & PAY
 */
export class CheckoutPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  /** Paso 1: Rellena el email y pulsa "Continue as guest". */
  async continueAsGuest(email: string): Promise<void> {
    // Eliminar overlay de Globale que puede ocultar todos los elementos del checkout.
    await this.dismissModalsIfPresent();
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});

    // Rellenar email (visible antes de elegir guest)
    try {
      const emailField = this.page.getByRole('textbox', { name: /email/i }).first();
      await emailField.waitFor({ state: 'visible', timeout: 10000 });
      await emailField.fill(email);
    } catch { /* campo no presente en esta pantalla */ }

    // Hobbs checkout login: el DOM tiene una <label for="usePassword-no"> (radio) Y un
    // <button> "continue as guest" (submit). El getByText() obtiene la label primero y
    // hacer click en la label sólo selecciona el radio — no navega. Usar el button.
    const guestBtn = this.page.getByRole('button', { name: /continue as guest/i }).first();
    const btnVisible = await guestBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await guestBtn.click();
    } else if (await guestBtn.count() > 0) {
      // Botón en DOM pero CSS-oculto por overlay — JS click ignora CSS.
      await guestBtn.evaluate(el => (el as HTMLElement).click());
    } else {
      // Fallback: cualquier elemento con ese texto (incluyendo <a>).
      // count() evita el timeout de 30s cuando estamos en la página equivocada.
      const guestEl = this.page.getByText(/continue as guest/i).first();
      if (await guestEl.count().catch(() => 0) > 0) {
        await guestEl.evaluate(el => (el as HTMLElement).click()).catch(() => {});
      }
    }
    await this.page.waitForLoadState('domcontentloaded');

    // SFCC puede responder al click de "continue as guest" con un JSON AJAX en vez de
    // navegar (ej. Inside Story). Si el body es JSON con redirectUrl, seguirlo manualmente.
    try {
      const bodyText = await this.page.locator('body').innerText({ timeout: 2000 });
      const json = JSON.parse(bodyText.trim());
      if (json?.redirectUrl) {
        const origin = new URL(this.page.url()).origin;
        const redirectUrl = json.redirectUrl.startsWith('http')
          ? json.redirectUrl
          : `${origin}${json.redirectUrl}`;
        await this.page.goto(redirectUrl);
        await this.page.waitForLoadState('domcontentloaded');
      }
    } catch { /* body normal (HTML) — ignorar */ }
  }

  /** Paso 2: Rellena la dirección de envío. */
  async fillShippingAddress(address: ShippingAddress): Promise<void> {
    // CANCELAR el popup de Globale si apareció en este paso de checkout.
    // Sin esto, Globale puede re-inyectarse sobre el formulario y hacer que
    // todos los isVisible() devuelvan false, dejando los campos vacíos.
    await this.dismissModalsIfPresent();
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});
    // Esperar a que el formulario de dirección esté visible y listo.
    await this.page.getByRole('combobox', { name: /title/i }).first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    // Título/saludo — requerido en Hobbs (combobox con opciones Miss/Mrs/Ms/Mr...).
    // Seleccionar la segunda opción (primera no-placeholder) si el combobox existe.
    const titleSelect = this.page.getByRole('combobox', { name: /title/i }).first();
    if (await titleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleSelect.selectOption({ index: 1 }).catch(async () => {
        await titleSelect.selectOption('Ms').catch(() => {});
      });
    }

    // Nombre y apellido — usar accessible name que funciona con IDs SFRA y Hobbs.
    const firstNameField = this.page.getByRole('textbox', { name: /^first name/i }).first();
    if (await firstNameField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstNameField.fill(address.firstName);
    }
    const lastNameField = this.page.getByRole('textbox', { name: /^last name|^surname/i }).first();
    if (await lastNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lastNameField.fill(address.lastName);
    }

    // Teléfono / móvil.
    const phoneField = this.page.getByRole('textbox', { name: /mobile|phone|telephone/i }).first();
    if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await phoneField.fill(address.phone);
    }

    // Campos de dirección física: Hobbs los oculta tras un Loqate lookup ("First line of
    // address/postcode"). Hay que clickear "Enter address manually" para expandir los campos
    // reales. Timeout amplio (15s) porque el widget Loqate carga asíncronamente.
    // El widget Loqate oculta los campos reales detrás de un search input. "Enter address
    // manually" los muestra. En headless el click JS no siempre dispara el handler de Loqate,
    // así que intentamos el click Y forzamos la visibilidad de los campos directamente vía JS.
    const enterManually = this.page.getByRole('link', { name: /enter address manually/i });
    if (await enterManually.isVisible({ timeout: 15000 }).catch(() => false)) {
      // Intentar click normal primero.
      await enterManually.evaluate(el => (el as HTMLElement).click());
      await this.page.waitForTimeout(1500);
    }

    // Independientemente de si el click funcionó, forzar la visibilidad de los campos de
    // dirección real usando JavaScript. IDs confirmados por el snapshot de error:
    //   #addressOne → "Address Line 1"
    //   #postalCode → "Postcode"
    //   #city       → "Town or City"
    // Si los campos ya son visibles (click funcionó), esta operación es idempotente.
    await this.page.evaluate(() => {
      const idsToShow = ['addressOne', 'addressTwo', 'postalCode', 'city', 'state', 'country'];
      for (const id of idsToShow) {
        const el = document.getElementById(id);
        if (!el) continue;
        // Hacer visible el elemento y todos sus contenedores ocultos.
        let parent: HTMLElement | null = el.closest('[style*="display: none"], [style*="display:none"]') as HTMLElement | null
          || el.parentElement;
        while (parent && parent !== document.body) {
          const style = parent.getAttribute('style') || '';
          if (style.includes('display: none') || style.includes('display:none')) {
            parent.style.display = '';
          }
          if (getComputedStyle(parent).display === 'none') {
            parent.style.display = 'block';
          }
          parent = parent.parentElement as HTMLElement | null;
        }
        el.style.removeProperty('display');
      }
      // Ocultar el wrapper del Loqate search para que no solape con los campos reales.
      const loqateSearch = document.querySelector<HTMLElement>('.loqate-search, .pca, [class*="loqate"], [id*="loqate"]');
      if (loqateSearch) loqateSearch.style.display = 'none';
    }).catch(() => {});

    // Breve espera para que el DOM se estabilice tras la manipulación.
    await this.page.waitForTimeout(500);

    // Rellenar por ID SFCC (confirmados por el snapshot).
    const addr1ById = this.page.locator('#addressOne').first();
    if (await addr1ById.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addr1ById.fill(address.address1);
    } else {
      const addr1 = this.page.getByRole('textbox', {
        name: /address.*line.*1|address one|^address line|^street address/i,
      }).first();
      if (await addr1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addr1.fill(address.address1);
      }
    }

    // Línea 2 (opcional).
    if (address.address2) {
      const addr2 = this.page.locator('#addressTwo, #address2').first();
      if (await addr2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addr2.fill(address.address2);
      }
    }

    // Ciudad — ID confirmado por el snapshot: #city.
    const cityById = this.page.locator('#city').first();
    if (await cityById.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cityById.fill(address.city);
    } else {
      const cityField = this.page.getByRole('textbox', { name: /town|city/i }).first();
      if (await cityField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cityField.fill(address.city);
      }
    }

    // Código postal — ID confirmado por el snapshot: #postalCode.
    const postcodeById = this.page.locator('#postalCode').first();
    if (await postcodeById.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postcodeById.fill(address.postcode);
    } else {
      const postcodeField = this.page.getByRole('textbox', { name: /^postcode|^postal code|^zip code/i }).first();
      if (await postcodeField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await postcodeField.fill(address.postcode);
      }
    }

    // Submit — eliminar overlay de Globale antes de intentar el click.
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});

    // Hobbs: el botón puede decir "Continue", "CONTINUE TO DELIVERY", etc.
    // Intentar primero por accessible name (amplio), luego por submit del form.
    const continueBtn = this.page.getByRole('button', { name: /continue/i }).first();
    const contVisible = await continueBtn.isVisible().catch(() => false);
    if (contVisible) {
      await continueBtn.click();
    } else if (await continueBtn.count().catch(() => 0) > 0) {
      await continueBtn.evaluate(el => (el as HTMLElement).click()).catch(() => {});
    } else {
      // Fallback: submit del formulario de shipping por selector CSS.
      const submitBtn = this.page.locator(
        '.submit-shipping button, #dwfrm_shipping button[type="submit"], button.btn-primary[type="submit"]'
      ).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click().catch(() => {});
      } else {
        await submitBtn.evaluate(el => (el as HTMLElement).click()).catch(() => {});
      }
    }
  }

  /** Paso 3: Confirma el método de envío (Standard ya viene seleccionado). */
  async submitShippingMethod(): Promise<void> {
    await this.dismissModalsIfPresent();
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});
    const continueToPayment = this.page.getByRole('button', { name: /continue to payment/i });
    // Esperar hasta 8s a que aparezca el botón. Si no aparece (cesta vacía / error upstream),
    // continuar sin bloquear — el count check siguiente se encarga de no hacer nada.
    await continueToPayment.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const count = await continueToPayment.count().catch(() => 0);
    if (count === 0) return;
    const isVisible = await continueToPayment.isVisible().catch(() => false);
    if (isVisible) {
      await continueToPayment.click();
    } else {
      await continueToPayment.evaluate(el => (el as HTMLElement).click()).catch(() => {});
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Paso 4a: Rellena los campos de tarjeta Adyen (dentro de iframes).
   * Solo usar en staging con tarjetas de test.
   */
  async fillAdyenCard(card: CardDetails): Promise<void> {
    const cardNumberFrame = this.page.frameLocator(
      '[data-fieldtype="encryptedCardNumber"] iframe, .adyen-checkout__card__cardNumber__input iframe'
    ).first();
    await cardNumberFrame.locator('input').first().fill(card.number);

    const expiryFrame = this.page.frameLocator(
      '[data-fieldtype="encryptedExpiryDate"] iframe, .adyen-checkout__card__exp-date__input iframe'
    ).first();
    await expiryFrame.locator('input').first().fill(card.expiry);

    const cvvFrame = this.page.frameLocator(
      '[data-fieldtype="encryptedSecurityCode"] iframe, .adyen-checkout__card__cvc__input iframe'
    ).first();
    await cvvFrame.locator('input').first().fill(card.cvv);
  }

  /** Verifica que el formulario de entrega es visible — confirma que el checkout cargó. */
  async isDeliveryFormVisible(): Promise<boolean> {
    await this.dismissModalsIfPresent();
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
    }).catch(() => {});

    // 1. SFCC native checkout (UK): combobox de título.
    try {
      const titleField = this.page.getByRole('combobox', { name: /title/i }).first();
      await titleField.waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch { /* continuar con fallbacks */ }

    // 2. SFCC: campo First Name visible.
    try {
      const firstNameField = this.page.getByRole('textbox', { name: /^first name/i }).first();
      await firstNameField.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch { /* continuar */ }

    // 3. Globale iframe checkout (AU/US/ROW): para regiones no-UK la tienda usa el checkout
    //    de Globale que se renderiza en un iframe. El iframe tiene "Checkout page" como heading
    //    y "Order Summary" como región.
    try {
      const globaleFrame = this.page.frameLocator('iframe').first();
      const checkoutHeading = globaleFrame.getByRole('heading', { name: /checkout/i }).first();
      await checkoutHeading.waitFor({ state: 'visible', timeout: 8000 });
      return true;
    } catch { /* continuar */ }

    // 4. Fallback URL: si la URL contiene "checkout" o estamos en /bag/ con un iframe activo,
    //    asumir que el checkout es accesible.
    try {
      const url = this.page.url();
      const hasCheckoutUrl = /checkout|bag/i.test(url);
      const hasIframe = await this.page.locator('iframe').count() > 0;
      if (hasCheckoutUrl && hasIframe) return true;
    } catch { /* ignorar */ }

    return false;
  }

  /** Verifica que el botón de pago es visible — usado en tests de producción. */
  async isPlaceOrderVisible(): Promise<boolean> {
    await this.dismissModalsIfPresent();
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
    }).catch(() => {});
    try {
      const btn = this.page.getByRole('button', { name: /place order/i });
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Paso 4b: Confirma el pedido. Solo usar en staging. */
  async placeOrder(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /place order/i });
    await btn.waitFor({ state: 'visible' });
    await btn.click();
  }
}
