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
    // Eliminar del DOM cualquier overlay que pueda interceptar el click en el search box:
    // Globale popup, bx-campaign (welcome mat), overlay residual. Esto es necesario
    // porque dismissModalsIfPresent() puede no alcanzar a eliminarlos si Globale
    // los re-inyecta tras el reload de GUARDAR.
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => {});

    // También intentar click en DECLINE OFFER si el welcome mat apareció después del evaluate
    try {
      const declineBtn = this.page.getByRole('button', { name: /decline offer/i });
      if (await declineBtn.isVisible({ timeout: 2000 })) await declineBtn.click();
    } catch { /* modal no presente */ }

    // Esperar a que la página esté lista (Globale puede causar un redirect tras CANCELAR)
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});

    // Algunos sitios (Whistles) ocultan el searchbox hasta hacer click en el botón Search
    try {
      const searchTrigger = this.page.getByRole('button', { name: /^search$/i }).first();
      await searchTrigger.waitFor({ state: 'visible', timeout: 5000 });
      await searchTrigger.click({ force: true });
    } catch { /* searchbox ya visible, no necesita trigger */ }

    // El welcome mat ("15% off") puede abrirse tarde, después del dismiss inicial, y mientras está
    // abierto el resto de la página queda fuera del árbol de accesibilidad, así que
    // getByRole('searchbox') no encuentra nada. Si no aparece rápido, se cierran los popups
    // y se reintenta (causa de los fallos intermitentes "search returns product results").
    try {
      await this.searchBox.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      await this.dismissModalsIfPresent();
      await this.searchBox.waitFor({ state: 'visible' });
    }
    await this.searchBox.click({ force: true });
    await this.searchBox.fill(term);
    await this.searchBox.press('Enter');
    const results = new SearchResultsPage(this.page);
    await results.waitForLoaded();
    return results;
  }
}
