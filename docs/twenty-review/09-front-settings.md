# Twenty CRM Front-End Settings — Structured Catalog

Read-only review of `twenty-front/src/modules/settings`, plus the supporting `object-metadata` /
`metadata` modules and the shared route enum `twenty-shared/src/types/SettingsPath.ts`. This is an
original catalog (paraphrased descriptions + tables); no source is copied verbatim.

The settings surface is organized as ~24 feature folders under `modules/settings/`, each pairing a
page (under `pages/settings/`) with feature components, GraphQL fragments/mutations/queries, hooks,
recoil states, and Zod validation schemas. Routing keys live in the `SettingsPath` enum; navigation
metadata lives in `modules/settings/components` and the settings-nav config.

---

## Route map (SettingsPath)

The canonical route inventory (the enum drives every settings page and breadcrumb). Grouped by area:

| Area | Representative routes |
| --- | --- |
| Profile / 2FA | `profile`, `profile/two-factor-authentication/:strategy` |
| Experience | `experience` |
| Accounts | `accounts`, `accounts/new`, `accounts/configuration/:id`, `accounts/calendars`, `accounts/emails`, `accounts/new-imap-smtp-caldav-connection`, `accounts/edit-imap-smtp-caldav-connection/:id` |
| Billing / Usage | `billing`, `billing/usage`, `billing/usage/user/:userWorkspaceId` |
| Enterprise | `enterprise` |
| Data model | `objects`, `objects/overview`, `objects/:plural`, `objects/:plural/new-field/select`, `.../new-field/configure`, `.../new-index`, `objects/:plural/:fieldName`, `objects/new` |
| Members / Roles | `members`, `members/:id`, `members/approved-access-domain/new`, `members/roles`, `members/roles/create`, `members/roles/:roleId`, `members/roles/:roleId/object/:objectMetadataId`, `members/roles/:roleId/add-object-permission` |
| Workspace (General) | `general`, `general/subdomain`, `general/custom-domain` |
| Email/Domains | `email`, `email/new-email-group`, `email/email-group/:channelId`, `email/emailing-domain/new`, `email/emailing-domain/:domainId`, `applications/public-domain` |
| AI | `ai`, `ai/prompts`, `ai/new-agent`, `ai/agents/:id`, `ai/agents/:id/turns/:turnId`, `ai/new-skill`, `ai/skills/:id`, `ai/tools/:id`, `ai/usage/user/:id` |
| Applications | `applications`, `applications/:id` (+ connections / logicFunctions / frontComponents / commandMenuItems / views / pageLayouts), `applications/available/:id`, `applications/registrations/:id` (+ config-variables) |
| Logic Functions | `functions`, `functions/new`, `functions/:id` |
| Developers (API/Webhooks) | `api-webhooks`, `api-webhooks/apis/new`, `api-webhooks/apis/:id`, `api-webhooks/webhooks/new`, `api-webhooks/webhooks/:id` |
| Playground | `playground/rest/:schema`, `playground/graphql/:schema` |
| Integrations | `integrations` |
| Security / SSO | `security`, `security/sso/new`, `security/event-logs` |
| Admin Panel | `admin-panel` (+ `#enterprise`, `#health-status`), `admin-panel/health-status/...`, `admin-panel/config-variables/:name`, `admin-panel/ai/...`, `admin-panel/users/:id`, `admin-panel/workspaces/:id`, `admin-panel/applications/registrations/:id` |
| Updates / Lab | `updates`, (Lab feature flags surfaced inside Experience/General) |

---

## Profile

- **Feature:** Personal user account settings (identity, password, deletion).
- **Key UI:** `pages/settings/profile/SettingsProfile.tsx` aggregates cards — `NameFields`
  (first/last name inline-edit), `EmailField` (read-only email display), `SetOrChangePassword`
  (password setup/change flow), profile-picture uploader, `DeleteAccount` (self-delete with
  confirmation modal), and `DeleteWorkspace` (owner-only workspace deletion).
- **Backend:** `workspaceMember` / `currentUser` GraphQL; `updateOneWorkspaceMember`,
  password mutations, account/workspace deletion mutations.

## Two-Factor Authentication (profile sub-area)

- **Feature:** Enroll/verify/delete a TOTP 2FA method on the personal account.
- **Key UI:** `SettingsTwoFactorAuthenticationMethod.tsx` page; components
  `TwoFactorAuthenticationSetupForSettingsEffect` (initiates enrollment/QR),
  `TwoFactorAuthenticationVerificationForSettings` with a segmented code input
  (`...VerificationCodeDash` / `...VerificationCodeSlot`), and `DeleteTwoFactorAuthenticationMethod`.
