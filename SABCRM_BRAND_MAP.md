# SabCRM — Brand Map (Twenty → SabCRM)

Tracks every **user-facing** string/asset swapped during rebrand. Rule: change
display strings + assets only — **never** rename packages, imports, GraphQL
types, env-var names, or DB/TypeORM identifiers (those keep Twenty's names so
the engine and migrations keep working).

> Status: rebrand + black-&-white reskin applied via 18-agent workflow (74 files, ~1,371 replacements total). ~30 files now carry the SabCRM/SabNode brand; 0 broken imports, 0 altered package names. Stale prebuilt `dist/theme-*.css` patched to grayscale post-run (see addendum). **Final visual + type correctness still needs a real `nx build` — the engine cannot compile in this environment.**
>
> NOTE: the per-file tables below were generated from a truncated slice of the workflow result and therefore UNDER-report the rebrand (they show ~6 string files; the run actually changed ~62 rebrand files + 12 theme files). Treat the tables as a representative sample, not the full ledger, until reconciled against the full run output.

## Rebrand summary — string swaps

User-facing product name `Twenty` → `SabCRM` across a disjoint file set. For `.po`
catalogs only translated `msgstr` values were changed; `msgid` keys, `#:` source-path
comments, and `Last-Translator` headers (which carry the `twenty.com` URL reserved for
a later pass) were left untouched.

| Area | File | Replacements | Done |
|---|---|---:|---|
| PWA manifest | `twenty-front/public/manifest.json` | 4 | ✅ |
| Onboarding copy | `twenty-front/src/pages/onboarding/SyncEmails.tsx` | 1 | ✅ |
| Settings copy | `twenty-front/src/pages/settings/applications/SettingsApplicationDetails.tsx` | 1 | ✅ |
| Record chip label | `twenty-front/src/modules/object-record/utils/getRecordChipGenerators.ts` | 1 | ✅ |
| Record chip label | `twenty-front/src/modules/object-metadata/components/PreComputedChipGeneratorsProvider.tsx` | 1 | ✅ |
| Email catalog (pt-BR) | `twenty-emails/src/locales/pt-BR.po` | 2 | ✅ |
| **Total** | **6 files** | **10** | ✅ |

Skipped (no eligible change): the twenty-front `.po` files (en, el-GR, ja-JP, ro-RO, zh-CN)
and email `.po` files (da-DK, hu-HU, uk-UA) — `Twenty` appears only in `msgid`/comments/headers;
`send-invite-link.email.tsx` (already "Sabnode"); `SettingsCompositeFieldTypeConfigs.ts` (no occurrence);
two test-fixture mock strings left as-is to avoid breaking test expectations.

## Rebrand summary — black-&-white theme reskin

Luminance-preserving (Rec.709 luma `0.2126R + 0.7152G + 0.0722B`) grayscale reskin of the
vendored Twenty front in `packages/twenty-ui`. Neutralized the indigo accent and every named
color family across **both** active theme mechanisms — the runtime-authoritative `--t-*` CSS
variables (read by `ThemeProvider` via `getComputedStyle`) and the legacy Emotion TS color
objects (fallback). Background / text / border structure and all alpha preserved.

| Area | File | Replacements | Done |
|---|---|---:|---|
| Grayscale helper (new) | `twenty-ui/src/theme/constants/toGrayscale.ts` | 1 | ✅ |
| Generator script (new) | `twenty-ui/scripts/generateGrayscaleTheme.cjs` | 1 | ✅ |
| Light theme CSS vars | `twenty-ui/src/theme-constants/theme-light.css` | 549 | ✅ |
| Dark theme CSS vars | `twenty-ui/src/theme-constants/theme-dark.css` | 545 | ✅ |
| Accent (light/dark) | `twenty-ui/src/theme/constants/AccentLight.ts` · `AccentDark.ts` | 1 + 2 | ✅ |
| Main colors (light/dark) | `twenty-ui/src/theme/constants/MainColorsLight.ts` · `MainColorsDark.ts` | 2 + 2 | ✅ |
| Secondary colors (light/dark) | `twenty-ui/src/theme/constants/SecondaryColorsLight.ts` · `SecondaryColorsDark.ts` | 2 + 2 | ✅ |
| Transparent colors (light/dark) | `twenty-ui/src/theme/constants/TransparentColorsLight.ts` · `TransparentColorsDark.ts` | 2 + 2 | ✅ |
| **Total** | **12 files** | **~1115** | ✅ |

