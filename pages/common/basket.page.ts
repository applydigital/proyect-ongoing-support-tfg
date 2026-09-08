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
    this.productLineItems = page.locator('.product-summary, .cart-page .product-info, .line-item-name');
    this.checkoutButton = page.locator(
      'button:has-text("Checkout Securely"), a:has-text("Checkout Securely"), ' +
      'a.checkout-btn, button.checkout-btn, .btn-checkout'
    ).first();
  }

  /** Espera a que la cesta cargue con al menos un producto. */
  async waitForLoaded(): Promise<void> {
    await this.productLineItems.first().waitFor({ state: 'visible', timeout: 15000 });
  }

  /** Devuelve true si la cesta tiene al menos un artículo. */
  async hasItems(): Promise<boolean> {
    await this.waitForLoaded();
    return (await this.productLineItems.count()) > 0;
  }

  /** Pulsa el botón de checkout y devuelve la página de checkout. */
  async proceedToCheckout(): Promise<CheckoutPage> {
    await this.dismissModalsIfPresent();
    await this.checkoutButton.waitFor({ state: 'visible' });
    await this.checkoutButton.click();
    return new CheckoutPage(this.page);
  }
}
