import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { SearchResultsPage } from './search-results.page';

/**
 * HomePage — página de inicio.
 *
 * Compartida por Hobbs y Phase Eight (misma plataforma Salesforce Commerce
 * Cloud). El buscador es un input nativo de búsqueda con name="q".
 */
export class HomePage extends BasePage {
  readonly searchBox: Locator;

  constructor(page: Page) {
    super(page);
    // Hay varios inputs de búsqueda (desktop/mobile); usamos el primero visible.
    this.searchBox = page.getByRole('searchbox').first();
  }

  /** Abre la home y acepta el banner de cookies si aparece. */
  async open(): Promise<void> {
    await this.goto('/');
    await this.acceptCookiesIfPresent();
  }

  /**
   * Escribe un término y lanza la búsqueda.
   *
   * Robustecido: cierra modales (Global-e / country selector / cookie banner)
   * antes de tocar el search-box y hace un click explícito para asegurar foco,
   * porque fill+Enter fallaba intermitentemente cuando el banner de OneTrust
   * o Global-e se inyectaba justo encima del input.
   *
   * Devuelve el Page Object de la página de resultados.
   */
  async search(term: string): Promise<SearchResultsPage> {
    await this.dismissModalsIfPresent();
    await this.searchBox.waitFor({ state: 'visible' });
    await this.searchBox.click();
    await this.searchBox.fill(term);
    await this.searchBox.press('Enter');
    const results = new SearchResultsPage(this.page);
    await results.waitForLoaded();
    return results;
  }
}
