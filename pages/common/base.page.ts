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
    // ── 1. Globale country selector ──────────────────────────────────────────
    // Desde IPs no-UK aparece un popup "¿A QUÉ PAÍS QUIERES QUE SE ENVÍE EL PEDIDO?"
    // con un dropdown de países y un botón GUARDAR.
    // Solo cerrar con × / CANCELAR NO guarda cookie → el popup vuelve a aparecer.
    // Seleccionamos United Kingdom y hacemos click en GUARDAR para que Globale
    // setee su cookie y enrute el tráfico como UK → el carrito SFCC funciona normal.
    try {
      const globalePopup = this.page.locator('#globalePopupWrapper');
      if (await globalePopup.isVisible({ timeout: 5000 })) {
        const countrySelect = globalePopup.locator('select').first();
        if (await countrySelect.isVisible({ timeout: 3000 })) {
          // Seleccionar United Kingdom via JS para mayor compatibilidad
          await countrySelect.evaluate((select: HTMLSelectElement) => {
            const ukOption = Array.from(select.options).find(
              opt => opt.text.toUpperCase().includes('UNITED KINGDOM') || opt.value === 'GB'
            );
            if (ukOption) {
              select.value = ukOption.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }
        // Click en GUARDAR / SAVE para confirmar
        const saveBtn = globalePopup.locator('button').filter({ hasText: /guardar|save/i }).first();
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          await saveBtn.click();
          await globalePopup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }
      }
    } catch { /* popup no presente */ }

    // ── 2. Welcome mat "ENJOY X% OFF" ───────────────────────────────────────
    // Aparece después del Globale popup. Botón DECLINE OFFER lo cierra.
    try {
      const declineBtn = this.page.getByRole('button', { name: /decline offer/i });
      if (await declineBtn.isVisible({ timeout: 5000 })) {
        await declineBtn.click();
      }
    } catch { /* modal no presente */ }

    // ── 3. Overlay residual de Globale ───────────────────────────────────────
    try {
      const globaleOverlay = this.page.locator('#globale_overlay, .globale_overlay').first();
      if (await globaleOverlay.isVisible({ timeout: 2000 })) {
        await globaleOverlay.evaluate(el => el.remove());
      }
    } catch { /* overlay no presente */ }
  }
}
