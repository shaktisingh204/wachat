# Twenty CRM — Server Core-Modules Review: Billing, Usage, Admin, Observability, Infra

> Read-only catalog of `twenty-server/src/engine/core-modules`. Descriptions are original; no source is reproduced verbatim. All entities live in the Postgres `core` schema unless noted; analytics/event tables live in **ClickHouse** (optional, gated by `CLICKHOUSE_URL`).

---

## billing

**Purpose.** Full Stripe-backed subscription, metering, entitlement, and credit-grant engine. Marked `@license Enterprise`. Mirrors Stripe objects (products, prices, meters, customers, subscriptions, subscription items, entitlements) into local Postgres tables so the app can read billing state without round-tripping to Stripe, then issues checkout/portal sessions and plan/interval switches back to Stripe. Activated only when `IS_BILLING_ENABLED` is true.

### Data model (Postgres `core` schema)

| Entity | Key fields | Notes |
|---|---|---|
| `BillingCustomerEntity` | `workspaceId` (unique), `stripeCustomerId` (unique), `creditBalanceMicro` (bigint, micro-credit ledger) | 1 customer per workspace; owns subscriptions + entitlements |
| `BillingSubscriptionEntity` | `workspaceId`, `stripeSubscriptionId` (unique), `status`, `interval`, `currency`, `currentPeriodStart/End`, `cancelAtPeriodEnd`, `cancelAt`, `canceledAt`, `trialStart/End`, `collectionMethod`, `phases` (jsonb schedule), `automaticTax`, `cancellationDetails`, `metadata` | Partial-unique index: only ONE active/trialing/past_due subscription per workspace |
| `BillingSubscriptionItemEntity` | `billingSubscriptionId`, `stripeProductId`, `stripePriceId`, `stripeSubscriptionItemId` (unique), `quantity`, `hasReachedCurrentPeriodCap`, `billingThresholds` | Unique on (subscription, product); each item is a product line on a subscription |
| `BillingProductEntity` | `stripeProductId` (unique), `name`, `active`, `description`, `images`, `marketingFeatures`, `defaultStripePriceId`, `metadata` (`BillingProductMetadata` → carries `productKey`), `unitLabel` | Catalog product (Base Plan / Resource Credit) |
| `BillingPriceEntity` | `stripePriceId` (unique), `stripeProductId`, `currency`, `type` (ONE_TIME/RECURRING), `usageType` (METERED/LICENSED), `billingScheme`, `interval`, `taxBehavior`, `tiers`, `recurring`, `transformQuantity`, `unitAmount`/`unitAmountDecimal`, `stripeMeterId`, `metadata` (`planKey`) | Tiered/metered/licensed pricing mirror |
| `BillingMeterEntity` | `stripeMeterId` (unique), `displayName`, `eventName`, `status`, `customerMapping`, `valueSettings`, `eventTimeWindow` | Stripe Billing Meter mirror for usage-based pricing |
| `BillingEntitlementEntity` | `key` (`BillingEntitlementKey`), `workspaceId`, `stripeCustomerId`, `value` (bool) | Unique on (key, workspace); feature gate driven by Stripe entitlement summary |

### Enums (the plan/entitlement model)

- **`BillingPlanKey`**: `PRO`, `ENTERPRISE` — the two sellable plans.
- **`BillingProductKey`**: `BASE_PRODUCT`, `RESOURCE_CREDIT` — a subscription has a base seat product plus an optional credit product.
- **`BillingEntitlementKey`**: `SSO`, `CUSTOM_DOMAIN`, `RLS`, `AUDIT_LOGS` — boolean feature gates resolved per workspace.
- **`BillingUsageType`**: `METERED`, `LICENSED`. **`BillingPriceType`**: `ONE_TIME`, `RECURRING`.
- **`SubscriptionStatus`**: active, trialing, past_due, canceled, incomplete, incomplete_expired, paused, unpaid.
- **`SubscriptionInterval`**: month/year. **`BillingWebhookEvent`**: 16 Stripe event types handled (see billing-webhook).
- **`AvailableProduct`**: `base-plan`.

