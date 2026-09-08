import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { BasketPage } from './basket.page';

/**
 * ProductDetailPage (PDP) — página de detalle de producto.
 *
 * Selectores basados en SFCC SFRA estándar. Si algún selector no coincide
 * con el sitio real, ajustar aquí sin tocar los tests.
 */
export class ProductDetailPage extends BasePage {
  readonly sizeButtons: Locator;
  readonly addToCartButton: Locator;
  readonly minicartGoToCart: Locator;
  readonly addToCartConfirmation: Locator;

  constructor(page: Page) {
    super(page);
    // Tallas disponibles. Cubre 3 markups SFRA:
    //  - Capsules list (Hobbs, Phase Eight actuales): <li class="size-capsules__list_item">
    //  - Legacy buttons: <button class="size-btn">
    //  - Variation attribute buttons: <button data-attr="size">
    this.sizeButtons = page.locator(
      '.size-capsules__list_item:not(.unselectable):not(.unavailable):not(.out-of-stock):not(.disabled):not([aria-disabled="true"]), ' +
      '.size-btn:not(.unselectable):not(.out-of-stock), ' +
      'button[data-attr="size"]:not([disabled])'
    );
    // Ancla al contenedor principal para evitar la sticky bar (stickyAddToBag)
    // y excluye el estado "Select Size" (botón existe pero no activo hasta seleccionar talla).
    this.addToCartButton = page.locator(
      '.product-detail__add-to-cart button.add-to-cart:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-cart:not([disabled]), ' +
      'button.add-to-cart:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton)'
    ).filter({ hasNotText: /select size/i }).first();
    this.minicartGoToCart = page.locator('.minicart .go-to-cart, .mini-cart .view-cart, a[href*="/cart"]').first();
    this.addToCartConfirmation = page.locator('.add-to-cart-messages, .cart-and-ipay').first();
  }

  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissModalsIfPresent();
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Selecciona la primera talla disponible.
   * Si el producto no tiene tallas (home goods, talla única) lo omite sin fallar.
   */
  async selectFirstAvailableSize(): Promise<void> {
    await this.dismissModalsIfPresent();
    const firstSize = this.sizeButtons.first();
    try {
      await firstSize.waitFor({ state: 'visible', timeout: 30000 });
      await this.dismissModalsIfPresent();
      await firstSize.click();
    } catch {
      // Sin selector de talla (producto de talla única o artículo de hogar) — no es necesario
    }
  }

  /** Añade el producto al carrito y navega a la cesta. */
  async addToCartAndGoToBasket(): Promise<BasketPage> {
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.dismissModalsIfPresent();
    await this.addToCartButton.scrollIntoViewIfNeeded();
    // force:true bypasea el check de pointer-events del Globale popup (solo aparece por IP no-UK)
    await this.addToCartButton.click({ force: true });

    // Navegar directamente al carrito usando URL absoluta (regression no tiene baseURL configurado)
    const cartUrl = new URL('/cart', this.page.url()).toString();
    await this.page.goto(cartUrl);
    return new BasketPage(this.page);
  }
}