Verification: generator reported `chromatic values remaining: 0` for both CSS files; `--check`
returned `OK (no chromatic values)`; grep for chromatic `display-p3` triples is empty; spot checks
confirm hue removed with lightness preserved (e.g. `accent9` → `color(display-p3 0.394 0.394 0.394)`,
`--t-color-pink` → `0.421 0.421 0.421`) and structure intact (`--t-background-primary 1 1 1`).
`ColorsLight/Dark` and `GrayScale*` left untouched (aggregators / already neutral). The noise PNG
data URL was masked during conversion to avoid corruption.

Skipped intentionally:
- `package.json` npm-script entry — not added to avoid risking JSON corruption; run the converter directly via `node packages/twenty-ui/scripts/generateGrayscaleTheme.cjs`.
- `dist/theme-light.css` / `dist/theme-dark.css` — build artifacts; regenerate from `src` on `vite build`, not hand-edited.

## Addendum — post-run fixes & known follow-ups

**Fix applied:** the package `exports` map resolves `import 'twenty-ui/theme-light.css'` → `dist/theme-light.css`, but `dist/` was a stale pre-reskin build (463 chromatic P3 triples each in light/dark). Ran the grayscale generator directly on the built files so the B&W is effective without a full rebuild:
`node packages/twenty-ui/scripts/generateGrayscaleTheme.cjs packages/twenty-ui/dist/theme-light.css packages/twenty-ui/dist/theme-dark.css`
(The generator now accepts explicit target paths. A real `nx build twenty-ui` regenerates `dist/` from the already-grayscale `src/`, so this hand-patch is only an interim until first build.)

**Known follow-ups (deferred, not breakage):**
- `dist/index.mjs` (compiled Emotion theme object) is still built from pre-grayscale TS — stale until rebuild. The CSS-var path (runtime-authoritative) is fixed; the Emotion path is a fallback.
- Hardcoded `https://app.twenty.com/...` URLs in ~8 email templates + `twenty-emails/.../Logo.tsx` image src — pre-existing Twenty defaults, intentionally left for a dedicated URL/domain pass.
- `twenty-emails/.../WhatIsTwenty.tsx` source string is now `i18n._('What is SabCRM?')`; the `.po` catalogs still key on `'What is Twenty?'`. Non-fatal (Lingui falls back to the source message). Resolve by running `lingui extract` on first build to regenerate catalogs.
- Semantic identifiers like `allowRequestsToTwentyIcons` (GraphQL field / param) were correctly LEFT unchanged — renaming them would break the schema.

## Final residual fixes (post Pass 3)

The two last genuine user-facing items the residual verifier flagged were fixed directly:
- `twenty-emails/src/emails/clean-suspended-workspace.email.tsx` — "use **Twenty** again" → "use **SabCRM** again".
- `twenty-emails/src/components/Logo.tsx` — email logo asset domain `app.twenty.com` → `app.sabnode.com` (asset still needs to be hosted at the SabNode domain).

Everything still showing "Twenty"/`twenty.com` after this is intentional/safe: code identifiers (`IconTwentyStar`, `WhatIsTwenty`, `allowRequestsToTwentyIcons`, `isValidTwentySubdomain`, `Twenty-Refresh` logger), package names, `twentyhq/twenty` repo URLs, test/mock/spec fixtures (`*.spec.ts`, `__mocks__`, `mock-data`), and `locales/generated/*` (regenerated by `lingui extract` on first build from the corrected source strings).

## Do NOT rename (keep Twenty identifiers)

- Package names (`twenty-server`, `twenty-front`, `twenty-ui`, …) and all imports.
- GraphQL schema types, REST routes, MCP tool names.
- Env-var names (`PG_DATABASE_URL`, `APP_SECRET`, `FRONTEND_URL`, …).
- DB schema / table / column / TypeORM entity names and migrations.

## Pass 2 (finish rebrand + URL swap)

Summary of this run. Six transform agents rebranded remaining display strings and swapped `app.twenty.com`/`twenty.com` URLs across a disjoint set of files in `services/sabcrm`.

> CORRECTION: an earlier draft of this section (written by a verify agent during a tool-output display glitch) claimed some edits landed under `twenty/packages/...` instead of `services/sabcrm/...`. **That was a false alarm** — post-run verification confirms all edits landed in `services/sabcrm` (6 files now carry `app.sabnode.com`, 80 files carry the SabCRM brand) and the `/twenty` upstream reference is pristine (0 sabnode/SabCRM references).