### Stripe integration model

- **`stripe/stripe-sdk/`** — wraps the Stripe SDK (real + mock service for tests).
- **`stripe/services/`** — one service per Stripe resource: `stripe-product`, `stripe-price`, `stripe-subscription`, `stripe-subscription-item`, `stripe-subscription-schedule`, `stripe-customer`, `stripe-checkout`, `stripe-billing-portal`, `stripe-invoice`, `stripe-billing-meter`, `stripe-billing-meter-event` (reports metered usage), `stripe-credit-grant` (grants credits in Stripe), `stripe-webhook` (signature verification + event construction).
- **Flow:** checkout/portal sessions are created via `BillingPortalWorkspaceService`. 7-day trials (no card) create a subscription directly; 30-day trials (card required) go through a Stripe Checkout Session. Subscription edits (interval switch, plan switch, resource-credit price change, and their cancel-switch counterparts) are computed via subscription **schedules** (`phases`) and pushed to Stripe.

### Credits & metered usage

- `ResourceCreditService` + `BillingCreditRolloverService` — manage micro-credit grants and period rollover.
- `BillingUsageService` — `hasAvailableCredits[OrThrow]`, `canFeatureBeUsed`, current-period usage, and a Redis-cached available-credit balance (namespace `engine:billing-usage`) sourced from ClickHouse `usageEvent`; supports decrement/invalidate/warm/flush.
- `BillingUsageCapService` — enforces per-period caps (`hasReachedCurrentPeriodCap`).
- `StripeBillingMeterEventService` — reports consumption back to Stripe meters.

### API surface (`BillingResolver`, GraphQL)

| Operation | Type | Guard |
|---|---|---|
| `billingPortalSession` | Query | BILLING permission |
| `checkoutSession` | Mutation | user+workspace auth |
| `switchSubscriptionInterval` / `cancelSwitchBillingInterval` | Mutation | BILLING |
| `switchBillingPlan` / `cancelSwitchBillingPlan` | Mutation | BILLING |
| `setResourceCreditSubscriptionPrice` / `cancelSwitchResourceCreditPrice` | Mutation | BILLING |
| `listPlans` | Query | workspace auth |
| `endSubscriptionTrialPeriod` | Mutation | BILLING |
| `getResourceCreditUsage` | Query | BILLING |

- **Commands:** `billing-sync-customer-data`, `billing-sync-plans-data`, `billing-update-subscription-price`.
- **App billing** (`app-billing/`) — separate REST controller for one-off charges (`charge.dto`).
- `BillingService.hasEntitlement()` / `hasWorkspaceAnySubscription()` are the gates consumed by other modules (e.g. event-logs requires `AUDIT_LOGS`); **both return `true` when billing is disabled.**

---

## billing-webhook

**Purpose.** Public REST endpoint (`POST /webhooks/stripe`) that verifies the Stripe signature and fans events out to per-resource sync services, keeping the local mirror tables consistent with Stripe.

| Event(s) | Handler |
|---|---|
| `setup_intent.succeeded` | retries unpaid invoices |
| `price.created/updated` | `BillingWebhookPriceService` |
| `product.created/updated` | `BillingWebhookProductService` |
| `subscription_schedule.updated` | `BillingWebhookSubscriptionScheduleService` (phases) |
| `entitlements.active_entitlement_summary.updated` | `BillingWebhookEntitlementService` |
| `invoice.finalized/paid` | `BillingWebhookInvoiceService` (also fires `payment-received` audit event) |
| `customer.created` | `BillingWebhookCustomerService` |
| `customer.subscription.created/updated/deleted` | `BillingWebhookSubscriptionService` (requires `workspaceId` in subscription metadata; throws if missing) |
| `billing.alert.triggered`, `billing.credit_grant.*` | enum-declared (credit-grant/threshold handling) |

**Notable.** Uses `transform-stripe-*-to-database-*` util converters per resource. Requires raw request body for signature verification. All errors normalized to `BillingException`.