- **Backend:** 2FA initiate/verify/delete mutations; ties into auth/OTP service.

## Experience (Appearance / Format Preferences)

- **Feature:** Per-user display preferences — color scheme, date/time/number formatting, timezone.
- **Key UI:** `experience/components/FormatPreferencesSettings.tsx` plus selects:
  `DateTimeSettingsDateFormatSelect`, `DateTimeSettingsTimeFormatSelect`,
  `DateTimeSettingsTimeZoneSelect`, `NumberFormatSelect`. Constants in `experience/constants`.
  (Color-scheme / light-dark toggle is part of the same appearance surface.)
- **Backend:** `updateOneWorkspaceMember` (preferences persisted on the member record); no server
  round-trip for live preview.

## Accounts (Connected mailboxes / calendars)

- **Feature:** Connect & configure email + calendar accounts (Google OAuth and IMAP/SMTP/CalDAV),
  plus message/calendar sync visibility, blocklists, and folder selection.
- **Key UI (rich):**
  - List + empty state: `SettingsAccountsConnectedAccountsListCard`,
    `SettingsAccountsListEmptyStateCard`, `SettingsAccountsRowDropdownMenu` (reconnect/remove).
  - Manual connection: `SettingsAccountsNewImapSmtpCaldavConnection` /
    `...EditImapSmtpCaldavConnection`, `SettingsAccountsConnectionForm`,
    `SettingsAccountsPasswordController`.
  - Message sync: `SettingsAccountsMessageChannelsContainer`, `...MessageChannelDetails`,
    `...MessageAutoCreationCard`, `...MessageVisibilityCard`, message-folder selection
    (`message-folders/`), `...MessageFolderCard`.
  - Calendar sync: `SettingsAccountsCalendarChannelsContainer`, `...CalendarChannelDetails`,
    `...CalendarVisibilitySettingsCard`, `...CalendarDisplaySettings`.
  - Blocklist: `...BlocklistSection` / `...BlocklistTable` / `...BlocklistInput`.
- **Backend:** `connectedAccount`, `messageChannel`, `calendarChannel` GraphQL; IMAP/SMTP/CalDAV
  connection mutations; sync-status subscriptions; blocklist CRUD.

## Workspace (General)

- **Feature:** Workspace-wide identity & email settings: name, logo, subdomain/custom domain,
  email-group forwarding, impersonation toggle, emailing-domains section.
- **Key UI:** `SettingsWorkspace.tsx` page; `workspace/components` — `NameField`,
  `WorkspaceLogoUploader`, `ToggleImpersonate`, `SettingsWorkspaceEmailGroupSection`
  (+ forwarding/source cells), `SettingsWorkspaceEmailingDomainsSection`. Domain cards in
  `domains/components` (`SettingsSubdomain`, `SettingsCustomDomain`, `SettingsDomainRecords`,
  `SettingsWorkspaceDomainCard`, `CheckCustomDomainValidRecordsEffect`).
- **Backend:** `updateWorkspace`, domain create/verify mutations, file-upload mutation for logo.

## Members & Invitations

- **Feature:** List workspace members, invite by email, manage per-member role/permissions.
- **Key UI:** `members/components` — `MemberEmailField`, `MemberNameFields`, `MemberInfosTab`,
  `MemberPermissionsTab`. The members page lists active members + pending invitations and exposes
  an invite-by-email input; approved-access-domain creation lives under
  `members/approved-access-domain/new`.
- **Backend:** `workspaceMembers`, `workspaceInvitations`; send-invitation / resend / revoke
  mutations; role-assignment mutations.

## Roles

- **Feature:** RBAC role management — create roles and assign object-level, field-level, and
  record-level permissions plus action/setting permission flags.
