import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ProductDetailPage } from './product-detail.page';

/**
 * ProductListPage (PLP) — página de listado de productos.
 *
 * Compartida por todas las marcas (misma plataforma SFCC SFRA).
 */
export class ProductListPage extends BasePage {
  readonly productTiles: Locator;

  constructor(page: Page) {
    super(page);
    // Excluye tiles de recomendaciones de Constructor.io (tienen data-cnstrc-item="recommendation")
    // Incluye también el markup de Whistles (wr-product-card / product-tile_wrapper)
    this.productTiles = page.locator(
      '.product-tile:not([data-cnstrc-item]), article[class*="wr-product-card"], [class*="product-tile_wrapper"]'
    );
  }

  /** Espera a que al menos un producto sea visible. */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissModalsIfPresent();
    // Usar waitForFunction para detectar tiles visibles por dimensiones reales,
    // evitando falsos hidden en sitios con animaciones CSS (ej. Whistles).
    await this.page.waitForFunction(() => {
      const selectors = [
        '.product-tile:not([data-cnstrc-item])',
        'article[class*="wr-product-card"]',
        '[class*="product-tile_wrapper"]',
      ];
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 10 && r.height > 10) return true;
        }
      }
      return false;
    }, { timeout: 30000 });
  }

  /** Número de productos visibles en el listado. */
  async getProductCount(): Promise<number> {
    return this.productTiles.count();
  }

  /** Navega al primer producto y devuelve la PDP. */
  async clickFirstProduct(): Promise<ProductDetailPage> {
    // Descartamos cualquier modal que haya aparecido durante la carga de la PLP
    await this.dismissModalsIfPresent();
    // Navegamos via href en vez de click para evitar que el hover effect
    // (imagen alternativa del tile) cause retries infinitos en Playwright.
    // Usamos new URL() para resolver rutas relativas contra la URL actual.
    const href = await this.productTiles.first().locator('a').first().getAttribute('href');
    const absoluteUrl = new URL(href!, this.page.url()).toString();
    await this.page.goto(absoluteUrl);
    const pdp = new ProductDetailPage(this.page);
    await pdp.waitForLoaded();
    return pdp;
  }
}
