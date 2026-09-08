# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Playwright TypeScript E2E/UI automation for three Salesforce Commerce Cloud (SFCC SFRA) storefronts: **Hobbs**, **Phase Eight**, and **Inside Story**. The suite is designed to run against both a shared SFCC sandbox (Basic-Auth protected) and real production sites, controlled by `TARGET_ENV`.

Comments and docstrings in this codebase are written in Spanish. Match that convention when editing existing files; new brand-new modules can be in either language but stay consistent within a file.

## Commands

- `npm test` — run every project.
- `npm run test:sanity` — cross-site health checks (Hobbs · Phase Eight · Inside Story). Safe on production.
- `npm run test:hobbs` / `npm run test:phase-eight` / `npm run test:whistles` — one brand only.
- `TARGET_ENV=production npm run test:sanity` — sanity/E2E against real prod (skips Basic Auth, stops before payment confirmation).
- `npm run test:ui` / `test:headed` / `test:debug` — interactive Playwright runners.
- `npm run typecheck` — `tsc --noEmit`; type-check only, Playwright transpiles at runtime.
- `npm run report` — open the last HTML report (`reports/html`).
- `npm run codegen:hobbs` / `codegen:phase-eight` — launch Playwright codegen against staging.
- Single test: `npx playwright test <file> -g "<title substring>"` (add `--project=<name>` to pin the environment).

## Environments

`.env` supplies everything URL- and auth-related; nothing is hardcoded. Required variables:

- **Basic Auth (staging only):** `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` — SFCC sandbox is shared by all three brands and applied globally in `playwright.config.ts` via `httpCredentials`.
- **Staging URLs:** `HOBBS_BASE_URL`, `PHASE_EIGHT_BASE_URL`, `INSIDE_STORY_BASE_URL`, `SANDBOX_URL`.
- **Production URLs (only when `TARGET_ENV=production`):** `HOBBS_PROD_URL`, `PHASE_EIGHT_PROD_URL`, `INSIDE_STORY_PROD_URL`.

`TARGET_ENV` defaults to `staging`. When set to `production`:
1. `sanity` project drops Basic Auth (`isSandbox` flag in `playwright.config.ts`).
2. `sanity.data.ts` resolves URLs from the `*_PROD_URL` variables.
3. The E2E checkout spec stops after reaching the payment step instead of using the Adyen test card — production must never be charged.

## Architecture

### Projects (Playwright's `projects[]`)
Each brand is a Playwright *project* rather than a config file, sharing `use.httpCredentials` from the top-level `use` block:

- `hobbs`, `phase-eight`, `inside-story` — brand-specific suites; `baseURL` set from the matching `*_BASE_URL`. Tests use relative paths.
- `sanity` — cross-site suite that iterates over `sanitySiteData`. Tests use **absolute** URLs from the data file, so no `baseURL` is set. Basic Auth is applied conditionally.
- `manage-service` — hotfix / release / feature-branch suites (`hotfix-*`, `release-*`, `search-ui-optimisation`, `paid-returns`, `gift-cards`). Uses `SANDBOX_URL` as `baseURL`; individual specs supply absolute URLs from per-brand data files.

Global defaults in `use`: `retries: 1`, `workers: 2`, `maxFailures: 10`, `screenshot/video/trace: only-on-failure|retain-on-failure`, `actionTimeout: 15000`, `navigationTimeout: 30000`, `forbidOnly: !!process.env.CI`.

### Page Object Model
Every page inherits from `BasePage`, which owns cross-brand behavior (OneTrust cookie banner via `#onetrust-accept-btn-handler`, `goto`, `waitForVisible`). Hobbs, Phase Eight, and Inside Story share the same SFRA theme, so a **single set of Page Objects lives under `pages/common/`** and is reused by every brand. Diverge with a brand-specific subclass only when selectors truly can't be shared.

Selector guidance already baked in:
- SFRA uses `#shippingFirstNamedefault` etc. — checkout selectors keep both the SFRA `id` and the semantic `name` fallback.
- `.product-grid` exists twice on PLPs (a hidden pagination row + the real grid); wait on the first visible `.product-tile`, not on `.product-grid`.
- Adyen renders card fields in per-field iframes — use `frameLocator` per fieldtype (see `checkout.page.ts`).
- Cookie acceptance uses `try/catch` with a short timeout so tests never block on missing banners.

### Fixtures
`fixtures/pages.fixture.ts` extends `@playwright/test`'s `test` with pre-instantiated Page Objects. Tests should import from the fixture, not construct Page Objects manually:

```ts
import { test, expect } from '@fixtures/pages.fixture';
test('...', async ({ homePage, searchResultsPage }) => { ... });
```

When you add a new Page Object under `pages/common/`, wire it into `pages.fixture.ts`.

### Data
`data/sanity.data.ts` — brand list for the cross-site suites; the `resolveUrl` helper picks staging vs production URLs per `TARGET_ENV`.
`data/checkout.data.ts` — guest email, shipping address, and the Adyen **test-only** card (`4111 1111 1111 1111`). Never use these values against production.

### Path aliases (`tsconfig.json`)
`@pages/*` → `./pages/*`, `@fixtures/*` → `./fixtures/*`, `@data/*` → `./data/*`. Prefer aliases over long relatives; internal Page Object imports (e.g. `HomePage` importing `BasePage`) can stay relative since they live in the same folder.

## Current repo state — important

The initial commit dropped every file at the repo root. The intended layout (referenced by `tsconfig.json`'s `include` globs, `playwright.config.ts`'s `testDir: './tests'`, `testMatch` patterns like `'hobbs/**/*.spec.ts'`, and the `@pages/common/...` imports in the spec files) is:

```
tests/
  hobbs/               *.spec.ts
  phase-eight/         *.spec.ts
  inside-story/        *.spec.ts
  sanity/              cross-site-sanity.spec.ts, cross-site-e2e.spec.ts
  hotfix-*/, release-*/, search-ui-optimisation/, paid-returns/, gift-cards/
pages/
  common/              base.page.ts, home.page.ts, search-results.page.ts,
                       product-detail.page.ts, basket.page.ts, checkout.page.ts
fixtures/              pages.fixture.ts
data/                  sanity.data.ts, checkout.data.ts
```

Until the files are moved, `npm test` will fail — `testDir` doesn't exist and `@pages/common/...` imports won't resolve. When adding new specs or Page Objects, put them in the intended location above rather than at the root; when touching existing root files, consider relocating them as part of the same change.
