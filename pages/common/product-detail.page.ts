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
    // El PDP tiene DOS botones de add-to-cart en el DOM: el principal (dentro
    // de .product-detail__add-to-cart o .prices-add-to-cart-actions) y otro
    // en la sticky bar (.js-sticky-add-to-bag-btn / .stickyAddToBag). Este
    // último a veces cae fuera del viewport y hace que .click() timeout.
    // Anclamos al contenedor principal para evitar la sticky bar.
    // Además excluimos el estado "Select Size": el botón existe pero SFRA
    // no lo activa hasta que la talla se registra por AJAX.
    this.addToCartButton = page.locator(
      '.product-detail__add-to-cart button.add-to-cart:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-cart:not([disabled]), ' +
      // Fallback amplio, pero excluyendo cualquier variante sticky
      'button.add-to-cart:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton)'
    ).filter({ hasNotText: /select size/i }).first();
    // Tras añadir al carrito aparece un mini-cart con enlace a la cesta
    this.minicartGoToCart = page.locator('.minicart .go-to-cart, .mini-cart .view-cart, a[href*="/cart"]').first();
    this.addToCartConfirmation = page.locator('.add-to-cart-messages, .cart-and-ipay').first();
  }

  /**
   * Espera a que la PDP esté lista verificando que el botón de add-to-cart
   * existe — es la señal más fiable de que la página cargó correctamente.
   */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Selecciona la primera talla disponible.
   * Timeout de 30s (alineado con actionTimeout global): las capsules
   * pueden inyectarse dinámicamente tras el load inicial del PDP.
   * Además re-cierra modales justo antes del click porque Global-e
   * a veces inyecta un overlay async después de renderizar el PDP.
   */
  async selectFirstAvailableSize(): Promise<void> {
    const firstSize = this.sizeButtons.first();
    await firstSize.waitFor({ state: 'visible', timeout: 30000 });
    await this.dismissModalsIfPresent();
    await firstSize.click();
  }

  /** Añade el producto al carrito y navega a la cesta. */
  async addToCartAndGoToBasket(): Promise<BasketPage> {
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
    // Un último dismissModals por si el overlay de Global-e reapareció post-scroll
    await this.dismissModalsIfPresent();
    // Aseguramos que el botón esté en viewport antes de hacer click.
    await this.addToCartButton.scrollIntoViewIfNeeded();
    await this.addToCartButton.click();

    // Navegar directamente al carrito es más estable que esperar el mini-cart
    await this.page.goto('/cart');
    return new BasketPage(this.page);
  }
}