---

## usage

**Purpose.** Workspace-level usage analytics over the ClickHouse `usageEvent` table (token/credit/invocation metering). `@license Enterprise`.

### Data model
- ClickHouse table `usageEvent`: `timestamp`, `workspaceId`, `userWorkspaceId`, `resourceType`, `operationType`, `quantity`, `unit`, `creditsUsedMicro`, `resourceId`, `resourceContext`, `periodStart`, `metadata`.
- Enums: **`UsageResourceType`** (AI, WORKFLOW, APP, STORAGE, API, LOGIC_FUNCTION); **`UsageOperationType`** (AI_CHAT_TOKEN, AI_WORKFLOW_TOKEN, WORKFLOW_EXECUTION, CODE_EXECUTION, WEB_SEARCH); **`UsageUnit`** (CREDIT, TOKEN, INVOCATION, MINUTE, BYTE).

### API surface
- `UsageEventWriterService.writeToClickHouse()` — fire-and-forget batch insert (no-ops if ClickHouse unset).
- `UsageAnalyticsService` — breakdowns by user / operation type / model (`resourceContext`) / time-series, plus an admin cross-workspace AI-usage breakdown; all grouped queries use a whitelisted `groupByField` and a 50-row limit.
- `UsageResolver.getUsageAnalytics` (Query, WORKSPACE permission) — aggregates the above and resolves user-workspace ids to display names; credits converted micro→display via `to-display-credits`.
- `usage-event.listener` consumes a `usage-recorded` event constant to write rows.

---

## admin-panel

**Purpose.** Self-host/admin GraphQL surface (guarded by `AdminPanelGuard`): user lookup & impersonation, config-variable CRUD (DB-backed), system/queue health, version info, AI-model & AI-provider administration, workspace feature-flag overrides, billing inspection, and an admin chat assistant.

### Key services
`admin-panel-user-lookup`, `admin-panel-statistics` (recent users / top workspaces), `admin-panel-config` (DB config vars), `admin-panel-billing`, `admin-panel-signing-key`, `admin-panel-version`, `admin-panel-chat`, `admin-panel-health` (+ `admin-panel-queue`), `maintenance-mode`.

### Health indicators
`indicators/`: `app`, `database`, `redis`, `worker`, `connected-account` health — each an `@nestjs/terminus`-style indicator with timeouts and a `health-state-manager` util. Enums: `HealthIndicatorId`, `AdminPanelHealthServiceStatus`, `JobState`, `QueueMetricsTimeRange`, `AgentMessageRole`.

### API surface (selected `AdminPanelResolver`)
`userLookupAdminPanel`, `adminPanelRecentUsers`, `adminPanelTopWorkspaces`, `updateWorkspaceFeatureFlag`, `getConfigVariablesGrouped`, `getSystemHealthStatus`, `getIndicatorHealthStatus`, `getQueueMetrics`/`getQueueJobs`/`retryJobs`/`deleteJobs`, `versionInfo`, `getAdminAiModels` + `setAdminAiModel*`/`setAdminDefaultAiModel`, `get/create/update/deleteDatabaseConfigVariable`, `getAiProviders`/`add`/`removeAiProvider`, `getModelsDevProviders`/`Suggestions`/`addModelToProvider`, `findAllApplicationRegistrations`. Maintenance mode stored as a key-value banner.

---

## feature-flag

**Purpose.** Per-workspace boolean feature flags.
- **Entity** `FeatureFlagEntity`: `key` (`FeatureFlagKey` from `twenty-shared`), `value` (bool), `workspaceId`; unique on (key, workspace).
- **Service** reads through the workspace cache (`featureFlagsMap`), with `isFeatureEnabled`, `getWorkspaceFeatureFlags[Map]`, `enableFeatureFlags`, `upsertWorkspaceFeatureFlag` (invalidates+recomputes the cached map on write). Public-flag validator gates which flags end-users may toggle.

## lab

