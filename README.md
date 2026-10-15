# Ongoing Support — Automatización E2E (Hobbs, Phase Eight, Whistles e Inside Story)

Suite de pruebas automatizadas con **Playwright** y patrón **Page Object Model (POM)** para dar soporte
continuo a las storefronts SFCC (SFRA) de **Hobbs**, **Phase Eight**, **Whistles** e **Inside Story**.
Se puede ejecutar contra **staging** (sandbox con Basic Auth) y contra **producción** (sin pagos).

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm ci
npx playwright install   # descarga los navegadores
```

## Configuración

1. Copia la plantilla de variables de entorno (está en la raíz del repo):
   ```bash
   cp .env.example .env
   ```
2. Rellena el `.env`:
   - `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD`: credenciales del sandbox de staging (compartidas por
     todas las marcas).
   - `*_BASE_URL`: URLs de staging de cada marca.
   - `*_PROD_URL`: URLs de producción (solo se usan con `TARGET_ENV=production`).

   Los valores reales **no están en el repositorio**: pídeselos al equipo. El `.env` está en `.gitignore` y
   **nunca** debe subirse.

## Ejecutar en staging

Por defecto `TARGET_ENV=staging`. Con el `.env` completo:

| Qué quieres probar | Comando |
|---|---|
| Sanity (health checks de las 4 marcas, Chrome · Firefox · Safari) | `npm run test:sanity` |
| Sanity solo UK, más rápido | `npm run test:sanity:uk` |
| Regression de staging (flujo completo hasta el pago con la tarjeta de test) | `npm run test:regression:staging` |
| Regression de staging DACH | `npm run test:regression:staging:dach` |
| Apple Pay (validación del billing contact sin dispositivo, Hobbs y Phase Eight; 2 tests) | `npx playwright test tests/release-8.33.0/apple-pay --project=manage-service` |
| Un solo test | `npx playwright test <archivo> -g "<parte del título>" --project=<project>` |
| Abrir el reporte HTML del último run | `npm run report` |

Para ver el navegador: añade `--headed` (o usa `npm run test:headed`). Para depurar: `npm run test:debug`.

## Ejecutar en producción

```bash
# bash
TARGET_ENV=production npm run test:sanity
npm run test:regression:prod        # Chrome, Safari (WebKit) y Edge
npm run test:regression:prod:uk     # solo UK
```

```powershell
# PowerShell
$env:TARGET_ENV="production"; npm run test:sanity
```

En producción:
- No se usa Basic Auth.
- Los tests de checkout **paran antes de confirmar el pago**: nunca se cobra.
- La tarjeta de test de Adyen (`data/checkout.data.ts`) es solo para staging.

## Verificar un release (carpeta `tests/release-X.Y.Z/`)

Cada release tiene su carpeta con:

- `RELEASE-X.Y.Z.md`: tabla de tickets con marcas, estado en dev y pendientes.
- `TFGTRS-XXXX/README.md`: resumen de cada ticket (y, si existe, su spec de Playwright).
- `testmo/`: casos de prueba en CSV para importar en **Testmo** (uno por ticket y un
  `RELEASE-X.Y.Z_all_testcases.csv` con todos).

Para re-verificar un release en staging:

1. Importa el CSV combinado en Testmo (formato de columnas: `Title, Priority, Template, Tags,
   Pre-Condition, Steps, Expected`).
2. Recorre los casos en staging. Ojo: las precondiciones y algunos datos (URLs de producto, campañas
   de prueba, stock manipulado) se prepararon en **dev**. Si un dato no existe en staging, hay que
   sustituirlo por uno equivalente.
3. Comprueba antes qué tickets ya están desplegados en staging; solo esos se pueden re-verificar ahí.
4. Los tickets con spec automático (por ejemplo el de Apple Pay o el de Adyen) se ejecutan con el
   comando `npx playwright test <carpeta del ticket> --project=manage-service`.

Para añadir un ticket nuevo a un release:

1. Crea `tests/release-X.Y.Z/testmo/TFGTRS-XXXX_testcases.csv` con el mismo formato de columnas.
2. Añade una fila a la tabla de `RELEASE-X.Y.Z.md` y crea su carpeta `TFGTRS-XXXX/` con un `README.md`.
3. Regenera el CSV combinado juntando los CSV individuales (una sola fila de cabecera).

## Estructura

```
.
├── playwright.config.ts      # projects: hobbs, phase-eight, inside-story, sanity-*, regression-*, manage-service
├── tsconfig.json             # alias @pages, @fixtures, @data
├── .env.example              # plantilla de variables (sin valores)
├── pages/common/             # Page Objects compartidos por las marcas (BasePage, Home, PDP, Basket, Checkout…)
├── fixtures/                 # fixtures que inyectan los Page Objects
├── data/                     # datos de prueba por marca (NO secretos)
├── scripts/                  # utilidades (resumen para Slack)
└── tests/
    ├── sanity/               # health checks cross-site
    ├── regression/           # regression E2E de staging y producción
    ├── release-*/            # tickets por release + casos de Testmo (incluye Apple Pay)
    └── hobbs/, phase-eight/  # suites por marca
```

Más detalle de arquitectura y selectores en [CLAUDE.md](CLAUDE.md).

## Notas

- La tienda detecta el país por IP (Global-E). Los specs inyectan la cookie `GlobalE_Data` (GB/GBP) y
  cierran el popup de país para no quedar bloqueados.
- Adyen pinta los campos de tarjeta en iframes (ver `pages/common/checkout.page.ts`).
- Las credenciales viven solo en `.env`; los datos no sensibles en `data/`.