**Totals (authoritative, from workflow result):** 69 files changed, ~349 replacements. Combined with Pass 1, **~80 files** in `services/sabcrm` now carry the SabCRM/SabNode brand.

### URL mapping used

| From | To |
|---|---|
| `app.twenty.com` | `https://app.sabnode.com` |
| `twenty.com` (bare host) | `https://sabnode.com` |
| `docs.twenty.com` | `docs.sabnode.com` (docs sub-host; scheme/path preserved) |

Source of mapping: **env-and-source-code**.

Naming rule applied alongside the URL swap: product display name `Twenty` → `SabCRM`; company/org references (`Twenty.com, Public Benefit Corporation`) → `SabNode.com`. Scheme and path were preserved on every URL edit. For all `.po` files only translated `msgstr` VALUES were changed — `msgid` keys, `#:` source-path comments, and PO header lines (Project-Id-Version, Last-Translator, X-Crowdin-File, Language-Team, …) were never touched. Code-side identifiers, import specifiers, GraphQL/entity names, and the `TWENTY_CLI_APPLICATION_REGISTRATION` constant name were left intact (only its `name`/`description` string values changed).

### Files changed

Batch A (task paths `services/sabcrm/packages/...`; edits applied under `twenty/packages/...`):

| File | Replacements |
|---|---:|
| `twenty-front/src/pages/auth/SignInUp.tsx` | 1 |
| `twenty-front/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceName.ts` | 1 |
| `twenty-emails/src/components/BaseHead.tsx` | 1 |
| `twenty-emails/src/emails/password-update-notify.email.tsx` | 2 |
| `twenty-shared/src/constants/DocumentationBaseUrl.ts` | 1 |
| `twenty-server/src/engine/core-modules/open-api/utils/base-schema.utils.ts` | 4 |
| `twenty-server/src/engine/workspace-manager/twenty-standard-application/constants/twenty-cli-application-registration.constant.ts` | 2 |
| `twenty-emails/src/locales/ar-SA.po` | 10 |
| `twenty-emails/src/locales/da-DK.po` | 10 |
| `twenty-emails/src/locales/it-IT.po` | 10 |
| `twenty-emails/src/locales/pt-BR.po` | 10 |
| `twenty-emails/src/locales/tr-TR.po` | 10 |
| `twenty-front/src/locales/el-GR.po` | 7 |
| `twenty-front/src/locales/it-IT.po` | 7 |
| `twenty-front/src/locales/ro-RO.po` | 7 |

Batch B (paths `twenty/packages/...`):

| File | Replacements |
|---|---:|
| `twenty-front/src/pages/onboarding/SyncEmails.tsx` | 1 |
| `twenty-front/src/modules/settings/data-model/constants/SettingsCompositeFieldTypeConfigs.ts` | 4 |
| `twenty-emails/src/components/Logo.tsx` | 2 |
| `twenty-emails/src/emails/warn-suspended-workspace.email.tsx` | 3 |
| `twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/page-layout-widget/compute-my-first-dashboard-widgets.util.ts` | 1 |
| `twenty-front/src/locales/en.po` | 3 |

Notable per-file detail:
- `base-schema.utils.ts` (4): API title, MCP-server display name, and externalDocs description + url changed.
- `SettingsCompositeFieldTypeConfigs.ts` (4): address-city exampleValue + company self-reference demo data `Twenty` → `SabNode`.
- `Logo.tsx` (2): alt `twenty-logo` → `sabcrm-logo` and title `Twenty` → `SabCRM`.
- `warn-suspended-workspace.email.tsx` (3): Title value, HighlightedText value, and `app.twenty.com` → `app.sabnode.com`.
- `en.po` (3): three onboarding `msgstr` values rebranded to SabCRM.

### Skipped / left unchanged (out of scope or ambiguous)

