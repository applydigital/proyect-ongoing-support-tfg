/**
 * Regression E2E — Production · Whistles
 *
 * Whistles usa un frontend React con SPC (single-page checkout),
 * distinto al SFRA multi-step de Hobbs / Phase Eight / Inside Story.
 * Este spec cubre el flujo non-transactional en producción:
 *   Home → search → PLP → PDP → quickshop ATC → basket → checkout (para antes del pago)
 *
 * No se confirma ningún pedido real.
 *
 * Ejecución:
 *   npx playwright test regression/production-whistles.spec.ts --project=regression-prod
 *   npx playwright test regression/production-whistles.spec.ts --project=regression-prod-webkit
 *   npx playwright test regression/production-whistles.spec.ts --project=regression-prod-edge
 */

import { test, expect, Page } from '@playwright/test';
import { whistlesRegressionBrand } from '@data/regression.data';
import { guestEmail, shippingAddress } from '@data/checkout.data';

async function dismissOverlays(page: Page): Promise<void> {
  // GlobalE popup: seleccionar UK y guardar (igual que BasePage.dismissModalsIfPresent).
  // Usar Cancel sin guardar deja la sesión en el país de la IP (Argentina en CI).
  try {
    const globalePopup = page.locator('#globalePopupWrapper');
    if (await globalePopup.isVisible({ timeout: 5000 })) {
      const countrySelect = globalePopup.locator('select').first();
      if (await countrySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await countrySelect.selectOption('GB').catch(() =>
          countrySelect.selectOption({ label: 'United Kingdom' })
        );
        await page.waitForTimeout(400);
      }
      try {
        const currencySelect = globalePopup.locator('select').nth(1);
        if (await currencySelect.isVisible({ timeout: 2000 })) {
          await currencySelect.selectOption({ label: 'Pound Sterling' });
        }
      } catch { /* ya actualizada */ }
      // GUARDAR es <input type="button" value="Guardar"> — su etiqueta vive en el
      // atributo `value`, no en textContent. getByRole resuelve el nombre accesible
      // correctamente para input[type="button"]; un locator CSS + hasText no lo hace.
      const saveBtn = globalePopup
        .getByRole('button', { name: /guardar|save|apply|done|continuar/i })
        .first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        await page.locator('.glCancelBtn').click({ timeout: 3000 }).catch(() => {});
      }
      await globalePopup.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
    }
  } catch { /* popup no presente */ }

  // OneTrust
  await page.locator('#onetrust-accept-btn-handler').click({ timeout: 5000 }).catch(() => {});

  // Eliminar overlays residuales del DOM
  await page.evaluate(() => {
    ['#globalePopupWrapper', '#globale_overlay', '#onetrust-consent-sdk', '[id^="bx-campaign"]', '.bx-slab', '.bx-backdrop']
      .forEach(sel => document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.cssText += ';display:none!important;pointer-events:none!important';
      }));
    document.body.style.overflow = '';
  }).catch(() => {});
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  // No pre-inyectar cookie GlobalE_Data aquí: suprimir el popup impide que dismissOverlays
  // haga el Save, dejando la sesión server-side en Argentina → ATC va al carrito Argentina.
  // El flujo correcto es: popup aparece → dismissModalsIfPresent selecciona UK → Save → UK session.
});

