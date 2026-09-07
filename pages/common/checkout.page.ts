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

  /** Paso 1: Click en "CONTINUE AS GUEST" en la pantalla de login. */
  async continueAsGuest(_email: string): Promise<void> {
    const guestLink = this.page.getByRole('link', { name: /continue as guest/i });
    await guestLink.waitFor({ state: 'visible', timeout: 15000 });
    await guestLink.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Paso 2: Rellena la dirección de envío usando el formulario manual. */
  async fillShippingAddress(address: ShippingAddress): Promise<void> {
    // Abre el formulario manual (en lugar del postcode lookup)
    const enterManually = this.page.getByRole('link', { name: /enter address manually/i });
    await enterManually.waitFor({ state: 'visible', timeout: 15000 });
    await enterManually.click();

    // Nombre y apellido
    await this.page.locator('#shippingFirstNamedefault, input[name="firstName"]').first()
      .waitFor({ state: 'visible', timeout: 10000 });
    await this.page.locator('#shippingFirstNamedefault, input[name="firstName"]').first()
      .fill(address.firstName);
    await this.page.locator('#shippingLastNamedefault, input[name="lastName"]').first()
      .fill(address.lastName);

    // Teléfono
    const phoneField = this.page.locator('input[name="phone"], input[name="mobileNumber"], #phone').first();
    if (await phoneField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await phoneField.fill(address.phone);
    }

    // Dirección
    await this.page.locator('#shippingAddressOnedefault, input[name="address1"]').first()
      .fill(address.address1);
    if (address.address2) {
      const addr2 = this.page.locator('#shippingAddressTwodefault, input[name="address2"]').first();
      if (await addr2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addr2.fill(address.address2);
      }
    }
    await this.page.locator('#shippingAddressCitydefault, input[name="city"]').first()
      .fill(address.city);
    await this.page.locator('#shippingZipCodedefault, input[name="postalCode"]').first()
      .fill(address.postcode);

    // Submit dirección
    await this.page.locator('button.submit-shipping, button:has-text("CONTINUE")').first().click();
  }

  /** Paso 3: Confirma el método de envío (Standard ya viene seleccionado). */
  async submitShippingMethod(): Promise<void> {
    const continueToPayment = this.page.getByRole('button', { name: /continue to payment/i });
    await continueToPayment.waitFor({ state: 'visible', timeout: 15000 });
    await continueToPayment.click();
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

  /** Verifica que el botón de pago es visible — usado en tests de producción. */
  async isPlaceOrderVisible(): Promise<boolean> {
    try {
      const btn = this.page.getByRole('button', { name: /place order/i });
      await btn.waitFor({ state: 'visible', timeout: 10000 });
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