- **Key UI:**
  - **Role list / detail / create:** `roles/role/components`, route `members/roles`,
    `members/roles/create`, `members/roles/:roleId`.
  - **Object-permissions matrix:** `objects-permissions/components` —
    `SettingsRolePermissionsObjectsSection`, `...ObjectsTableHeader`, `...ObjectsTableRow`,
    `PermissionIcon` (read / write / soft-delete / destroy columns per object).
  - **Permission flags (settings & tools):** `permission-flags/components` —
    `...SettingsSection`, `...SettingsTableRow`, `...ToolSection`; configs in
    `useSettingsRolePermissionFlagConfig` / `useActionRolePermissionFlagConfig`
    (toggle flags like workspace settings, data-model edit, impersonate, etc.).
  - **Object-level overrides:** `object-level-permissions/` — object picker
    (`...ObjectLevelObjectPicker`), per-object override form (`...ObjectLevelObjectForm`,
    `OverridableCheckbox`, override-cell components), and a per-object permission table.
  - **Field-level permissions:** `field-permissions/components` —
    `...ObjectFieldPermissionTable` (+ all-header-row + per-field row) controlling field
    read/edit visibility.
  - **Record-level permissions:** `record-level-permissions/` — a full filter builder
    (`...FilterBuilder`, `...FilterRow`, `...LogicalOperatorCell`, `...FieldSelect` /
    sub-field menus, `...VariablePicker`, `...MeValueSelect`, `...ValueInput`) that scopes which
    records a role may access via composable AND/OR conditions and `{{me}}`-style variables.
  - **Role assignment:** `role-assignment/components` assigns roles to members/agents.
- **Backend:** `roles`, `objectPermissions`, `fieldPermissions`, `settingPermissions` GraphQL;
  upsert/delete role + permission mutations; record-level filter persisted as a serialized
  condition tree.

## Data Model

The largest area. Sub-folders: `objects`, `object-details`, `new-object`, `fields`, `indexes`,
`graph-overview`, `constants`, `validation-schemas`.

### Objects & object list

- **Feature:** Manage standard + custom objects.
- **Key UI:** object summary cards (`SettingsDataModelObjectSummary`), cover-image picker
  (`SettingsObjectCoverImage`), inactive-object dropdown (`SettingsObjectInactiveMenuDropDown`),
  available-standard-object activation rows (`new-object/SettingsAvailableStandardObjectsSection`,
  `...ItemTableRow`).

### New object & object-about form

- **Feature:** Create a custom object / edit object metadata (labels, icon, description, sync flag).
- **Key UI:** `objects/forms/components`; `object-details/components/SettingsUpdateDataModelObjectAboutForm`.
- **Backend:** `createOneObjectMetadataItem` / `updateOneObjectMetadataItem`.

### Object detail (fields & relations tables)

- **Feature:** Per-object view of its fields, relations, indexes, and settings tabs.
- **Key UI:** `object-details/components` — `SettingsObjectItemTableRow`,
  `SettingsObjectFieldItemTableRow`, `SettingsObjectFieldDataType` (type badge),
  `SettingsObjectFieldDisabledActionDropdown`, `SettingsObjectRelationsTable` /
  `...RelationItemTableRow`; per-object tabs under `object-details/components/tabs`.

### Indexes

- **Feature:** Create DB indexes on a custom object's fields, with uniqueness option.
- **Key UI:** `indexes/forms/components` — `SettingsObjectIndexFieldsForm` (field multi-select),
  `SettingsObjectIndexOptionsForm` (unique toggle, name). Indexable values encoded/decoded by
  `indexes/utils` helpers.
- **Backend:** `createOneIndexMetadata` / delete index mutations.

### Graph overview

- **Feature:** Visual entity-relationship diagram of all objects + relations.
- **Key UI:** `graph-overview/components` — `SettingsDataModelOverview` (canvas),
  `...OverviewObject` (node), `...OverviewField` / `...OverviewFieldWithoutRelation`,
  `...OverviewRelationMarkers` (edge markers), `...OverviewEffect` (layout). Route `objects/overview`.

### Field-type creation/editing UI (per type)

The field editor is driven by `SETTINGS_FIELD_TYPE_CONFIGS` (merge of
`SettingsNonCompositeFieldTypeConfigs` + `SettingsCompositeFieldTypeConfigs`). Each entry has
`label`, `Icon`, `exampleValues`, and a `category` (`Basic` / `Relation` / `Advanced`). The
new-field flow (`new-field/select` → `new-field/configure`) shows a categorized type picker
(`SettingsObjectNewFieldSelector`), then a type-specific settings card. Shared sub-forms apply to
every type: `SettingsDataModelFieldIconLabelForm` (icon + name + API name),
`SettingsDataModelFieldDescriptionForm`, `SettingsDataModelFieldIsUniqueForm`,
`SettingsDataModelFieldMaxValuesForm`, `SettingsDataModelFieldOnClickActionForm`. A live preview
renders via `fields/preview/SettingsDataModelFieldPreview(Widget)`.

