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
    // Ancla al contenedor principal para evitar la sticky bar.
    // Cubre ambas variantes de clase (add-to-cart y add-to-bag según la marca/config):
    this.addToCartButton = page.locator(
      '.product-detail__add-to-cart button.add-to-cart:not([disabled]), ' +
      '.product-detail__add-to-cart button.add-to-bag:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-cart:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-bag:not([disabled]), ' +
      'button.add-to-cart:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton), ' +
      'button.add-to-bag:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton)'
    ).filter({ hasNotText: /select.?size/i }).first();
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
   * Usa force:true para evitar que el Globale overlay bloquee el click sin modificar el DOM.
   */
  async selectFirstAvailableSize(): Promise<void> {
    const firstSize = this.sizeButtons.first();
    try {
      await firstSize.waitFor({ state: 'visible', timeout: 30000 });
      // force:true bypasa el Globale overlay sin llamar dismissModals (que causaría stale del botón ATC)
      await firstSize.click({ force: true });
    } catch {
      // Sin selector de talla (producto de talla única o artículo de hogar) — no es necesario
    }
  }

  /** Añade el producto al carrito y navega a la cesta. */
  async addToCartAndGoToBasket(): Promise<BasketPage> {
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.addToCartButton.click({ force: true });

    // Después del click aparece un minicart con el enlace "View Bag And Checkout"
    const viewBagLink = this.page.getByRole('link', { name: /view bag and checkout/i });
    try {
      await viewBagLink.waitFor({ state: 'visible', timeout: 10000 });
      await viewBagLink.click();
    } catch {
      // Fallback: si el minicart no aparece, navegar directamente preservando el prefijo de región
      const currentUrl = new URL(this.page.url());
      const firstSegment = currentUrl.pathname.split('/')[1];
      const knownRegions = ['au', 'us', 'eu', 'row', 'de'];
      const regionPrefix = knownRegions.includes(firstSegment) ? `/${firstSegment}` : '';
      await this.page.goto(`${currentUrl.origin}${regionPrefix}/cart`);
    }

    await this.page.waitForLoadState('domcontentloaded');
    return new BasketPage(this.page);
  }
}