**Purpose.** Thin GraphQL wrapper exposing a single mutation `updateLabPublicFeatureFlag` that lets workspace admins toggle **public** ("lab") feature flags via `FeatureFlagService` (WORKSPACE permission). No own data model.

---

## telemetry

**Purpose.** Opt-in self-hosting telemetry. `TelemetryService.publish()` posts sign-up events to `twenty-telemetry.com/api/v2/selfHostingEvent` via the SSRF-safe HTTP client, only when `TELEMETRY_ENABLED`. Event payload (`TelemetryEventType`): user/workspace ids, email/name, locale, `serverUrl`, `serverId`. Failures are swallowed (returns `{success:false}`).

## metrics

**Purpose.** OpenTelemetry meter wrapper (`MetricsService`) + Redis-backed counter cache (`MetricsCacheService`, namespace `engine:metrics`).
- Creates counters/histograms/observable gauges; `incrementCounterForEvent(s)` dedupes via cached event-ids; `groupMetrics` computes counts over a date window.
- **`MetricsKeys`** enum (~50 keys) covers message/calendar sync jobs, GraphQL operation status codes, workflow-run lifecycle, AI-chat token/latency metrics, MCP/AI tool execution, job queue states, captcha, sign-up, schema/app version mismatch.

## health

**Purpose.** Minimal public liveness endpoint: `GET /healthz` returning a Terminus `HealthCheck` (empty indicator set). Deeper checks live in admin-panel.

---

## audit

**Purpose.** Analytics/event ingestion into ClickHouse. `@license`-free but gated by `CLICKHOUSE_URL`.
- **`AuditService.createContext()`** yields three writers into ClickHouse tables: `insertWorkspaceEvent` → `workspaceEvent`, `createObjectEvent` → `objectEvent`, `createPageviewEvent` → `pageview`. All no-op (success) if ClickHouse is unconfigured.
- **Event schemas** under `utils/events/`: object-record created/updated/deleted/upserted, pageview, and workspace events (billing payment-received, custom-domain activated/deactivated, logic-function-executed, monitoring, user-signup, webhook-response, workspace-entity-created, workspace-created). `makeTrackEvent`/`makePageview` build normalized rows.
- **API:** `AuditResolver` — `createObjectEvent` (workspace auth), `trackAnalytics` (public, pageview or track), plus a `createPageview` alias. A job (`create-audit-log-from-internal-event`) bridges internal app events to audit rows.

## event-logs

**Purpose.** Enterprise audit-log **query** layer over the ClickHouse event tables (read side of `audit`/`usage`/`application-logs`). `@license Enterprise`.
- **`EventLogsService.queryEventLogs`** queries one of five tables via `EventLogTable` enum → `workspaceEvent`, `pageview`, `objectEvent`, `usageEvent`, `applicationLog`. Cursor-paginated (base64 timestamp cursor, max 10000 rows), with filters (eventType LIKE, userWorkspaceId, date range, recordId/objectMetadataId for object events). Normalizes each table's columns into a common `EventLogRecord` shape.
- **Access gate:** requires ClickHouse configured **and** the `AUDIT_LOGS` billing entitlement (Enterprise) — throws otherwise.
- **API:** `EventLogsResolver.eventLogs` (Query) guarded by Enterprise-features + `SECURITY` permission.
- **Cleanup:** `event-logs/cleanup/` runs a cron command/job/service to prune old event rows.

## event-emitter

**Purpose.** Utilities (no entity/resolver) for computing record-change diffs feeding the event/audit pipeline: `object-record-changed-properties`, `object-record-changed-values`, `object-record-diff-merge`.

## actor

**Purpose.** Stamps `createdBy`/`updatedBy` "actor" metadata on records via TypeORM pre-query hooks (`created-by.create-one/many`, `updated-by.update-one/many`). `ActorFromAuthContextService` derives the actor from the auth context; builder utils produce an actor from API key, application, or full-name metadata.

---

## application