| Field type | Category | Dedicated editor | Type-specific settings |
| --- | --- | --- | --- |
| **TEXT** | Basic | `text/SettingsDataModelFieldTextForm` + settings card | Displayed-rows clamp: Deactivated / First 2 / First 5 / First 10 / All lines |
| **NUMBER** | Basic | `number/SettingsDataModelFieldNumberForm` + settings card | Variant (Number / Short), decimals, percentage/short-number formatting |
| **BOOLEAN (True/False)** | Basic | `boolean/SettingsDataModelFieldBooleanForm` + settings card | Default value True / False |
| **DATE** | Basic | `date/SettingsDataModelFieldDateForm` + settings card | Display format: Relative / User-settings / Custom (discriminated-union schema) |
| **DATE_TIME** | Basic | (shares DATE form) | Same display-format options incl. time |
| **SELECT** | Basic | `select/SettingsDataModelFieldSelectForm` + settings card | Option rows (`...SelectFormOptionRow`): editable label + auto-derived API value, per-option **color picker** over `MAIN_COLOR_NAMES` (`ColorSample` + `MenuItemSelectColor`), default-option marker (`IconCheck`), add (`AddSelectOptionMenuItem`) / remove / drag-reorder |
| **MULTI_SELECT** | Basic | (shares SELECT form) | Same option editor; allows multiple defaults |
| **RATING** | Basic | (uses shared forms) | Fixed example scale RATING_1..RATING_5 |
| **CURRENCY** (composite) | Basic | `currency/SettingsDataModelFieldCurrencyForm` + settings card | Default currency code select (`SETTINGS_FIELD_CURRENCY_CODES`); micros/amount + currencyCode sub-fields |
| **PHONES** (composite) | Basic | `phones/SettingsDataModelFieldPhonesForm` + settings card | Default country/calling-code; primary + additional phones |
| **EMAILS** (composite) | Basic | (uses shared forms) | Primary + additional emails sub-fields |
| **LINKS** (composite) | Basic | (uses shared forms) | Primary link + secondary links (url+label) |
| **ADDRESS** (composite) | Basic | `address/SettingsDataModelFieldAddressForm` (+ `MultiSelectAddressFields`) + settings card | Choose which sub-fields to display (street/city/state/postcode/country) via `MultiSelectAddressFields`; default-country |
| **FULL_NAME** (composite) | — | (composite config) | First/last sub-fields |
| **ACTOR** (composite) | — | (composite config) | Source + workspace-member sub-fields (system-ish) |
| **RELATION** | Relation | `morph-relation/SettingsDataModelFieldRelationForm` (+ `...FormCard`) | Relation type (`RELATION_TYPES`: Has many = ONE_TO_MANY, Belongs to one = MANY_TO_ONE), target object select, inverse-side field name + icon, live relation preview (`...RelationPreviewContent` / `...PreviewImageCard`) |
| **MORPH_RELATION** | Relation | same folder (+ `...RelationJunctionForm`) | Polymorphic relation to multiple target objects via a junction form |
| **ARRAY** | Advanced | (shared forms) | Free list of string values |
| **RAW_JSON (JSON)** | Advanced | (shared forms) | Arbitrary JSON value |
| **UUID (Unique ID)** | Advanced | (shared forms) | Auto-generated identifier |
| **FILES** | Basic | (shared forms) | File attachments (label + value list) |

- **Backend (data-model):** `createOneFieldMetadataItem` / `updateOneFieldMetadataItem` /
  delete-field; relation creation also updates the inverse object. Validation via
  `data-model/validation-schemas` + per-type Zod schemas in `record-field/ui/validation-schemas`.

## Developers — API Keys & Webhooks

- **Feature:** Issue API keys (with role + scopes) and register outbound webhooks subscribed to
  CRUD events on objects.
- **Key UI:** `developers/components` —
  - **API keys:** `SettingsApiKeysTable`, `SettingsApiKeysFieldItemTableRow`, `ApiKeyNameInput`,
    `ApiKeyInput` (reveal/copy generated token once), `SettingsDevelopersRoleSelector`
    (assign a role / scopes to the key). Routes `api-webhooks/apis/new`, `.../apis/:id`.
  - **Webhooks:** `SettingsWebhooksTable`, `SettingsDevelopersWebhookTableRow`,
    `SettingsDevelopersWebhookForm` (target URL, description, secret),
    `WebhookEntitySelect` (object + operation matrix: create/update/delete per object).
    Routes `api-webhooks/webhooks/new`, `.../webhooks/:id`.