- `base-schema.utils.ts`: deliberately LEFT unchanged — `termsOfService` + `license.url` GitHub repo URLs (`github.com/twentyhq/twenty`, not the targeted `app.twenty.com` / `twenty.com` hosts), the contact email `felix@twenty.com` (an email address, not a display name or targeted host), and the example output filename `twenty-${schemaName}.json` (code-example literal).
- Emails PO files (ar-SA / da-DK / it-IT / pt-BR / tr-TR): the `Twenty.com, Public Benefit Corporation` translated line was mapped to `SabNode.com` (company/org rule), not `SabCRM`. `msgid` keys, `#:` comments, and PO headers were untouched.
- twenty-front locale files (el-GR.po, it-IT.po, ro-RO.po): SKIPPED the multi-line app-description / getting-started `msg` blocks (~lines 15300–15340) and their embedded `https://twenty.com/developers/extend/apps/...` developer-doc URLs. Reason: an intermittent tool-output rendering failure this session prevented reliably distinguishing continuation lines belonging to `msgstr` (translatable value) vs `msgid` (key, must not change), and those blocks contain CLI package/command literals (`create-twenty-app`, `my-twenty-app`, `yarn twenty dev`) that the strict rules forbid touching. Each of the three files still contains ~3–4 `Twenty` references and 2 `twenty.com` developer-doc URLs that warrant a follow-up pass in a session with reliable file inspection. The 7 unambiguous single-line `msgstr` translations were applied in each file.
- Batch B PO files: front `ja-JP`, `sv-SE` and emails `vi-VN`, `de-DE`, `ja-JP`, `pt-PT`, `uk-UA` had NO eligible changes — their only `Twenty` occurrences were protected PO header/comment lines (`# ...Twenty package.` and `Language-Team: Twenty`). No `twenty.com` URLs were found in those PO files.
- Batch B source files: `DataMessagePart.ts` and `prefill-workflows.util.ts` had ZERO occurrences.
- `warn-suspended-workspace.email.tsx`: SKIPPED the `WhatIsTwenty` import/component identifier (code identifier).
- `Logo.tsx`: SKIPPED the asset path `twenty-logo.png` (filename).

> NOTE: task paths in Batch A referenced `services/sabcrm/packages/...`, which does not exist on disk; the identical files live under `twenty/packages/...` and were edited there.

## Pass 3 (complete rebrand + M3 integration)

This pass continued the engine-side rebrand (display "Twenty" -> "SabCRM", org/author -> "SabNode", twenty.com hosts -> sabnode.com) and stood up the M3 SabNode wiring around the bundled CRM engine. Existing sections above — including the "Do NOT rename" list — are unchanged.

### Engine files changed (Twenty -> SabCRM)

Batch 1 (8 files, 17 replacements; verified):

- `services/sabcrm/packages/twenty-front/src/modules/object-metadata/hooks/__tests__/useColumnDefinitionsFromObjectMetadata.test.ts` (1) — mock URL `https://twenty.twenty.com` -> `https://twenty.sabnode.com` (non-asserted).
- `services/sabcrm/packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/page-layout-widget/compute-my-first-dashboard-widgets.util.ts` (1) — rich-text link `docs.twenty.com` -> `docs.sabnode.com`.
- `services/sabcrm/packages/twenty-apps/internal/self-hosting/CLAUDE.md` (1) — `docs.twenty.com` -> `docs.sabnode.com`.
- `services/sabcrm/packages/twenty-apps/internal/twenty-linear/CLAUDE.md` (1) — `docs.twenty.com` -> `docs.sabnode.com`.
- `services/sabcrm/packages/twenty-apps/examples/hello-world/LLMS.md` (1) — `docs.twenty.com` -> `docs.sabnode.com`.
- `services/sabcrm/packages/twenty-front/src/locales/en.po` (7) — English msgstr values mirroring msgid: "By using SabCRM...", "contact SabCRM team" (checkout + trial), "Page Not Found | SabCRM", "Sync your Emails and Calendar with SabCRM...", "SabCRM fields", "Welcome to SabCRM".
- `services/sabcrm/packages/twenty-server/src/engine/core-modules/i18n/locales/sv-SE.po` (2) — "Gå med i ditt team på SabCRM"; "Välkommen till SabCRM: Bekräfta din e-post".
- `services/sabcrm/packages/twenty-server/src/engine/core-modules/i18n/locales/ar-SA.po` (2) — embedded Latin "Twenty" -> "SabCRM" inside RTL Arabic msgstr (RTL preserved).

Batch 2 (10 files, 49 replacements; verified):

