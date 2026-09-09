import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { ProductDetailPage } from './product-detail.page';

/**
 * SearchResultsPage — página de resultados de búsqueda (/search/?q=...).
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

  async waitForLoaded(): Promise<void> {
    await this.dismissModalsIfPresent();
    await this.productTiles.first().waitFor({ state: 'visible' });
  }

  async getProductCount(): Promise<number> {
    return this.productTiles.count();
  }

  async getResultCountText(): Promise<string> {
    return (await this.resultCount.textContent())?.trim() ?? '';
  }

  /**
   * Navega al primer producto de la lista. En vez de clickear el link
   * (puede quedar interceptado por hover/carousel o por el popup de Global-e),
   * leemos el href y navegamos directamente.
   */
  async clickFirstProduct(): Promise<ProductDetailPage> {
    await this.dismissModalsIfPresent();
    const href = await this.productTiles.first().locator('a').first().getAttribute('href');
    const absoluteUrl = new URL(href!, this.page.url()).toString();
    await this.page.goto(absoluteUrl);
    const pdp = new ProductDetailPage(this.page);
    await pdp.waitForLoaded();
    return pdp;
  }
}