- **Backend:** `apiKeys`, `webhooks` GraphQL; create/revoke key + create/update/delete webhook
  mutations.

## Developers — Playground (REST + GraphQL)

- **Feature:** In-app API explorers for the workspace's generated REST & GraphQL schemas.
- **Key UI:** `playground/components` — `GraphQLPlayground` (embedded GraphiQL-style),
  `RestPlayground` (+ `RestPlaygroundSchemaFetchEffect`), `PlaygroundSetupForm` (pick API key /
  schema), `SettingsPlaygroundCoverImage`. Routes `playground/graphql/:schema`,
  `playground/rest/:schema`.
- **Backend:** generated OpenAPI/REST + GraphQL metadata schema endpoints; uses an API key for auth.

## Application Registrations

- **Feature:** Manage OAuth/app registrations (third-party app credentials + their config variables).
- **Key UI:** `application-registrations/components/ApplicationRegistrationConfigVariableEditForm`;
  routes `applications/registrations/:id` and `.../config-variables/:variableKey`.
- **Backend:** application-registration GraphQL mutations/queries (fragments under
  `application-registrations/graphql`).

## Applications (Marketplace / installed apps)

- **Feature:** Browse, install, and inspect applications and their components (logic functions,
  front components, command-menu items, views, page layouts, connections).
- **Key UI:** `applications/components` — `SettingsApplicationAboutSidebar`,
  `SettingsApplicationScreenshotGallery`; detail routes for each sub-resource type (see route map).
- **Backend:** `applications` GraphQL (install/uninstall mutations, available-application queries).

## Domains (Subdomain / Custom Domain / Public Domain)

- **Feature:** Configure the workspace subdomain, a verified custom domain, and public domains.
- **Key UI:** `domains/components` — `SettingsSubdomain`, `SettingsCustomDomain`,
  `SettingsDomainRecords` (DNS records to add), `SettingPublicDomain(sListCard)` +
  `...RowDropdownMenu`, validity-check effects (`CheckCustomDomainValidRecordsEffect`,
  `CheckPublicDomainValidRecordsEffect`).
- **Backend:** create/verify custom-domain, public-domain CRUD mutations; DNS validation queries.

## Emailing Domains

- **Feature:** Verify sending domains for transactional/marketing email (SPF/DKIM/DMARC records).
- **Key UI:** `emailing-domains/components` — `SettingsEmailingDomainNameCell`,
  `...StatusCell`, `...VerificationRecords` (DNS records + status). Routes
  `email/emailing-domain/new`, `email/emailing-domain/:domainId`.
- **Backend:** emailing-domain create + verify mutations.

## Enterprise

- **Feature:** Upsell / gating surface for enterprise-only features.
- **Key UI:** `enterprise/components/EnterprisePlanModal`; route `enterprise`. Also surfaced in
  admin panel via `admin-panel#enterprise`.
- **Backend:** billing/plan queries to determine enterprise entitlement.

## Security (incl. SSO OIDC/SAML)

- **Feature:** Workspace auth-security policy: SSO identity providers, auth providers/bypass,
  approved-access domains, editable-profile-fields policy, workspace 2FA enforcement, event logs.
- **Key UI:** `security/components` —
  - **SSO:** `SettingsSSOIdentitiesProvidersListCard(Wrapper)`, `...RowDropdownMenu`,
    `SettingsSSOIdentitiesProvidersForm`, and provider-specific forms:
    - **OIDC** (`SettingsSSOOIDCForm`): Authorized URI, Redirection URI, Client ID, Client Secret,
      Issuer URI.
    - **SAML** (`SettingsSSOSAMLForm`): ACS URL, Entity ID, SSO URL, X.509 certificate, issuer —
      with metadata-XML auto-parse to prefill fields.
  - **Auth providers:** `SettingsSecurityAuthProvidersOptionsList`,
    `SettingsSecurityAuthBypassOptionsList`.
  - **Approved access domains:** `approvedAccessDomains/SettingsApprovedAccessDomainsListCard`
    (+ row dropdown + validation effect).
  - **Editable profile fields policy:** `SettingsSecurityEditableProfileFields`.
  - **Workspace 2FA enforcement:** `Toggle2FA`.
  - **Event logs:** route `security/event-logs` (audit trail).
