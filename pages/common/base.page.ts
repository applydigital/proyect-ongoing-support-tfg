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
    let globaleWasSaved = false;

    // ── 1. Globale country selector ──────────────────────────────────────────
    // Desde IPs no-UK aparece "¿A QUÉ PAÍS QUIERES QUE SE ENVÍE EL PEDIDO?"
    // Hay que seleccionar United Kingdom y hacer click en GUARDAR — solo
    // cerrar con × / CANCELAR no guarda cookie y el popup vuelve a aparecer.
    try {
      const globalePopup = this.page.locator('#globalePopupWrapper');
      if (await globalePopup.isVisible({ timeout: 5000 })) {
        const countrySelect = globalePopup.locator('select').first();
        if (await countrySelect.isVisible({ timeout: 3000 })) {
          // Intentar selectOption por valor ISO (GB) y por label como fallback
          try {
            await countrySelect.selectOption('GB');
          } catch {
            try {
              await countrySelect.selectOption({ label: 'United Kingdom' });
            } catch {
              await countrySelect.selectOption({ label: 'UNITED KINGDOM' });
            }
          }
        }
        // Botón GUARDAR — texto en español porque el popup detecta IP Argentina
        const saveBtn = globalePopup.locator('button').filter({ hasText: /guardar|save/i }).first();
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          // Iniciar escucha de navegación ANTES del click — patrón correcto de Playwright
          // para no perder el evento si el reload arranca de forma síncrona con el click
          const waitNav = this.page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          }).catch(() => null);
          await saveBtn.click();
          await waitNav; // null si Globale no hizo reload; si lo hizo, esperamos domcontentloaded
          globaleWasSaved = true;
        }
        await globalePopup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
    } catch { /* popup no presente */ }

    // ── 2. Welcome mat "ENJOY X% OFF" ───────────────────────────────────────
    // Aparece después del Globale popup (o independiente en nueva sesión).
    // Si acabamos de hacer GUARDAR, damos más tiempo porque el popup
    // se renderiza después del reload.
    try {
      const declineBtn = this.page.getByRole('button', { name: /decline offer/i });
      const waitMs = globaleWasSaved ? 8000 : 5000;
      if (await declineBtn.isVisible({ timeout: waitMs })) {
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
