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
        // ── 1a. Seleccionar país United Kingdom ──────────────────────────────
        const countrySelect = globalePopup.locator('select').first();
        if (await countrySelect.isVisible({ timeout: 3000 })) {
          try {
            await countrySelect.selectOption('GB');
          } catch {
            try {
              await countrySelect.selectOption({ label: 'United Kingdom' });
            } catch {
              await countrySelect.selectOption({ label: 'UNITED KINGDOM' });
            }
          }
          // Dejar que el JS de Globale procese el cambio de país (puede actualizar
          // la moneda automáticamente y preparar el estado interno de GUARDAR).
          await this.page.waitForTimeout(500);
        }
        // ── 1b. Seleccionar moneda Pound Sterling (UK) ───────────────────────
        // El popup tiene dos <select>: país y moneda. Globale requiere que la
        // moneda coincida con el país; si no se actualiza, GUARDAR puede fallar.
        try {
          const currencySelect = globalePopup.locator('select').nth(1);
          if (await currencySelect.isVisible({ timeout: 2000 })) {
            await currencySelect.selectOption({ label: 'Pound Sterling' });
          }
        } catch { /* moneda no presente o ya actualizada */ }

        // ── 1c. Botón GUARDAR ────────────────────────────────────────────────
        // Texto en español porque el popup detecta IP de Argentina.
        // Iniciar escucha de navegación ANTES del click.
        const saveBtn = globalePopup.locator('button, a, [role="button"], [type="submit"]').filter({ hasText: /guardar|save/i }).first();
        if (await saveBtn.isVisible({ timeout: 5000 })) {
          const waitNav = this.page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: 12000,
          }).catch(() => null);
          await saveBtn.click();
          await waitNav;
          globaleWasSaved = true;
        }
        await globalePopup.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
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

    // ── 3. Eliminación nuclear de overlays Globale y marketing que bloquean interacción ──
    // Aunque GUARDAR sete la cookie, Globale puede reinjectar el popup brevemente
    // después del reload. Eliminarlo del DOM garantiza que no intercepte clicks.
    await this.page.evaluate(() => {
      document.getElementById('globalePopupWrapper')?.remove();
      document.getElementById('globale_overlay')?.remove();
      document.querySelectorAll('[class*="globale_overlay"], [class*="globale-overlay"]').forEach(el => el.remove());
      // welcome mat bxc (brandcrush/klaviyo overlay)
      document.querySelectorAll('[id^="bx-campaign-"], .bx-type-overlay').forEach(el => el.remove());
    }).catch(() => { /* página puede haber navegado */ });
  }
}
