import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { BasketPage } from './basket.page';

/**
 * ProductDetailPage (PDP) — página de detalle de producto.
 *
 * Selectores basados en SFCC SFRA estándar. Si algún selector no coincide
 * con el sitio real, ajustar aquí sin tocar los tests.
 */
export class ProductDetailPage extends BasePage {
  readonly sizeButtons: Locator;
  readonly addToCartButton: Locator;
  readonly minicartGoToCart: Locator;
  readonly addToCartConfirmation: Locator;

  constructor(page: Page) {
    super(page);
    // Tallas disponibles. Cubre 3 markups SFRA:
    //  - Capsules list (Hobbs, Phase Eight actuales): <li class="size-capsules__list_item">
    //  - Legacy buttons: <button class="size-btn">
    //  - Variation attribute buttons: <button data-attr="size">
    this.sizeButtons = page.locator(
      '.size-capsules__list_item:not(.unselectable):not(.unavailable):not(.out-of-stock):not(.disabled):not([aria-disabled="true"]), ' +
      '.size-btn:not(.unselectable):not(.out-of-stock), ' +
      'button[data-attr="size"]:not([disabled])'
    );
    // Ancla al contenedor principal para evitar la sticky bar.
    // Cubre ambas variantes de clase (add-to-cart y add-to-bag según la marca/config):
    this.addToCartButton = page.locator(
      '.product-detail__add-to-cart button.add-to-cart:not([disabled]), ' +
      '.product-detail__add-to-cart button.add-to-bag:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-cart:not([disabled]), ' +
      '.prices-add-to-cart-actions button.add-to-bag:not([disabled]), ' +
      'button.add-to-cart:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton), ' +
      'button.add-to-bag:not([disabled]):not(.js-sticky-add-to-bag-btn):not(.stickyAddToBag):not(.stickyBarBagButton)'
    ).filter({ hasNotText: /select.?size/i }).first();
    this.minicartGoToCart = page.locator('.minicart .go-to-cart, .mini-cart .view-cart, a[href*="/cart"]').first();
    this.addToCartConfirmation = page.locator('.add-to-cart-messages, .cart-and-ipay').first();
  }

  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissModalsIfPresent();
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Selecciona la primera talla disponible.
   * Si el producto no tiene tallas (home goods, talla única) lo omite sin fallar.
   * Usa force:true para evitar que el Globale overlay bloquee el click sin modificar el DOM.
   */
  async selectFirstAvailableSize(): Promise<void> {
    const firstSize = this.sizeButtons.first();
    try {
      await firstSize.waitFor({ state: 'visible', timeout: 30000 });
      // Intentar click en el enlace/botón interno antes que en el <li> directamente,
      // para asegurar que los event handlers de SFCC se disparen correctamente.
      const innerLink = firstSize.locator('a, button').first();
      const hasInner = await innerLink.count() > 0;
      if (hasInner) {
        await innerLink.click({ force: true });
      } else {
        await firstSize.click({ force: true });
      }
      // Esperar a que SFCC procese la selección via AJAX (actualiza data-pid del botón ATC).
      // Sin este wait, el ATC puede enviarse con el PID maestro → "Please select a size".
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    } catch {
      // Sin selector de talla (producto de talla única o artículo de hogar) — no es necesario
    }
  }

