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
    // Excluye tiles de recomendaciones de Constructor.io (`data-cnstrc-item`).
    // Incluye también el markup de Whistles (wr-product-card / product-tile_wrapper).
    this.productTiles = page.locator(
      '.product-tile:not([data-cnstrc-item]), article[class*="wr-product-card"], [class*="product-tile_wrapper"]'
    );
    this.resultCount = page.locator('.filters__result-count').first();
  }

  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissModalsIfPresent();
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
