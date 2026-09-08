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
    // Excluimos el estado "Select Size" — el botón existe y no está disabled,
    // pero SFRA no lo activa hasta que la talla se registra por AJAX. Clickearlo
    // en ese estado no hace nada. Con esta exclusión, waitFor(visible) espera
    // efectivamente a que el add-to-cart quede realmente accionable.
    this.addToCartButton = page.locator('button.add-to-cart:not([disabled])')
      .filter({ hasNotText: /select size/i })
      .first();
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
    await this.addToCartButton.waitFor({ state: 'visible' });
    await this.addToCartButton.click();

    // Navegar directamente al carrito es más estable que esperar el mini-cart
    await this.page.goto('/cart');
    return new BasketPage(this.page);
  }
}