- **Backend:** SSO identity-provider CRUD mutations (`security/graphql`), auth-settings update
  mutations, approved-domain CRUD.

## Billing

- **Feature:** Subscription plan, price/benefits display, credit balance, trial state.
- **Key UI:** `billing/components` — `SettingsBillingContent`, `SettingsBillingSubscriptionInfo`
  (+ `SubscriptionInfoContainer`/`SubscriptionInfoRowContainer`/`SubscriptionPrice`/
  `SubscriptionBenefit`), `SettingsBillingCreditsSection`,
  `internal/ResourceCreditPriceSelector`, `internal/PlansTags`, `TrialCard`. Page
  `SettingsBilling.tsx`.
- **Backend:** billing GraphQL (subscription, prices, credits); checkout/portal session mutations.

## Usage

- **Feature:** Consumption analytics — daily usage, breakdown by category, per-user breakdown.
- **Key UI:** `usage/components` — `SettingsUsageAnalyticsSection`, `UsageDailyChartSection`,
  `UsageBreakdownPieSection` (+ `UsagePieChart`), `UsageByUserTableSection`,
  `UsageSectionSkeleton`. Pages `SettingsUsage.tsx`, `SettingsUsageUserDetail.tsx`
  (routes `billing/usage`, `billing/usage/user/:userWorkspaceId`).
- **Backend:** usage/analytics queries.

## Admin Panel

Instance-level (super-admin) tooling, gated to admins. Tabs under `admin-panel/components`
(`SettingsAdminContent`, `SettingsAdminGeneral`, `SettingsAdminTabContent`).

### Config Variables

- **Feature:** View/override instance environment config variables (env vs database source).
- **Key UI:** `config-variables/components` — `SettingsAdminConfigVariables(Table)`,
  `ConfigVariableValueInput`, `ConfigVariableDatabaseInput`, search/filter
  (`ConfigVariableSearchInput`, `ConfigVariableFilterDropdown/Container`),
  `ConfigVariableHelpText`, options dropdown. Route `admin-panel/config-variables/:name`.
- **Backend:** config-variable query + update/reset mutations.

### Signing Keys

- **Feature:** Manage & revoke JWT/signing keys.
- **Key UI:** `signing-keys/components` — `SettingsAdminSigningKeysTable`,
  `SettingsAdminRevokeSigningKeyConfirmationModal`.
- **Backend:** signing-key list + revoke mutations.

### Health Status

- **Feature:** Instance/worker/queue/account-sync health dashboard with maintenance mode.
- **Key UI (extensive):** `health-status/components` — `SettingsAdminHealthStatus(ListCard)`,
  indicator detail (`SettingsAdminIndicatorHealthStatusContent`,
  `SettingsAdminJsonDataIndicatorHealthStatus`), worker metrics
  (`SettingsAdminWorkerHealthStatus`, `...WorkerMetricsGraph/Tooltip`,
  `...WorkerQueueMetricsSection`), queue jobs (`...QueueJobsTable`, `...JobStateBadge`,
  `...JobDetailsExpandable`, retry/delete confirmation modals), connected-account sync
  (`...ConnectedAccountHealthStatus`, `...HealthAccountSyncCountersTable`), workspaces-by-health
  accordion, upgrade-status cards, maintenance-mode sub-folder. Routes under
  `admin-panel/health-status/...` (indicator, instance-status, workspaces-status, queue/:name,
  inferred-version).
- **Backend:** health-indicator queries, queue/job mutations (retry/delete), maintenance-mode toggle.

### AI Providers/Models (admin)

- **Feature:** Configure instance-level AI providers and models.
- **Key UI:** `admin-panel/ai/components` — `SettingsAdminAI`, `SettingsAdminAiProviderListCard`,
  `ModelsDevProviderLogo`. Routes `admin-panel/ai/new-provider`, `.../providers/:name`,
  `.../providers/:name/new-model`.
- **Backend:** AI-provider/model CRUD mutations.

### Users / Workspaces (admin)

- **Feature:** Inspect & impersonate users, view workspace details + billing + chat threads.
- **Key UI:** `SettingsAdminWorkspaceContent`, `...WorkspaceBillingContent`,
  `SettingsAdminChatThreadMessageList`, version display (`SettingsAdminVersionContainer/Display`).
  Routes `admin-panel/users/:id`, `admin-panel/workspaces/:id` (+ threads).

## Lab (Feature Flags)

