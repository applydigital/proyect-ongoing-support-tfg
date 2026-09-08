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
    // Botones de talla disponibles (excluye agotados y deshabilitados)
    this.sizeButtons = page.locator('.size-btn:not(.unselectable):not(.out-of-stock), button[data-attr="size"]:not([disabled])');
    this.addToCartButton = page.locator('button.add-to-cart:not([disabled])').first();
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
    await this.dismissModalsIfPresent();
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
  }

  /** Selecciona la primera talla disponible. Si el producto no tiene tallas (ej: hogar, talla única) lo omite. */
  async selectFirstAvailableSize(): Promise<void> {
    await this.dismissModalsIfPresent();
    const firstSize = this.sizeButtons.first();
    try {
      await firstSize.waitFor({ state: 'visible', timeout: 5000 });
      await firstSize.click();
    } catch {
      // Sin selector de talla (producto de talla única o artículo de hogar) — no es necesario
    }
  }

  /** Añade el producto al carrito y navega a la cesta. */
  async addToCartAndGoToBasket(): Promise<BasketPage> {
    await this.dismissModalsIfPresent();
    await this.addToCartButton.waitFor({ state: 'visible' });
    await this.addToCartButton.click();

    // Navegar directamente al carrito usando URL absoluta (regression no tiene baseURL configurado)
    const cartUrl = new URL('/cart', this.page.url()).toString();
    await this.page.goto(cartUrl);
    return new BasketPage(this.page);
  }
}
