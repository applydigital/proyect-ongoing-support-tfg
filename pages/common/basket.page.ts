import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { CheckoutPage } from './checkout.page';

/**
 * BasketPage — página de la cesta (/cart).
 *
 * Selectores basados en SFCC SFRA estándar.
 */
export class BasketPage extends BasePage {
  readonly productLineItems: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.productLineItems = page.locator(
      '.product-summary, .cart-page .product-info, .line-item-name, ' +
      '.product-line-item, .line-item-header, .cart-item, ' +
      '.ge-cart-item, .globale-cart-item, [class*="line-item"]'
    );
    this.checkoutButton = page.locator(
      'button:has-text("Checkout Securely"), a:has-text("Checkout Securely"), ' +
      'button:has-text("Checkout Now"), a:has-text("Checkout Now"), ' +
      'button:has-text("Proceed to Checkout"), a:has-text("Proceed to Checkout"), ' +
      'button:has-text("Secure Checkout"), a:has-text("Secure Checkout"), ' +
      'a.checkout-btn, button.checkout-btn, .btn-checkout, ' +
      '.ge-checkout-link, .ge-checkout-btn, button[data-action="checkout"]'
    ).first();
  }

  /** Espera a que la cesta cargue con al menos un producto. */
  async waitForLoaded(): Promise<void> {
    // Eliminar overlays de Globale que puedan bloquear la visibilidad de los artículos.
    await this.dismissModalsIfPresent();
    // Timeout reducido a 10s: si la cesta está vacía no hay que esperar 30s para saberlo.
    await this.productLineItems.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  /** Devuelve true si la cesta tiene al menos un artículo. */
  async hasItems(): Promise<boolean> {
    await this.dismissModalsIfPresent();
    try {
      // Timeout de 10s: suficiente para que cargue la página; no bloquea 30s en cesta vacía.
      await this.productLineItems.first().waitFor({ state: 'visible', timeout: 10000 });
      return (await this.productLineItems.count()) > 0;
    } catch {
      return false;
    }
  }

  /** Pulsa el botón de checkout y devuelve la página de checkout. */
  async proceedToCheckout(): Promise<CheckoutPage> {
    await this.dismissModalsIfPresent();
    // El overlay de Globale persiste y oculta el botón de checkout incluso
    // después de CANCELAR. Eliminar y luego intentar el click.
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});
    // Comprobar primero si existe algún elemento que coincida (evita un evaluate
    // timeout de 30s cuando la cesta está vacía y no hay botón de checkout).
    const count = await this.checkoutButton.count().catch(() => 0);
    if (count === 0) {
      // Cesta vacía — no hay botón de checkout; devolver página de checkout vacía.
      return new CheckoutPage(this.page);
    }
    const isVisible = await this.checkoutButton.isVisible().catch(() => false);
    if (isVisible) {
      await this.checkoutButton.click();
    } else {
      // El botón existe en el DOM pero está CSS-oculto por el overlay.
      await this.checkoutButton.evaluate(el => (el as HTMLElement).click());
    }
    return new CheckoutPage(this.page);
  }
}