- **Feature:** Toggle workspace feature flags (experimental features).
- **Key UI:** `lab/components/SettingsLabContent` (a list of flag toggles).
- **Backend:** `lab/graphql/mutations` — update-feature-flag mutation.

## Logic Functions (serverless functions)

- **Feature:** Author/run workspace serverless functions with multiple trigger types.
- **Key UI:** `logic-functions/components` — `SettingsLogicFunctionNewForm`,
  `SettingsLogicFunctionCodeEditor` (Monaco-style code editor), `tabs/` (test/run/logs/settings),
  and `triggers/` — Cron, Database-event, HTTP, Tool, Workflow-action trigger sections +
  `...TriggerPayloadFormat`. Routes `functions`, `functions/new`, `functions/:id`.
- **Backend:** logic-function CRUD + execute mutations (runtime-heavy; runs server-side code).

## AI (workspace AI agents/skills/prompts)

- **Feature:** Workspace-level AI configuration — agents, skills, tools, prompts, model selection,
  and AI usage.
- **Key UI:** `ai/components` — `SettingsAiModelsTable`, `SettingsAiModelHoverCard`; utils/types in
  `ai/`. Routes `ai`, `ai/prompts`, `ai/new-agent`, `ai/agents/:id` (+ turns), `ai/new-skill`,
  `ai/skills/:id`, `ai/tools/:id`, `ai/usage/user/:id`.
- **Backend:** agent/skill/tool/prompt CRUD; AI-usage queries; ties to admin AI providers.

## Integrations

- **Feature:** Third-party integration catalog (route `integrations`). In Twenty this is a thin
  landing surface listing available integrations; deeper config delegates to Accounts / Applications
  / Developers. No dedicated heavy component folder beyond the page + nav entry.
- **Backend:** integration metadata queries.

## Updates

- **Feature:** Release-notes / product-updates surface (route `updates`,
  `pages/settings/updates`). Read-only changelog feed.

---

## Supporting modules

- **`object-metadata`** — Shared metadata layer that data-model & every record view depend on:
  `components` (object icons, nav-drawer object sections, Apollo core provider, chip generators),
  `contexts`, `hooks` (object-metadata-item fetch/find/create/update/delete), `states`, `types`,
  `utils`, `validation-schemas`, `graphql`, and an `errors` set. The settings field/object editors
  read field-type metadata and write back through these hooks.
- **`metadata`-store / generated metadata** — `~/generated-metadata/graphql` provides
  `FieldMetadataType`, `RelationType`, and metadata mutations; the data-model settings forms are
  thin UI over this generated schema.

---

## Parity notes

Mapping of our ~24 built SabCRM/Twenty-style settings pages against the Twenty settings surface.
Tags: **SIMPLE** (static form/CRUD), **MEDIUM** (multi-form / matrix / chart), **RUNTIME-HEAVY**
(depends on live server runtime — code execution, sync engines, infra, billing providers, SSO/auth).