  /** Añade el producto al carrito y navega a la cesta. */
  async addToCartAndGoToBasket(): Promise<BasketPage> {
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 30000 });

    // Estrategia Globale: si GUARDAR fue clickeado en dismissModalsIfPresent(), el cookie
    // GlobalE_Data={countryISO:"GB"} tiene firma válida de Globale. Al limpiar el dwsid
    // (sesión de Demandware creada desde IP Argentina), la próxima request de ATC inicia
    // una nueva sesión SFCC que leerá el cookie GB firmado y enrutará al carrito UK.
    try {
      const allCookies = await this.page.context().cookies();
      const globaleCookies = allCookies.filter(c =>
        c.name.toLowerCase().startsWith('globale') ||
        c.name.toLowerCase().startsWith('global_e') ||
        c.name.toLowerCase().startsWith('ge_')
      );
      // Limpiar SOLO los cookies de sesión de Demandware (no los de Globale)
      const nonDwCookies = allCookies.filter(c => !c.name.toLowerCase().startsWith('dw'));
      await this.page.context().clearCookies();
      if (nonDwCookies.length > 0) {
        await this.page.context().addCookies(nonDwCookies);
      }
    } catch { /* ignorar si la limpieza falla */ }

    // Capturar links del minicart ANTES del click ATC para saber cuáles son "nuevos".
    // Globale puede tener links pre-cargados que no son el carrito real del ATC.
    const baselineLinks = await this.page.evaluate(() => {
      const hrefs: string[] = [];
      for (const sel of ['.minicart .popover', '.minicart-body', '.mini-cart-content', '.mini-cart', '[class*="minicart"]']) {
        const mc = document.querySelector(sel);
        if (mc) {
          for (const a of Array.from(mc.querySelectorAll('a'))) {
            const href = (a as HTMLAnchorElement).href;
            if (href) hrefs.push(href);
          }
        }
      }
      return hrefs;
    }).catch(() => [] as string[]);

    // Capturar URLs de carrito desde respuestas de red ANTES del click ATC.
    const capturedCartUrls: string[] = [];
    const respHandler = (resp: import('@playwright/test').Response) => {
      const lurl = resp.url().toLowerCase();
      if (
        lurl.includes('global-e.com') || lurl.includes('globale') ||
        lurl.includes('cart-addproduct') || lurl.includes('addtocart') || lurl.includes('addtobag')
      ) {
        resp.json().then((body: Record<string, unknown>) => {
          const cartUrl = (
            body?.CartUrl || body?.cartUrl || body?.CheckoutUrl || body?.checkoutUrl ||
            body?.RedirectUrl || body?.redirectUrl || body?.Url || body?.url ||
            body?.globaleCartUrl || body?.GlobaleCartUrl
          ) as string | undefined;
          if (cartUrl && typeof cartUrl === 'string' && cartUrl.startsWith('http')) {
            capturedCartUrls.push(cartUrl);
          }
        }).catch(() => {});
      }
    };
    this.page.on('response', respHandler);

    await this.addToCartButton.evaluate(el => (el as HTMLElement).click());

    // Dismisser concurrente: cierra el popup de Globale si reaparece durante ATC.
    // Intenta GUARDAR (preferido) antes que CANCELAR — GUARDAR actualiza la sesión UK.
    let stopDismisser = false;
    const popupDismisser = (async () => {
      while (!stopDismisser) {
        const popup = this.page.locator('#globalePopupWrapper').first();
        if (await popup.isVisible({ timeout: 600 }).catch(() => false)) {
          const saveBtn = popup.locator('a, button').filter({ hasText: /guardar|save/i }).first();
          if (await saveBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await saveBtn.evaluate(el => (el as HTMLElement).click()).catch(() => {});
          } else {
            const cancel = popup.locator('a, button').filter({ hasText: /cancelar|cancel/i }).first();
            await cancel.evaluate(el => (el as HTMLElement).click()).catch(() => {});
          }
          await this.page.waitForTimeout(200);
        } else {
          await this.page.waitForTimeout(400);
        }
      }
    })();

    // Polling rápido (~100ms) buscando links NUEVOS en el minicart (no presentes antes del ATC).
    // Sin check de visibilidad para no perder el minicart durante animaciones CSS.
    const bagHrefHandle = await this.page.waitForFunction((baseline: string[]) => {
      const mcSelectors = [
        '.minicart .popover',
        '.minicart-body',
        '.mini-cart-content',
        '.mini-cart',
        '.minicart-container',
        '[class*="minicart"]:not([class*="link"]):not([class*="quantity"]):not([class*="count"])',
      ];
      // Patrón de URL de carrito: solo aceptar links que apuntan al bag/cart/checkout.
      // NO aceptar links de producto (PDP) que aparecen en el minicart — solo el link de bolsa.
      const bagUrlPat = /\/bag|\/cart|\/basket|\/checkout/i;
      for (const sel of mcSelectors) {
        const mc = document.querySelector(sel);
        if (!mc) continue;
        for (const a of Array.from(mc.querySelectorAll('a'))) {
          const href = (a as HTMLAnchorElement).href;
          if (href && bagUrlPat.test(href) && !href.startsWith('javascript:') && !href.startsWith('blob:') && !href.startsWith('data:') && !href.endsWith('#') && href !== window.location.href && !baseline.includes(href)) {
            return href;
          }
        }
      }
      // Buscar links de checkout/bag NUEVOS en toda la página (por texto del link).
      const textPat = /view bag|go to bag|my bag|view cart|go to cart|view basket|checkout securely|proceed to checkout|checkout now/i;
      for (const a of Array.from(document.querySelectorAll('a'))) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || href.startsWith('javascript:') || href.endsWith('#') || href === window.location.href || baseline.includes(href)) continue;
        const text = ((a as HTMLElement).textContent || '').trim() + ' ' + (a.getAttribute('aria-label') || '');
        if (textPat.test(text)) return href;
      }
      return false;
    }, baselineLinks, { timeout: 15000 }).catch(() => null);

    stopDismisser = true;
    this.page.off('response', respHandler);
    await popupDismisser;

    let cartUrl: string | null = null;

    // Fuente 1: DOM polling con baseline (link nuevo en minicart)
    if (bagHrefHandle) {
      const href = String(await bagHrefHandle.jsonValue().catch(() => ''));
      if (href && href !== 'false' && href !== 'null' && href !== '') cartUrl = href;
    }

    // Fuente 2: Respuestas de red (API de Globale)
    if (!cartUrl && capturedCartUrls.length > 0) cartUrl = capturedCartUrls[0];

    // Fuente 3: Abrir minicart manualmente si el carrito tiene items (cantidad > 0)
    if (!cartUrl) {
      await this.page.evaluate(() => {
        const icon = document.querySelector<HTMLElement>(
          '.minicart-link, .minicart > a, [class*="minicart-link"]'
        );
        if (icon) icon.click();
      }).catch(() => {});
      await this.page.waitForTimeout(1500);

      cartUrl = await this.page.evaluate((baseline: string[]) => {
        for (const sel of ['.minicart .popover', '.popover.show', '.minicart-body', '.mini-cart']) {
          const mc = document.querySelector(sel);
          if (!mc) continue;
          for (const a of Array.from(mc.querySelectorAll('a'))) {
            const href = (a as HTMLAnchorElement).href;
            if (href && !href.startsWith('javascript:') && !href.endsWith('#') && href !== window.location.href && !baseline.includes(href)) return href;
          }
        }
        return null;
      }, baselineLinks).catch(() => null);
    }

    // Sanear cartUrl: descartar cualquier URL no navegable (javascript:, blob:, data:).
    if (cartUrl && (cartUrl.startsWith('javascript:') || cartUrl.startsWith('blob:') || cartUrl.startsWith('data:'))) {
      cartUrl = null;
    }

    if (cartUrl) {
      const finalUrl = cartUrl.startsWith('http')
        ? cartUrl
        : `${new URL(this.page.url()).origin}${cartUrl}`;
      await this.page.goto(finalUrl);
    } else {
      const currentUrl = new URL(this.page.url());
      const firstSegment = currentUrl.pathname.split('/')[1];
      const knownRegions = ['au', 'us', 'eu', 'row', 'de'];
      const regionPrefix = knownRegions.includes(firstSegment) ? `/${firstSegment}` : '';
      await this.page.goto(`${currentUrl.origin}${regionPrefix}/bag`);
    }

    await this.page.waitForLoadState('domcontentloaded');
    return new BasketPage(this.page);
  }
}