**Purpose.** The largest sub-tree: installs, develops, registers, packages, marketplaces, OAuths, upgrades, and configures **third-party applications/plugins** within a workspace (Twenty's app platform). Heavily metadata-driven (a large set of `from-*-manifest-to-universal-flat-*` converters translate an app manifest into flat metadata entity maps).

### Core entities
- **`ApplicationEntity`**: `workspaceId`, `universalIdentifier` (unique per workspace), `name`, `description`, `logo`, `version`, `sourceType` (`ApplicationRegistrationSourceType` LOCAL/…), `sourcePath`, `packageJsonChecksum`+`packageJsonFileId`→`FileEntity`, `yarnLockChecksum`+`yarnLockFileId`→`FileEntity`; relations to logic-functions, agents, command-menu-items, front-components, object-metadata, roles, variables.
- **`ApplicationRegistrationEntity`** (+variables) — registry/OAuth-client record with stats/summary DTOs, client-secret rotation, ownership transfer.
- **`ApplicationVariableEntity`** / **`ApplicationRegistrationVariableEntity`** — app-scoped config vars (secret masking constant) with a workspace map cache.
- **`ConnectionProviderEntity`** — OAuth connection providers (PKCE flow, token exchange/refresh/revoke, connection listing controllers).

### Sub-modules
`application-development`, `application-install`, `application-manifest` (+migration/sync + ~25 converters), `application-marketplace` (curated catalog + cron sync + query/service + registry CDN url builder), `application-oauth` (discovery/registration/token controllers, scopes, stale-registration cleanup cron), `application-package` (tarball fetch/extract-securely, npm-name validation, version validation, yarn engine copy), `application-registration`, `application-upgrade` (version-check cron), `application-variable`, `connection-provider`, `pre-installed-apps`. Flat-application cache service + many flat-map utils.

## application-logs

**Purpose.** Pluggable logging sink for application/logic-function execution. Driver-based (`ApplicationLogDriver`: DISABLED, CONSOLE, CLICKHOUSE) selected via a dynamic module factory.
- **Log entry shape** (`ApplicationLogEntry`): `timestamp`, `workspaceId`, `applicationId`, `logicFunctionId`, `logicFunctionName`, `executionId`, `level`, `message` → written to ClickHouse `applicationLog` (readable via event-logs).
- Includes a log-line parser (`parse-application-log-lines`) and console/disabled drivers.

---

## file

**Purpose.** File metadata + signed-URL/serving layer on top of `file-storage`.
- **Entity `FileEntity`** (table `file`): `workspaceId`, `applicationId`→`ApplicationEntity`, `path`, `size` (bigint), `mimeType` (default `application/octet-stream`), `isStaticAsset`, `settings` (jsonb `FileSettings`), soft-delete. Unique on (workspace, application, path).
- **Sub-modules** for context-specific files: `file-ai-chat`, `file-email-attachment`, `file-workflow`, `files-field`, `file-url` (signed-URL service). Utilities for MIME policy, sanitize/validate file & folder names, content-disposition, response headers, building file info from a request. A job handles workspace-folder deletion.

## file-storage

**Purpose.** Storage-driver abstraction. `StorageDriverType`: `S_3`, `LOCAL`. `FileStorageDriverFactory` picks the driver; a `validated-storage.driver` wraps another driver to enforce path-safety. Extensive path-traversal hardening utils (`assert-storage-path-is-safe`, `is-safe-relative-path`, `validate-storage-path-is-within-workspace-or-throw`, extension allow-lists per app file folder) plus a class-validator for safe relative paths.

## geo-map

**Purpose.** Google Maps address autocomplete + place-details proxy. `GeoMapService` calls Google Maps via the SSRF-safe client only when `IS_MAPS_AND_ADDRESS_AUTOCOMPLETE_ENABLED` and `GOOGLE_MAP_API_KEY` are set; results are sanitized into Twenty's address/location field shapes. Exposed via `GeoMapResolver`.

## key-value-pair

**Purpose.** Generic typed KV store keyed by (key, optional userId, optional workspaceId).
- **Entity `KeyValuePairEntity`**: `key`, `value` (jsonb; legacy `textValueDeprecated`), `type` (`KeyValuePairType`: USER_VARIABLE / FEATURE_FLAG / CONFIG_VARIABLE), nullable `userId`/`workspaceId`. Four partial-unique indexes cover every null-combination of user/workspace so a key is unique at each scope.
- **Generic service** `KeyValuePairService<Map>` — typed `get`/`set` (upsert with the correct conflict index/predicate per scope), supporting an optional `QueryRunner` for transactions. Backs user variables, feature-flag storage, and DB config variables.

## client-config

**Purpose.** Aggregated, mostly-public runtime config delivered to the frontend (no own DB entity). `ClientConfig` ObjectType bundles: `appVersion`, auth providers, `Billing` (isBillingEnabled, billingUrl, trialPeriods), `aiModels`, `signInPrefilled`, multi-workspace flag, `Support`, `Sentry` (dsn/env/release), `Captcha`, `ApiConfig`, public feature-flag metadata, maintenance-mode window. Served by a controller + resolver + `ClientConfigService`.

## environment

**Purpose.** Tiny module (`environment.module.ts` only) — wires environment-level providers; the real config logic lives in `twenty-config`.

## twenty-config

**Purpose.** The configuration backbone. `TwentyConfigService` resolves config values from two drivers — **environment** (`.env`) and **database** (the `keyValuePair` CONFIG_VARIABLE store) — preferring DB when `IS_CONFIG_VARIABLES_IN_DB_ENABLED`, with a `config-cache.service`. Exposes `get`/`set`/`update`/`delete`/`getAll`, plus helpers (`isBillingEnabled`, `getLoggingConfig`, etc.). `config-variables.ts` is the master typed schema of every config var, annotated by a rich set of decorators (`@IsDuration`, `@IsAwsRegion`, `@IsTwentySemver`, `@CastToMeterDriver`, group/metadata decorators) consumed by the admin-panel config UI.

## i18n

**Purpose.** Server-side localization. `I18nService` loads locale catalogs; utils generate message ids (`generateMessageId`) and translate user-friendly message descriptors. `i18n-context.type` carries locale through requests.

## throttler

**Purpose.** Token-bucket rate limiter backed by cache storage (namespace `engine:workspace`). `ThrottlerService.tokenBucketThrottleOrThrow` / `consumeTokens` refill tokens over a time window and throw `ThrottlerException` (LIMIT_REACHED) when exhausted; exception handlers map it to GraphQL/REST responses.

## upgrade

**Purpose.** Version/migration tracking for the self-hosted instance and per-workspace upgrades. `UpgradeMigrationEntity` records migration state; decorators (`@WasIntroducedInUpgrade`, `@WasRemovedInUpgrade`, `@WasRenamedInUpgrade`, registered instance/workspace command decorators) tag entity fields/commands with the version they changed in, and utils resolve an entity's "shape at a given upgrade cursor". Version constants (current/next/previous/all/cross-upgrade) + DTOs for instance/workspace upgrade status; `upgrade-gauge.service` exposes upgrade metrics.

## enterprise

**Purpose.** Enterprise-license key management for **billing-disabled** self-host deployments (gated by `BillingDisabledGuard` + `AdminPanelGuard`). `EnterprisePlanService` validates a signed enterprise key (public-key constant), refreshes a validity token on a cron, reports active seat counts, and proxies portal/checkout/subscription-status to an external enterprise plan service. Resolver: `setEnterpriseKey`, `refreshEnterpriseValidityToken`, `enterprisePortalSession`, `enterpriseCheckoutSession`, `enterpriseSubscriptionStatus`. License info DTO: `isValid`, `licensee`, `expiresAt`, `subscriptionId`. This is the **non-Stripe** licensing path, parallel to the Stripe billing module.

## secure-http-client

**Purpose.** SSRF-hardened outbound HTTP client. `SecureHttpClientService.getHttpClient()` returns an axios client using an agent that blocks private IPs; `resolve-and-validate-hostname` + `is-private-ip` enforce the policy when "safe mode" is enabled. Used by telemetry, geo-map, and any module making external calls. Tracks outbound request source/context.

## sql-sanitization

**Purpose.** Single hardening util `validateAllowedValue(value, allowedValues, label)` — throws unless a string belongs to a known-safe set, for values interpolated into SQL (e.g. ClickHouse group-by fields, enum keywords). No module/entity.

## sentry

**Purpose.** Sentry context helpers (no service class): `apply-workspace-sentry-context[-from-job-data]` and `apply-workspace-sentry-fields` attach workspace/user scope to Sentry events. Actual capture is done by the exception-handler Sentry driver.

## exception-handler

**Purpose.** Pluggable error-reporting abstraction. `ExceptionHandlerService` + `HttpExceptionHandlerService` route exceptions to drivers — `console.driver` or `sentry.driver` — chosen via a dynamic module factory. Carries user/workspace context interfaces and a Sentry tracing hook; ships mock drivers for tests.

## redis-client

**Purpose.** Centralized IORedis provider. `RedisClientService` lazily creates and caches three clients: a general client (`REDIS_URL`), a queue client (`REDIS_QUEUE_URL` ?? `REDIS_URL`, `maxRetriesPerRequest: null`), and a `graphql-redis-subscriptions` pub/sub client; disposes them on module destroy.

## cache-storage

**Purpose.** Namespaced cache abstraction over memory or Redis (`CacheStorageType` memory/redis). `CacheStorageService` get/set/etc.; `@InjectCacheStorage(namespace)` decorator selects a namespace from `CacheStorageNamespace` (messaging/calendar/workflow modules + engine namespaces: workspace, core-entity, lock, health, metrics, subscriptions, billing-usage). A `flush-cache` command clears it.

## cache-lock

**Purpose.** Distributed lock helper on top of cache-storage (namespace `engine:lock`). `CacheLockService.withLock<T>(...)` runs a callback under a named lock (with `delay`), exposed also as a `@WithLock` decorator — used to serialize cron/job/billing-sync work.

## logger

**Purpose.** Configurable logging module. `LoggerService` (dynamic module factory + definition) provides the app-wide logger honoring `twenty-config` log levels; distinct from `application-logs` (which logs app/logic-function execution to ClickHouse).

---

## Parity notes

> Tag = how hard to bring up in the SabNode build. RUNTIME-HEAVY = depends on external runtime services (Stripe, ClickHouse, Redis, OTel, Sentry, Google) that must be provisioned or stubbed.

| Module | Tag | Build note |
|---|---|---|
| **billing** | **RUNTIME-HEAVY** | **Drop/stub Stripe entirely. See SabNode-plan mapping below.** |
| **billing-webhook** | RUNTIME-HEAVY | Stripe-only; remove the webhook controller when Stripe is dropped. |
| **usage** | RUNTIME-HEAVY | Needs ClickHouse `usageEvent`. Keep the credit/operation enums; back analytics with Mongo/Postgres aggregation or no-op if metering deferred. |
| **admin-panel** | RUNTIME-HEAVY | Large surface; SabNode already has its own admin system. Port selectively (health/queue/config) or front with the existing admin. |
| **feature-flag** | SIMPLE | Plain Postgres entity + cache; portable as-is (or back with key-value-pair). |
| **lab** | SIMPLE | Thin wrapper over feature-flag. |
| **telemetry** | SIMPLE | Disable by default (`TELEMETRY_ENABLED=false`); strip the external endpoint. |
| **metrics** | RUNTIME-HEAVY | Requires an OpenTelemetry meter + Redis cache. Can no-op meters in early builds. |
| **health** | SIMPLE | `/healthz` is trivial to keep. |
| **audit** | RUNTIME-HEAVY | ClickHouse-gated; no-ops cleanly when `CLICKHOUSE_URL` unset — safe to ship dormant. |
| **event-logs** | RUNTIME-HEAVY | Needs ClickHouse **and** an `AUDIT_LOGS` entitlement — re-point the gate to a SabNode plan flag. |
| **event-emitter / actor** | SIMPLE | Pure utils + ORM hooks; portable. |
| **application** | RUNTIME-HEAVY | Massive app-platform sub-tree (OAuth, marketplace, package/tarball, manifest migration). Port only if the plugin platform is in scope; otherwise defer. |
| **application-logs** | MEDIUM | Driver-based; default to CONSOLE/DISABLED, enable CLICKHOUSE later. |
| **file / file-storage** | MEDIUM | Per CLAUDE.md, route all file IO through **SabFiles (R2)**; map `file-storage` S3 driver to R2 and keep the path-safety utils. |
| **geo-map** | MEDIUM | Optional Google Maps; gate off unless key provided. |
| **key-value-pair** | SIMPLE | Generic typed KV store; very portable and useful as a config/flag backbone. |
| **client-config** | SIMPLE | Aggregation DTO; trim Stripe/Sentry/captcha fields to match SabNode. |
| **environment / twenty-config** | MEDIUM | Keep the env+DB dual-driver config service; reconcile `config-variables.ts` schema with SabNode env conventions. |
| **i18n** | SIMPLE | Self-contained. |
| **throttler** | SIMPLE | Token bucket over cache-storage; portable. |
| **upgrade** | MEDIUM | Version/migration decorators are entangled with Twenty's migration system; needed only if running Twenty's upgrade commands. |
| **enterprise** | RUNTIME-HEAVY | External license server + signed-key crypto; replace with SabNode plan gating. |
| **secure-http-client** | SIMPLE | SSRF guard worth keeping for all outbound calls. |
| **sql-sanitization** | SIMPLE | One util; keep. |
| **sentry / exception-handler** | MEDIUM | Keep the driver abstraction; default to console driver, Sentry optional. |
| **redis-client / cache-storage / cache-lock** | MEDIUM | Require Redis (SabNode already runs Redis). Portable; align URLs/namespaces. |
| **logger** | SIMPLE | Portable logging module. |

### Billing — SabNode-plan-based mapping (no Stripe)

Our build is **plan-based via SabNode's own plan system; Stripe is not used.** Map Twenty's Stripe-centric model onto SabNode primitives:

- **`BillingPlanKey` (PRO / ENTERPRISE)** → SabNode subscription **plan/tier**. `listPlans` and plan/interval switches resolve from SabNode's plan catalog instead of mirrored `billingProduct`/`billingPrice` rows.
- **`BillingProductEntity` / `BillingPriceEntity` / `BillingMeterEntity`** → **not mirrored**. SabNode owns the catalog; drop the Stripe sync services, the `stripe/` tree, and all `transform-stripe-*` converters.
- **`BillingSubscriptionEntity` + items** → SabNode's existing per-tenant subscription record. Keep `status`/`interval`/`currentPeriodEnd`/`cancelAtPeriodEnd` semantics if useful, but source them from SabNode, not Stripe webhooks.
- **`BillingEntitlementEntity` (SSO, CUSTOM_DOMAIN, RLS, AUDIT_LOGS)** → SabNode **plan-feature gates**. Re-implement `BillingService.hasEntitlement()` to read SabNode plan flags. (Note: it already returns `true` when billing is disabled — the natural default while wiring SabNode plans.)
- **Credits (`creditBalanceMicro`, `ResourceCreditService`, `BillingUsageService`)** → SabNode's **credit-metering** system. Keep the micro-credit ledger concept and the `usageEvent`/cap logic, but grant/decrement against SabNode credits rather than Stripe credit-grants/meters.
- **Checkout / portal / `billing-webhook`** → **remove**. Subscribe/upgrade/downgrade go through SabNode's billing UI; there is no Stripe webhook controller, no checkout/portal session, and no signature verification in our build.
- **`enterprise` module** → already the non-Stripe path; likewise fold into SabNode plan gating rather than the external license server.

**Net:** retain the *shape* of plans → entitlements → credits/usage as a clean gating model, but the data source is SabNode's plan system, and the entire `stripe/` + `billing-webhook` runtime is dropped.