| Twenty settings area | Our build status | Tag | Notes |
| --- | --- | --- | --- |
| Profile | **BUILT** (profile) | SIMPLE | Name/email/password/delete covered |
| Experience / Appearance | **BUILT** (appearance) | SIMPLE | Format/timezone/color-scheme prefs |
| Workspace General | **BUILT** (general) | SIMPLE | Name/logo/subdomain |
| Members | **BUILT** (members) | SIMPLE | List members |
| Invitations | **BUILT** (invites) | SIMPLE | Invite-by-email |
| Roles (base) | **BUILT** (roles) | MEDIUM | Role list/create/detail |
| Roles — object-level perms | **BUILT** (data-model perms) | MEDIUM | Object read/write matrix |
| Roles — field-level perms | **PARTIAL** | MEDIUM | Field-permission table present, parity to verify |
| Roles — record-level perms (filter builder) | **MISSING** | MEDIUM | Twenty's record-level filter builder + `{{me}}` vars not built |
| Roles — permission flags (settings/tools) | **PARTIAL** | MEDIUM | Flag toggles partially mapped |
| Data model — objects | **BUILT** (data-model) | MEDIUM | Object list + about form |
| Data model — per-object settings | **BUILT** (per-object settings) | MEDIUM | Object detail tabs |
| Data model — field editor (icon/label/desc/unique) | **BUILT** (field editor) | MEDIUM | Shared sub-forms |
| Data model — option editor (select/multi-select) | **BUILT** (option editor) | MEDIUM | Option rows |
| Data model — color picker | **BUILT** (color editor) | SIMPLE | Per-option color from main palette |
| Data model — relation editor (type/target/inverse) | **BUILT** (relation editor) | MEDIUM | Has-many / belongs-to-one + target |
| Data model — morph relation | **MISSING** | MEDIUM | Polymorphic junction form not built |
| Data model — number/text/date/currency/address/phones type settings | **PARTIAL** | MEDIUM | Most type-specific cards present; verify date-format CUSTOM + address sub-field selection |
| Data model — indexes | **MISSING** | MEDIUM | Index create form not built |
| Data model — graph overview (ERD) | **MISSING** | RUNTIME-HEAVY | Visual ERD canvas not built |
| Developers — API keys (+ scopes/role) | **BUILT** (api + scopes) | MEDIUM | Key issue + role/scope selector |
| Developers — webhooks (+ event matrix) | **BUILT** (webhooks + event matrix) | MEDIUM | Object×operation matrix |
| Developers — GraphQL/REST playground | **BUILT** (playground) | RUNTIME-HEAVY | Needs live generated schema endpoints |
| Application registrations | **MISSING** | MEDIUM | OAuth app registrations not built |
| Applications (marketplace) | **MISSING** | RUNTIME-HEAVY | Install/uninstall + component runtime not built |
| Domains (subdomain/custom/public) | **PARTIAL** | RUNTIME-HEAVY | General-domain covered; DNS-verified custom/public domains depend on infra |
| Emailing domains | **MISSING** | RUNTIME-HEAVY | SPF/DKIM verification flow not built |
| Enterprise upsell | **MISSING** | SIMPLE | Plan-gating modal not built (SabNode has own plan gating) |
| Security — SSO OIDC/SAML | **PARTIAL** (security) | RUNTIME-HEAVY | Security page built; OIDC/SAML provider forms depend on auth runtime |
| Security — approved domains / auth providers / editable-fields | **PARTIAL** | MEDIUM | Some policy toggles present |
| Security — event logs / audit | **BUILT** (audit) | MEDIUM | Audit trail page |
| Two-factor authentication | **PARTIAL** (security) | RUNTIME-HEAVY | Enrollment depends on OTP service |
| Billing | **BUILT** (billing) | RUNTIME-HEAVY | Wired to SabNode billing, not Stripe-on-Twenty |
| Usage | **BUILT** (usage) | MEDIUM | Charts + per-user breakdown |
| Admin — config variables | **MISSING** | RUNTIME-HEAVY | Instance env override (super-admin) not built |
| Admin — signing keys | **MISSING** | RUNTIME-HEAVY | JWT key mgmt not built |
| Admin — health status | **MISSING** | RUNTIME-HEAVY | Worker/queue/sync dashboard depends on infra |
| Admin — AI providers/models | **MISSING** | RUNTIME-HEAVY | Instance AI provider config not built |
| Lab (feature flags) | **BUILT** (lab) | SIMPLE | Flag toggles |
| Logic functions (serverless) | **BUILT** (functions) | RUNTIME-HEAVY | Code editor present; execution runtime is the heavy dependency |
| AI (agents/skills/prompts/models) | **PARTIAL** | RUNTIME-HEAVY | Model table likely; agents/skills/tools runtime not fully built |
| Integrations | **MISSING** | MEDIUM | Catalog landing not built |
| Accounts (mailbox/calendar sync) | **BUILT** (accounts) | RUNTIME-HEAVY | UI built; full IMAP/Google sync depends on sync engine |
| Updates / changelog | **MISSING** | SIMPLE | Release-notes feed not built |
| **Extra (SabNode-only, not in Twenty)** | tags / templates / pipelines / segments / notifications / localization / help / import-export / views / automations (workflow builder) | — | Built on top of the Twenty base; no direct 1:1 Twenty settings counterpart |

**Headline gaps vs Twenty:** record-level permission filter builder, morph-relation editor, index
creation, the data-model graph ERD, application-registrations + applications marketplace,
emailing-domains verification, and the entire Admin Panel cluster (config-variables, signing-keys,
health-status, admin AI providers) — all of which are MEDIUM-to-RUNTIME-HEAVY and lean on
instance/infra runtime that SabNode wires differently. Most BUILT areas are the SIMPLE/MEDIUM
form-and-table surfaces; the RUNTIME-HEAVY ones we mark BUILT (billing, accounts, playground,
functions) have the UI but delegate their heavy behavior to SabNode-native backends rather than
Twenty's.