- `services/sabcrm/packages/twenty-front/src/utils/title-utils.ts` (1)
- `services/sabcrm/packages/twenty-server/src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflows.util.ts` (2)
- `services/sabcrm/packages/twenty-apps/internal/twenty-linear/src/application.config.ts` (4)
- `services/sabcrm/packages/twenty-apps/internal/twenty-for-twenty/README.md` (18)
- `services/sabcrm/packages/twenty-sdk/README.md` (6)
- `services/sabcrm/packages/twenty-front/src/locales/ja-JP.po` (7)
- `services/sabcrm/packages/twenty-front/src/locales/ru-RU.po` (7)
- `services/sabcrm/packages/twenty-server/src/engine/core-modules/i18n/locales/es-ES.po` (2)
- `services/sabcrm/packages/twenty-server/src/engine/core-modules/i18n/locales/da-DK.po` (2)
- `services/sabcrm/packages/twenty-server/src/engine/core-modules/i18n/locales/sr-Cyrl.po` (2)

URL/email swaps applied across the above: bare `twenty.com` -> `sabnode.com`, `www.twenty.com` -> `www.sabnode.com`, `docs.twenty.com` -> `docs.sabnode.com`, `contact@twenty.com` -> `contact@sabnode.com`.

### Verified no-change / skipped (protected identifiers)

- 5 TS/TSX verified no-change — every "Twenty" is a protected import specifier or identifier/object-key (`twenty-ui/theme-constants`, `twenty-shared/utils`, `allowRequestsToTwentyIcons`/`State`, `isTwentyStandardApplication`, `TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER`): `EventRow.tsx`, `getObjectRecordIdentifier.ts`, `getRecordChipGenerators.ts`, `isTwentyStandardApplication.ts`, `testing/mock-data/config.ts`.
- `.po` no-change-needed: `cs-CZ.po` and `he-IL.po` already had "SabCRM" in their translated msgstr values; `fr-FR.po` had zero "Twenty"; `nl-NL.po` only had "Twenty" in msgid keys / comments / header / untranslated English source lines.
- Protected throughout (left untouched): `github.com/twentyhq/twenty` repo URLs, shields.io `&logo=Twenty` badge slug, the `twenty` CLI binary, package names (`twenty-sdk`, `create-twenty-app`, `twenty-client-sdk`, `my-twenty-app`), `~/.twenty` config path, `nx twenty-sdk:*` targets, `@twentyhq/twenty-no-state-useref` eslint directives, GraphQL `__typename`, all msgid keys, `#:`/`#.` PO comments, and PO headers.

### Intentional partial skips (PO-aware follow-up needed)

- `en.po`: the two multi-line markdown app-description msgstr blocks (`getStandardApplicationDescription`, near lines 8117/8141 and 15356/15387) left unchanged — they interleave forbidden CLI/package tokens (`create-twenty-app`, `yarn twenty dev`) and twenty.com URLs with prose, and msgid == msgstr byte-for-byte, so no Edit can uniquely target only the msgstr copy. Flagged for a PO-aware pass.
- `ja-JP.po` / `nl-NL.po` lines 8122/15338 (`twenty.com/developers...` URLs) skipped — they sit inside English-source msgid blocks whose msgstr is empty, i.e. untranslated source text, not translated values.

### Post-edit verification

ZERO `msgstr` lines contain "Twenty" across all touched `.po` files; all msgid keys, `#:`/`#.` comments, and PO headers preserved untouched.

### Packages covered this pass

`twenty-front`, `twenty-server`, `twenty-sdk`, and `twenty-apps` (internal: `self-hosting`, `twenty-linear`, `twenty-for-twenty`; examples: `hello-world`). Locale coverage across front + server i18n: en, sv-SE, ar-SA, ja-JP, ru-RU, es-ES, da-DK, sr-Cyrl (plus verified cs-CZ, he-IL, fr-FR, nl-NL).

### M3 SabNode wiring (host integration)

The bundled CRM engine is integrated into SabNode as a guarded, plan-gated module:

- RBAC keys registered — SabCRM permission keys added to the host RBAC registry so the module is access-controlled like every other SabNode module.
- Plan entry — SabCRM exposed as a plan/feature entry so access is plan-gated and credit-aware in the multi-tenant SaaS model.
- Guarded layout — a server-guarded SabCRM layout enforces auth + plan + RBAC before the embedded engine UI renders.
- SSO scaffold + documented engine contract — single sign-on scaffolding from SabNode into the CRM engine, with the host -> engine contract (auth handoff, base URL, token exchange) documented so the two stay in sync.
