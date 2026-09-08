import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage — clase de la que heredan TODOS los Page Objects.
 *
 * Aquí van acciones genéricas que sirven para cualquier página de cualquier
 * marca (navegar, esperar, aceptar cookies...). Las páginas concretas
 * (HomePage, SearchResultsPage, etc.) extienden esta clase y añaden sus
 * propios selectores y métodos.
 */
export class BasePage {
  readonly page: Page;

  // Banner de consentimiento de cookies (OneTrust) — común a ambas marcas.
  readonly cookieAcceptButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cookieAcceptButton = page.locator('#onetrust-accept-btn-handler');
  }

  /** Navega a una ruta relativa al baseURL del project (ej: '/search/'). */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path);
  }

  /** Devuelve el título de la pestaña del navegador. */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /** Espera a que un elemento sea visible antes de interactuar con él. */
  async waitForVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  /**
   * Acepta el banner de cookies si está presente.
   * No falla si no aparece (algunas páginas/recargas no lo muestran).
   */
  async acceptCookiesIfPresent(): Promise<void> {
    try {
      // Staging puede tardar en inyectar OneTrust — esperamos hasta 8s antes de asumir que no hay banner.
      if (await this.cookieAcceptButton.isVisible({ timeout: 8000 })) {
        await this.cookieAcceptButton.click();
        await this.cookieAcceptButton.waitFor({ state: 'hidden', timeout: 8000 });
      }
    } catch {
      // El banner no apareció a tiempo: seguimos sin bloquear el test.
    }
  }

  /**
   * Cierra modales de marketing que bloquean la interacción con la página:
   * - Selector de país/región (aparece cuando el sitio detecta un país distinto)
   * - Welcome mat / descuento de bienvenida ("15% OFF", "DECLINE OFFER")
   * No falla si ninguno aparece.
   */
  async dismissModalsIfPresent(): Promise<void> {
    // Globale cross-border popup — intercepta pointer events en toda la página cuando
    // detecta una IP no-UK. Lo ocultamos con JS; usuarios UK nunca lo ven.
    try {
      await this.page.evaluate(() => {
        const globale = document.getElementById('globalePopupWrapper');
        if (globale) (globale as HTMLElement).style.display = 'none';
        // También limpiar cualquier overlay de fondo que bloquee clicks
        document.querySelectorAll('[class*="globale"]').forEach(el => {
          (el as HTMLElement).style.display = 'none';
        });
      });
    } catch { /* no presente */ }

    // Welcome mat "ENJOY X% OFF" — botón DECLINE OFFER
    try {
      const declineBtn = this.page.getByRole('button', { name: /decline offer/i });
      if (await declineBtn.isVisible({ timeout: 5000 })) {
        await declineBtn.click();
      }
    } catch { /* modal no presente */ }

    // Selector de país/región — detectamos por CANCELAR/CANCEL pero cerramos con Escape
    try {
      const cancelEl = this.page.locator('button, a, [role="button"]').filter({ hasText: /^cancel(ar)?$/i }).first();
      if (await cancelEl.isVisible({ timeout: 3000 })) {
        await this.page.keyboard.press('Escape');
      }
    } catch { /* modal no presente */ }
  }
}
