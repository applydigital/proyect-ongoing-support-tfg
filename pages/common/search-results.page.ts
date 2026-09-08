import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * SearchResultsPage — página de resultados de búsqueda (/search/?q=...).
 *
 * Compartida por ambas marcas. Selectores reales del tema SFRA del sitio:
 *   - grilla:     .product-grid
 *   - cada tile:  .product-tile
 *   - contador:   .filters__result-count
 */
export class SearchResultsPage extends BasePage {
  readonly grid: Locator;
  readonly productTiles: Locator;
  readonly resultCount: Locator;

  constructor(page: Page) {
    super(page);
    this.grid = page.locator('.product-grid').first();
    // Excluye tiles de recomendaciones de Constructor.io (`data-cnstrc-item`),
    // que están ocultos hasta hacer scroll y confunden a `.first()`.
    this.productTiles = page.locator('.product-tile:not([data-cnstrc-item])');
    this.resultCount = page.locator('.filters__result-count').first();
  }

  /**
   * Espera a que los resultados estén realmente renderizados.
   * Esperamos al primer producto VISIBLE (no al contenedor `.product-grid`,
   * porque existe una fila de paginación superior con esa misma clase que
   * está oculta y provocaba esperas inestables).
   */
  async waitForLoaded(): Promise<void> {
    await this.productTiles.first().waitFor({ state: 'visible' });
  }

  /** Número de productos mostrados en la grilla. */
  async getProductCount(): Promise<number> {
    return this.productTiles.count();
  }

  /** Texto del contador de resultados (ej: "120 Results"). */
  async getResultCountText(): Promise<string> {
    return (await this.resultCount.textContent())?.trim() ?? '';
  }

  /**
   * Navega al primer producto de la lista. Igual que `ProductListPage.clickFirstProduct`:
   * en vez de clickear el link (que puede quedar interceptado por hover/carousel
   * o por un popup de Global-e), leemos el href y navegamos directamente.
   */
  async clickFirstProduct(): Promise<void> {
    await this.dismissModalsIfPresent();
    const href = await this.productTiles.first().locator('a').first().getAttribute('href');
    const absoluteUrl = new URL(href!, this.page.url()).toString();
    await this.page.goto(absoluteUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }
}