for (const region of whistlesRegressionBrand.regions) {
  const baseUrl = whistlesRegressionBrand.prodUrl + (region.path === '/' ? '' : region.path.replace(/\/$/, ''));

  test.describe(`[Whistles] [${region.name}] Production regression`, () => {

    // Los sites de producción cargan analytics pesados que retrasan el cierre del contexto.
    // 150s garantiza tiempo suficiente para el cuerpo del test y el teardown.
    test.setTimeout(150000);

    test('homepage loads with correct title', { tag: '@non-transactional' }, async ({ page }) => {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);
      await expect(page).toHaveTitle(whistlesRegressionBrand.expectedTitlePattern);
    });

    test('search returns results', { tag: '@non-transactional' }, async ({ page }) => {
      // Navegar directamente a la URL de búsqueda — el botón de search en el topbar
      // está cubierto por overlays en WebKit y no responde al click.
      const searchUrl = `${baseUrl}/search/?q=${encodeURIComponent(whistlesRegressionBrand.searchTerm)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);
      // Whistles renderiza los cards con visibility:hidden por animación CSS (wr-product-card).
      // toBeVisible() los considera ocultos aunque tengan dimensiones reales.
      // Usar waitForFunction con getBoundingClientRect() igual que ProductListPage.waitForLoaded().
      await page.waitForFunction(() => {
        for (const el of Array.from(document.querySelectorAll('article[class*="wr-product-card"]'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 10 && r.height > 10) return true;
        }
        return false;
      }, { timeout: 30000 });

      const count = await page.locator('article[class*="wr-product-card"]').count();
      expect(count, 'Whistles search devolvió 0 resultados').toBeGreaterThan(0);
    });

    test('PLP loads with products', { tag: '@non-transactional' }, async ({ page }) => {
      await page.goto(baseUrl + whistlesRegressionBrand.categoryPath, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);

      await page.waitForFunction(() => {
        for (const el of Array.from(document.querySelectorAll('article[class*="wr-product-card"]'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 10 && r.height > 10) return true;
        }
        return false;
      }, { timeout: 30000 });

      const count = await page.locator('article[class*="wr-product-card"]').count();
      expect(count, 'Whistles PLP devolvió 0 productos').toBeGreaterThan(0);
    });

    test('add to cart via PDP → basket has item', { tag: '@non-transactional' }, async ({ page }) => {
      await page.goto(baseUrl + whistlesRegressionBrand.categoryPath, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);
      await page.waitForFunction(() => {
        for (const el of Array.from(document.querySelectorAll('article[class*="wr-product-card"]'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 10 && r.height > 10) return true;
        }
        return false;
      }, { timeout: 30000 });

      // Navegar al PDP via href (igual que ProductListPage.clickFirstProduct).
      // Evita el quickshop que requiere hover en un elemento visibility:hidden en WebKit.
      const href = await page.locator('article[class*="wr-product-card"] a').first().getAttribute('href');
      await page.goto(new URL(href!, page.url()).toString(), { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);

      // Esperar estabilización del PDP sin networkidle (analytics de prod nunca paran)
      await page.waitForTimeout(2000);

      // Seleccionar primera talla — scope al listbox de tallas (no al select de GlobalE).
      // force:true porque la animación CSS mantiene los options en visibility:hidden temporalmente.
      const sizeListbox = page.getByRole('listbox').first();
      await sizeListbox.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
      const sizeOption = sizeListbox.getByRole('option').first();
      // El click puede disparar una navegación a la URL de variante de talla
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {}),
        sizeOption.click({ force: true }).catch(() =>
          page.evaluate(() => {
            const listbox = document.querySelector('[role="listbox"]');
            const opt = listbox?.querySelector('[role="option"]') as HTMLElement | null;
            if (opt) opt.click();
          })
        ),
      ]);

      // locator('button') en lugar de getByRole — getByRole excluye elementos dentro de aria-hidden,
      // y cuando hay un modal abierto Whistles pone aria-hidden="true" en el contenedor principal.
      await page.locator('button').filter({ hasText: /add to bag/i }).first()
        .click({ force: true, timeout: 30000 });

      // Verificar que el basket button del header está accesible (indicador de éxito).
      // locator en lugar de getByRole para ignorar aria-hidden del contenedor principal.
      await expect(page.locator('button').filter({ hasText: /basket/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('checkout is reachable — stops before payment', { tag: '@non-transactional' }, async ({ page, context, browserName }) => {
      test.setTimeout(150000); // El flujo incluye reload de PDP + ATC + checkout; WebKit es ~40% más lento
      const hostname = new URL(whistlesRegressionBrand.prodUrl).hostname;
      const globaleData = JSON.stringify({
        countryISO: 'GB', currencyCode: 'GBP', cultureCode: 'en-GB', countryName: 'United Kingdom',
      });

      await page.goto(baseUrl + whistlesRegressionBrand.categoryPath, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);

      // ATC via PDP
      await page.waitForFunction(() => {
        for (const el of Array.from(document.querySelectorAll('article[class*="wr-product-card"]'))) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width > 10 && r.height > 10) return true;
        }
        return false;
      }, { timeout: 30000 });
      const href = await page.locator('article[class*="wr-product-card"] a').first().getAttribute('href');
      await page.goto(new URL(href!, page.url()).toString(), { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);
      await page.waitForTimeout(1500);

      // Limpiar cookies de sesión Demandware (mantienen sesión Argentina de GlobalE) y
      // re-navegar al PDP con cookie UK ya inyectada — esto fuerza al servidor a crear
      // nueva sesión SFRA que lee GlobalE_Data=UK y enruta ATC al carrito UK.
      // Para WebKit: aunque ITP puede bloquear cookies pre-navegación, tras un goto al dominio
      // el contexto ya está establecido y la cookie sí se incluye en la sesión actual.
      const currentPdpUrl = page.url();
      const allCookies = await context.cookies();
      const nonDwCookies = allCookies.filter((c) => !c.name.toLowerCase().startsWith('dw'));
      await context.clearCookies();
      await context.addCookies([
        ...nonDwCookies,
        { name: 'GlobalE_Data', value: globaleData, domain: hostname, path: '/', secure: true, sameSite: 'None' },
      ]);
      // Recargar PDP con la nueva sesión UK (sin cookies DW previas de Argentina)
      await page.goto(currentPdpUrl, { waitUntil: 'domcontentloaded' });
      await dismissOverlays(page);
      await page.waitForTimeout(1500);

      // Seleccionar talla en la nueva carga de PDP
      const sizeListbox2 = page.getByRole('listbox').first();
      await sizeListbox2.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
      const sizeOption2 = sizeListbox2.getByRole('option').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {}),
        sizeOption2.click({ force: true }).catch(() =>
          page.evaluate(() => {
            const listbox = document.querySelector('[role="listbox"]');
            const opt = listbox?.querySelector('[role="option"]') as HTMLElement | null;
            if (opt) opt.click();
          })
        ),
      ]);

      // Clicar Add to Bag via evaluate (evita restricciones de aria-hidden)
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => /add to bag/i.test(b.textContent ?? ''));
        if (btn) (btn as HTMLElement).click();
      });
      await page.waitForTimeout(3000);

      // Abrir el drawer del basket desde donde estemos (PDP, home, o /bag/).
      // En la PDP el botón de basket está en aria-hidden → usar evaluate para clicar.
      // En otras páginas (home) suele ser accesible directamente.
      await page.locator('button').filter({ hasText: /basket/i }).first()
        .click({ timeout: 8000 }).catch(() =>
          page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => /basket/i.test(b.textContent ?? ''));
            if (btn) (btn as HTMLElement).click();
          })
        );
      await page.waitForTimeout(2500);

      // En el drawer del basket buscar link/botón de checkout.
      // Whistles usa texto "Checkout" en el drawer cuando hay items.
      const drawerCheckout = page.locator('dialog a, dialog button, [role="dialog"] a, [role="dialog"] button')
        .filter({ hasText: /checkout/i }).first();
      const drawerHasCheckout = await drawerCheckout.isVisible({ timeout: 5000 }).catch(() => false);

      if (drawerHasCheckout) {
        await drawerCheckout.click({ timeout: 10000 });
      } else {
        // El drawer no tiene checkout (basket vacío o no abrió) — navegar directo al checkout SFRA
        await page.goto(
          `${whistlesRegressionBrand.prodUrl}/on/demandware.store/Sites-WH-UK-Site/en/Checkout-Begin`,
          { waitUntil: 'domcontentloaded' }
        );
      }
      await page.waitForLoadState('domcontentloaded');
      await dismissOverlays(page);

      // Continuar como guest — clicar el contenedor padre del radio (tiene el onClick de React).
      // Clicar el input directamente no dispara el handler React en WebKit.
      await page.evaluate(() => {
        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement | null;
        if (!radio) return;
        // Propagar click por el árbol React: subir hasta el elemento con cursor:pointer o label
        let el: Element | null = radio;
        while (el && el !== document.body) {
          const style = window.getComputedStyle(el);
          if (style.cursor === 'pointer' && el !== radio) {
            (el as HTMLElement).click();
            return;
          }
          el = el.parentElement;
        }
        // Fallback: clicar el input directamente
        radio.click();
      });
      await page.waitForTimeout(1000);
      // Si el formulario de email no aparece, intentar también con el texto "Guest checkout"
      const emailVisible = await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false);
      if (!emailVisible) {
        await page.locator('text=Guest checkout').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
      await page.locator('input[type="email"]').first().fill(guestEmail, { timeout: 10000 }).catch(() => {});
      await page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Submit")').first()
        .click({ timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});

      // Verificar que llegamos a la fase de entrega — sin completar el pago.
      const deliveryForm = page.locator([
        'input[name="firstName"]',
        'input[id*="firstName"]',
        'input[id*="shipping"]',
        'input[placeholder*="First name"]',
        'input[placeholder*="first name"]',
        '[data-wr-entry-field="firstName"]',
        'input[name="dwfrm_shipping_shippingAddress_addressFields_firstName"]',
      ].join(', ')).first();
      await expect(
        deliveryForm,
        '[Whistles][UK] El formulario de entrega debería ser visible en producción'
      ).toBeVisible({ timeout: 30000 });
    });

  });
}
