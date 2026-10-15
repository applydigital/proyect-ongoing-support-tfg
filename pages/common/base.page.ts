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
      await this.removeStaleOneTrustOverlay();
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
  /**
   * Confirmado en Phase Eight stage: el fondo oscuro del centro de preferencias de OneTrust
   * (`.onetrust-pc-dark-filter`) a veces queda visible aunque el panel que lo generó ya esté
   * oculto (display:none) — parece un bug de la propia integración de OneTrust. Ese fondo
   * intercepta clicks sobre cualquier elemento debajo, incluido el botón GUARDAR de Globale.
   * Se elimina del DOM solo si no tiene un panel visible asociado, para no tocarlo cuando el
   * centro de preferencias sí está siendo usado de verdad.
   */
  private async removeStaleOneTrustOverlay(): Promise<void> {
    await this.page.evaluate(() => {
      const filter = document.querySelector<HTMLElement>('.onetrust-pc-dark-filter');
      if (!filter) return;
      const panel = document.getElementById('onetrust-pc-sdk');
      const panelVisible = !!panel && getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().width > 0;
      if (!panelVisible) filter.remove();
    }).catch(() => {});
  }

  async dismissModalsIfPresent(): Promise<void> {
    let globaleWasSaved = false;
    await this.removeStaleOneTrustOverlay();

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

        // ── 1c. Intentar GUARDAR (guarda preferencia UK en Globale server-side).
        // GUARDAR hace una API call a Globale que activa el routing UK para
        // esta sesión — sin esto, Globale sigue routing ATC a Argentina.
        // El botón real es <input type="button" value="Guardar" data-action="SaveAndClose">,
        // NO un <a>/<button>/<input type="submit">. Su etiqueta vive en el atributo
        // `value`, no en textContent, así que un locator CSS + hasText nunca lo encuentra.
        // getByRole('button', {name}) sí resuelve el nombre accesible de un
        // input[type="button"] a partir de `value`.
        // Si GUARDAR no existe o falla, hacer CANCELAR como fallback.
        const saveBtn = globalePopup
          .getByRole('button', { name: /guardar|save|apply|done|continuar/i })
          .first();
        const saveBtnVisible = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (saveBtnVisible) {
          // El fondo de OneTrust puede reaparecer/renderizarse justo al abrirse el popup de
          // Globale — se vuelve a limpiar inmediatamente antes de este click puntual.
          await this.removeStaleOneTrustOverlay();
          await saveBtn.click();
          globaleWasSaved = true;
          // GUARDAR puede causar un page reload — esperar a que la página estabilice
          await this.page.waitForLoadState('domcontentloaded').catch(() => {});
          await this.page.waitForTimeout(1500);
        } else {
          // Fallback: CANCELAR si GUARDAR no aparece.
          // CANCELAR es un <a> sin href (sin rol implícito) con el texto en
          // textContent — el locator CSS + hasText sí funciona aquí.
          const cancelBtn = globalePopup.locator('a, button').filter({ hasText: /cancelar|cancel/i }).first();
          if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await cancelBtn.click();
          }
        }
        await globalePopup.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      }
    } catch { /* popup no presente */ }

    // ── 2. Welcome mat "ENJOY X% OFF" / "Want X% off your first order?" ────
    // Aparece después del Globale popup (o independiente en nueva sesión).
    // Si acabamos de hacer GUARDAR, damos más tiempo porque el popup
    // se renderiza después del reload.
    // El texto de "declinar" varía por marca: "Decline offer" (Hobbs),
    // "No, thank you" (Phase Eight), etc. — cubrir las variantes conocidas.
    try {
      const waitMs = globaleWasSaved ? 8000 : 5000;
      const declineTextPattern = /decline offer|no,? thank you|no thanks?|not now|maybe later/i;
      const declineBtn = this.page.getByRole('button', { name: declineTextPattern }).first();
      const declineLink = this.page.getByText(declineTextPattern).first();
      if (await declineBtn.isVisible({ timeout: waitMs }).catch(() => false)) {
        await declineBtn.click();
      } else if (await declineLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await declineLink.click();
      } else {
        // Fallback: cerrar el modal de suscripción por email vía su icono de cierre (X)
        // cuando el texto de "no gracias" no coincide con ningún patrón conocido.
        const closeIcon = this.page.locator(
          '[role="dialog"] button[aria-label*="close" i], .modal button[aria-label*="close" i], ' +
          '[class*="modal"] [class*="close-button"], [class*="modal"] button.close, ' +
          '[class*="modal"] button[class*="close" i]'
        ).first();
        if (await closeIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeIcon.click();
        }
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
