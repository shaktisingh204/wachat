# Twenty Review 12 — Auth/Onboarding Frontend, UI Library, Shared Contracts

Read-only catalog of the vendored Twenty CRM. Covers `twenty-front/src/modules` (auth/identity/realtime slice), `twenty-ui/src` (component library + theme tokens), and `twenty-shared/src` (cross-cutting contracts — the canonical source of truth for field types and standard objects). Descriptions are original; no source is copied verbatim.

---

## Area: Authentication (`twenty-front/src/modules/auth`)

The auth module is a self-contained identity layer driving login, signup, SSO, 2FA, email verification, password reset, impersonation, and cross-tab sign-out. It is **token-pair based** (access + refresh JWTs) and **multi-workspace aware** (global-scope welcome screen vs. workspace-scoped sign-in).

### Sub-structure
| Folder | Role |
|---|---|
| `hooks/useAuth.ts` | Central orchestrator: credentials sign-in/up, token exchange, current-user load, redirect building, session clearing. |
| `services/AuthService.ts` | Low-level token renewal (calls `renewToken` against the server URI with the stored refresh token). |
| `sign-in-up/components` | The multi-step form UI (global-scope + workspace-scope variants, email/password fields, SSO provider selection, 2FA provision/verify, Google/Microsoft buttons). |
| `sign-in-up/hooks` | One hook per concern: `useSignInUp`, `useSignInUpForm`, `useSSO`, `useTwoFactorAuthenticationForm`, `useSignInWithGoogle`, `useSignInWithMicrosoft`, `useSignUpInNewWorkspace`, `useHandleResetPassword`, `useHandleResendEmailVerificationToken`, `useWorkspaceFromInviteHash`, `useWorkspaceBypass`, `useHasMultipleAuthMethods`. |
| `graphql/{mutations,queries,fragments}` | The full GraphQL surface (see flow table). |
| `states/` | Jotai atoms for the whole session: `tokenPairState`, `loginTokenState`, `currentUserState`, `currentWorkspaceState`, `currentWorkspaceMemberState(s)`, `availableWorkspacesState`, `signInUpStepState`, `signInUpModeState`, `lastAuthenticatedMethodState`, `isImpersonatingState`, `returnToPathState`, `qrCode` (2FA), `billingCheckoutSessionState`, `workspacePublicDataState`, `objectPermissionsFamilySelector`. |
| `components/` | `AuthProvider`, `AuthModal`, effect components: `VerifyLoginTokenEffect`, `VerifyEmailEffect`, `TwoFactorAuthenticationProvisionEffect`, `AuthModalMountEffect`. |
| `utils/` | `availableWorkspacesUtils`, `passwordRegex`, `isValidReturnToPath`, `crossTabSignOut`, `clearSessionLocalStorageKeys`, `clearAllSessionLocalStorageKeys`, `safeRemoveLocalStorageItems`, `getAuthModalConfig`. |

### Sign-in/up step machine (`SignInUpStep`)
`Init → Email → Password → EmailVerification → WorkspaceSelection → SSOIdentityProviderSelection → TwoFactorAuthenticationVerification → TwoFactorAuthenticationProvision`. The form first calls `checkUserExists` to branch sign-in vs. sign-up (`SignInUpMode.SignIn | SignUp`), then advances the step atom. Captcha token is read before credential submission when captcha is required.

### Authenticated methods (`AuthenticatedMethod` enum)
`EMAIL`, `GOOGLE`, `MICROSOFT`, `SSO`. The last-used method is persisted (`lastAuthenticatedMethodState` + a "Last used" pill) for faster repeat login.

### Auth flows → GraphQL operations
| Flow | Key operations |
|---|---|
| **Password login** | `checkUserExists` → `getLoginTokenFromCredentials` → `getAccessTokensFromLoginToken` (token-pair exchange). Workspace-scoped variant uses `signIn`. |
| **Signup** | `signUp` (workspace-agnostic) / `signUpInWorkspace` / `signUpInNewWorkspace`. |
| **SSO** | `getAuthorizationUrlForSSO` → browser redirect to IdP; available providers fetched via `availableSSOIdentityProvidersFragment`. `useSSO.redirectToSSOLoginPage(identityProviderId)`. |
| **2FA (TOTP)** | `initiateOTPProvisioning` (returns QR/secret → `qrCode` atom) → user scans → `getAuthTokenFromOTP`; `resetTwoFactorAuthentication` for reset. |
| **Email verification** | `verifyEmailAndGetLoginToken` / `verifyEmailAndGetWorkspaceAgnosticToken`; resend via `resendEmailVerificationToken`. Gated by `isEmailVerificationRequiredState`. |
| **Password reset** | `emailPasswordResetLink` → `validatePasswordResetToken` → `updatePasswordViaResetToken`. |
| **Token lifecycle** | `renewToken`, `generateTransientToken`, `generateApiKeyToken`. |
| **Impersonation** | `impersonate` mutation + `isImpersonatingState` + `useImpersonationSession`. |
| **OAuth app authorize** | `authorizeApp`, `findApplicationRegistrationByClientId` (OAuth2 consent screen at `/authorize`). |
| **Public workspace** | `getPublicWorkspaceDataByDomain`, `getWorkspaceFromInviteHash`. |

### Cross-cutting auth behaviors
- **Cross-tab sign-out**: `broadcastSignOutToOtherTabs` + `SignOutOnOtherTabSignOutEffect` keep all tabs in sync.
- **Return-to-path**: validated allow-listed redirect target preserved through the flow.
- **Multi-workspace**: `availableWorkspacesUtils` count/first-available helpers; workspace selection step appears only when multiple workspaces match the credentials.
- **Domain redirect**: integrates with `domain-manager` (`useRedirectToWorkspaceDomain`, `useOrigin`) so a global login lands on the correct workspace subdomain.

---

## Area: Onboarding (`twenty-front/src/modules/onboarding`)

A thin, server-state-driven onboarding controller. The current step lives on `currentUser.onboardingStatus` (server enum `OnboardingStatus`); the frontend reads it and computes the next status.

### Status progression (`useSetNextOnboardingStatus` logic)
`WORKSPACE_ACTIVATION → PROFILE_CREATION → (SYNC_EMAIL if email sync available) → INVITE_TEAM → (BOOK_ONBOARDING if applicable) → COMPLETED`. Each step is gated by feature flags / availability; non-applicable steps are skipped.

### Onboarding route paths (`ONBOARDING_PATHS`, from `AppPath`)
`CreateWorkspace (/create/workspace)`, `CreateProfile (/create/profile)`, `SyncEmails (/sync/emails)`, `InviteTeam (/invite-team)`, `PlanRequired (/plan-required)`, `PlanRequiredSuccess`, `BookCallDecision`, `BookCall`.

### Steps
| Step | Frontend pieces |
|---|---|
| **Workspace creation/activation** | `useSignUpInNewWorkspace` + `activateWorkspace` mutation (workspace module). |
| **Profile creation** | Name/avatar capture on the new workspace member. |
| **Email/calendar sync setup** | `OnboardingSyncEmailsSettingsCard` + `ONBOARDING_SYNC_EMAILS_OPTIONS` — three visibility tiers mapped to `MessageChannelVisibility`: **Everything** (`SHARE_EVERYTHING`), **Subject and metadata** (`SUBJECT`), **Metadata** (`METADATA`). Skippable via `skipSyncEmailOnboardingStep`. |
| **Invite team** | Hands off to `workspace`/`workspace-invitation` modules. |
| **Book onboarding call** | `BookCall` modal; skippable via `skipBookOnboardingStep`. |
| **Plan required / product tour** | Billing gate; success page redirect. |

`OngoingUserCreationPaths` (`Invite`, `SignInUp`, `VerifyEmail`, `Verify`) marks the pre-onboarding signup phase.

---

## Area: Workspace / Member / Invitation / Users

### `workspace`
Workspace context provider + feature-flag plumbing. Hooks: `useFeatureFlagsMap`, `useIsFeatureEnabled`, `useSubscriptionStatus`, `useIsWorkspaceActivationStatusEqualsTo`. States: `workspaceAuthProvidersState`, `workspaceAuthBypassProvidersState`, `workspaceBypassModeState`, `hasReachedCurrentBillingPeriodCapSelector`. Mutations: `updateWorkspace`, `activateWorkspace`, `uploadWorkspaceLogo`, `deleteCurrentWorkspace`. Queries: public workspace data by id, workspace-from-invite-hash, custom-domain record validation, AI system-prompt preview. Components: `WorkspaceInviteTeam`, `WorkspaceInviteLink`, `WorkspaceProviderEffect`.

### `workspace-member`
The `WorkspaceMember` type + three GraphQL fragments (full / partial / deleted). This is the per-workspace user identity (distinct from the global `User`).

### `workspace-invitation`
Invite lifecycle hooks: `useCreateWorkspaceInvitation`, `useResendWorkspaceInvitation`, `useDeleteWorkspaceInvitation`, backed by `sendInvitations`, `resendWorkspaceInvitation`, `deleteWorkspaceInvitation` mutations and `getWorkspaceInvitations` query.

### `users`
Global user identity. `useLoadCurrentUser` hydrates `currentUserState` via `getCurrentUser`; fragments cover user, billing subscriptions, current subscription, and workspace URLs. Account-level mutations: `deleteUserAccount`, `deleteUserWorkspace`. `UserContext` exposes the loaded user.

---

## Area: Localization (`twenty-front/src/modules/localization`)

Date/time/number formatting bridged to each workspace member's preferences (not the same as i18n string translation — that is `lingui`). Constants define `DateFormat`, `DateFormatWithoutYear`, `TimeFormat`, `NumberFormat`. A large `format-preferences/` utility set converts between member-stored enum values and runtime format objects (timezone, calendar start day, date/time/number format), plus a deep set of `formatDateISOStringTo*` helpers (date, datetime, relative date, simplified, custom Unicode format). Hooks: `useFormatPreferences`, `useDateTimeFormat`, `useNumberFormat`, `useInitializeFormatPreferences`. State: `workspaceMemberFormatPreferencesState`.

**i18n (string translation)** is `lingui`-based. `SOURCE_LOCALE = 'en'` and the supported-locale map (`APP_LOCALES`) live in `twenty-shared/src/translations`; the front activates locales via `src/utils/i18n/initialI18nActivate.ts`, and message catalogs use `msg\`...\`` macros (seen throughout, e.g. onboarding sync options).

---

## Area: Client config (`twenty-front/src/modules/client-config`)

Boots the app from a server `ClientConfig` payload and fans it out into ~30 Jotai atoms — each a boolean/feature toggle or config object. Notable: `authProvidersState`, `captchaState`, `billingState`, `sentryConfigState`, `apiConfigState`, `appVersionState`, `maintenanceModeState`, `isMultiWorkspaceEnabledState`, `isEmailVerificationRequiredState`, `aiModelsState`, `supportChatState`, plus integration toggles (Google/Microsoft messaging & calendar, Cloudflare, ClickHouse, IMAP/SMTP/CalDAV, analytics, emailing domains). `ClientConfigProvider(+Effect)` loads it once; `useClientConfig` / `useCaptcha` consume it.

---

## Area: Apollo / GraphQL transport (`twenty-front/src/modules/apollo`)

`apollo.factory.ts` builds a composed Apollo Client v4 link chain:
`authLink (setContext, injects bearer + workspace headers)` → `RestLink` / `UploadHttpLink` (apollo-upload-client, for multipart file uploads) → `StreamingRestLink` (custom, for streamed REST responses) → `RetryLink` (retries with auth-error detection that triggers token renewal) → `ErrorLink` (central error surfacing) → `loggerLink` (branded "SabCRM"). Token utilities: `getTokenPair`, `hasTokenPair`, `isValidAuthTokenPair`, `encodeCursor`, `captchaRefreshLink`. Hooks: `useApolloFactory`, `useQueryWithCallbacks`, `useSnackBarOnQueryError`.

### Optimistic effects (`apollo/optimistic-effect`)
A purpose-built optimistic-cache mutation system that keeps the InMemoryCache consistent without a refetch. Triggers: `triggerCreateRecordsOptimisticEffect`, `triggerUpdateRecordOptimisticEffect` (+ by-batch variant), `triggerDestroyRecordsOptimisticEffect`, `triggerAttachRelationOptimisticEffect`, `triggerDetachRelationOptimisticEffect`, `triggerUpdateRelationsOptimisticEffect`. Sorted-connection helpers (`buildSortedConnectionEdges`, `sortCachedObjectEdges`) re-insert records in the correct position. A dedicated **group-by** sub-system (`triggerUpdateGroupByQueriesOptimisticEffect`, `doesRecordBelongToGroup`, `normalizeGroupByDimensionValue`, `processGroupByConnectionWithRecords`) keeps aggregated/grouped views live.

---

## Area: Realtime DB events (`twenty-front/src/modules/sse-db-event`)

Server-Sent-Events (SSE) channel that pushes DB record changes to subscribed list/show views and replays them through the optimistic-effect cache. This is the "live updating" backbone.

- **Providers/effects**: `SSEProvider`, `SSEClientEffect` (connects), `SSEEventStreamEffect` (consumes the stream), `SSEQuerySubscribeEffect` (registers a query's interest).
- **Stream lifecycle hooks**: `useTriggerEventStreamCreation`, `useTriggerEventStreamDestroy`, `useChangeQueryListenState`, `useListenToEventsForQuery`, `useHandleSseClientConnectionRetry`, `useClearSseClient`. Add/remove a query to the stream via `AddQueryToEventStreamMutation` / `RemoveQueryFromEventStreamMutation`.
- **Event → cache hooks**: `useTriggerOptimisticEffectFromSseEvents` and per-action variants (Create / Update / Delete / Restore). Metadata events are bridged to browser events (`useDispatchMetadataEventsFromSseToBrowserEvents`).
- **Utils**: group SSE events by object metadata / event type, translate SSE record events to browser operation events, classify gracefully-handled stream errors. Retry timing is constant-driven (`SseConnectionRetryMaxWaitTimeInMs`, dev-mode and race-avoidance variants).
- **State**: a registry of active/required query listeners, the SSE client, stream id, ready/creating/destroying flags, and a dispose-function map.

---

## Area: Error handling (`error-handler` + `metadata-error-handler`)

`error-handler` provides the React error-boundary stack: `AppErrorBoundary` (+ effect), and tiered fallbacks `AppRootErrorFallback`, `AppPageErrorFallback`, `AppFullScreenErrorFallback`, `AppErrorDisplay`. `ExceptionHandlerProvider` + `SentryInitEffect` wire Sentry; `PromiseRejectionEffect` and `ErrorMessageEffect` capture unhandled rejections / surface messages. A special case detects Vite stale-chunk lazy-loading errors (`checkIfItsAViteStaleChunkLazyLoadingError`) to trigger a reload after a deploy. `metadata-error-handler` is a smaller module that classifies metadata-API errors (`classifyMetadataError`) and exposes `useMetadataErrorHandler`.

---

## Area: Context store (`twenty-front/src/modules/context-store`)

Component-scoped state describing "what records/view is the user currently acting on" — the backbone for bulk actions, command menu, and side panels. Component-states (per instance id): current object-metadata-item id, current view id/type, current page type, filters + filter groups, any-field filter value, targeted-records rule, number-of-selected-records, record-show-parent-view flag. `MainContextStoreProvider(+Effect)` seeds the default instance. Helpers: `computeContextStoreFilters`, `getPageType`, `getViewType`, `useFindManyRecordsSelectedInContextStore`, `useContextStoreObjectMetadataItem(OrThrow)`, and a `mainContextStoreHasSelectedRecordsSelector`.

---

## Area: Captcha (`twenty-front/src/modules/captcha`)

Pluggable captcha for protected auth paths. `CaptchaProtectedPaths` lists guarded routes; `isCaptchaRequiredForPath` checks the current path. `getCaptchaUrlByProvider` builds the provider script URL (provider comes from client-config). `CaptchaProvider` + `CaptchaProviderScriptLoaderEffect` inject the script; `useRequestFreshCaptchaToken` / `useReadCaptchaToken` produce tokens consumed by the sign-in/up flow and the Apollo `captchaRefreshLink`. State: script-loaded, current token, is-requesting flags.

---

## Area: UI Library (`twenty-ui/src`) — by category

Emotion + Radix-based component library. Public surface is barrel-exported per category (`twenty-ui/display`, `/input`, `/layout`, `/navigation`, `/feedback`, `/theme`).

### Display
Avatars (`Avatar`, with constants/types), banners, callouts, checkmark, color chips, command blocks, icon system (`display/icon` — providers/hooks/states/types, dynamic icon registry), info chips, **status pills**, tinted icon tiles, tooltips, typography/text (`LinkifiedText`, ellipsis text), chip / tag / Pill primitives.

### Input
Buttons are the largest sub-family: `Button`, `MainButton`, `LightButton`, `IconButton`, `LightIconButton`, `FloatingButton` + `FloatingIconButton` (+ groups), `RoundedIconButton`, `InsideButton`, `AnimatedButton`, `AnimatedLightIconButton`, `ColorPickerButton`, `TabButton`, `ButtonGroup` / `FloatingButtonGroup` / `IconButtonGroup`. Form inputs: `Checkbox`, `Radio` + `RadioGroup`, `CardPicker`, `IconListViewGrip`. Plus `code-editor` and `color-scheme` (light/dark toggle) sub-modules.

### Layout
`Card` (+ components), `Modal` (`Modal`, `ModalHeader`, `ModalContent`, `ModalFooter`, `ModalBackdrop` — with size tokens sm/md/lg/xl/fullscreen and overlay variants), `Section`, `AnimatedExpandableContainer`, `AnimatedPlaceholder`, `ResizeHandle`. Modal config types (`ModalSize`, `ModalOverlay`) are consumed by the auth modal.

### Navigation
`Link`, `Menu` + `MenuItem` (rich menu-item family with internals/constants/types), `NavigationBar`, `NotificationCounter`.

### Feedback
`Loader`, `ProgressBar`.

### Data-viz / JSON
`json-visualizer` (top-level) renders structured JSON; color/status display primitives double as light data-viz.

### Accessibility / utilities / testing
`accessibility/`, `utilities/`, and a `testing/` harness ship alongside for consumers.

### Theme / design tokens — the `--t-*` system
Tokens are authored in TypeScript constants under `theme/constants/` (auto-generated barrel `theme/index.ts`), then **generated** into:
- `theme-constants/theme-light.css` (`.light { … }`) and `theme-constants/theme-dark.css` (`.dark { … }`) — the runtime CSS custom properties, all namespaced `--t-*`.
- `theme-constants/themeCssVariables.ts` — a typed JS object mirroring each var as `var(--t-…)` for use in Emotion styles.

Token families (`--t-…`): `icon-size/stroke`, `modal-size-*`, `text-line-height/icon-*`, `animation-duration-{instant,fast,normal,slow}`, a full `spacing-0..32` scale (4px multiplicator, plus `0_5`/`1_5` and semantic gaps like `between-siblings-gap`, `side-panel-width`, table cell metrics), `accent-{primary,secondary,tertiary,quaternary,accent1..12,accent3570,accent4060}`, `background-{primary..quaternary,inverted-*,danger,transparent-*,overlay-*,radial-gradient*,noisy}`, `blur-{light,medium,strong}`, `border-color-*` + `border-radius-{xs,sm,md,xl,xxl,pill}`, plus font/box-shadow/tag/code/snackbar families (light+dark pairs).

Light/dark are full mirrors (each constant has a `*Light`/`*Dark` file). The default vendor theme is essentially monochrome — accents resolve to near-greys in `display-p3` color space. The **named color palette** (`MainColorNames` / `MAIN_COLORS_LIGHT`) maps semantic color names (red, ruby, crimson, tomato, orange, amber, yellow, lime, grass, green, jade, mint, turquoise, cyan, sky, blue→indigo, iris, violet, purple, plum, pink, bronze, gold, brown, gray) onto Radix P3 step-9 colors — used for record tags / select-option colors. `ThemeColor` is the union of those names.

---

## twenty-shared/src — Shared Contracts (source of truth)

Isomorphic package imported by both `twenty-front` and `twenty-server`. Holds the canonical enums, the standard-object universal-identifier registry, and pure utility/constant helpers. Top-level groups: `types`, `constants`, `metadata`, `database-events`, `translations`, `i18n`, `utils`, `workflow`, `workspace`, `ai`, `application`, `logic-function`.

### Canonical field types — `FieldMetadataType` (COMPLETE, 24 values)
| Type | Notes |
|---|---|
| `UUID` | Identifier/text-like; valid label-identifier type. |
| `TEXT` | Plain text; label-identifier type. |
| `NUMBER` | Integer/decimal. |
| `NUMERIC` | High-precision numeric. |
| `BOOLEAN` | True/false. |
| `DATE` | Date only. |
| `DATE_TIME` | Timestamp. |
| `RATING` | Enum-backed star rating (`RATING_VALUES`). Enum-type. |
| `SELECT` | Single-choice enum. Enum-type. |
| `MULTI_SELECT` | Multi-choice enum. Enum-type. |
| `ARRAY` | Array of scalars. |
| `RAW_JSON` | Arbitrary JSON. |
| `RICH_TEXT` | Composite — `{ blocknote, markdown }`. |
| `POSITION` | Ordering/sort position. |
| `TS_VECTOR` | Full-text search vector (filterable-as-search, not user-set). |
| `ACTOR` | Composite — `{ source, name, workspaceMemberId, context }` (created-by/updated-by). |
| `ADDRESS` | Composite — street1/2, city, state, country, postcode, lat, lng. |
| `CURRENCY` | Composite — `{ amountMicros, currencyCode }`. |
| `EMAILS` | Composite — `{ primaryEmail, additionalEmails }`. |
| `PHONES` | Composite — primary calling/country code + number, `additionalPhones`. |
| `LINKS` | Composite — `{ primaryLinkUrl, primaryLinkLabel, secondaryLinks }`. |
| `FULL_NAME` | Composite — `{ firstName, lastName }`. Label-identifier type. |
| `FILES` | File attachments (max count constant-bounded). |
| `RELATION` | One-to-many / many-to-one association. |
| `MORPH_RELATION` | Polymorphic relation (target object varies). |

**Composite types** (with sub-fields) are exactly: `CURRENCY`, `EMAILS`, `LINKS`, `PHONES`, `FULL_NAME`, `ADDRESS`, `ACTOR`, `RICH_TEXT` (see `COMPOSITE_FIELD_TYPE_SUB_FIELDS_NAMES`).
**Enum types**: `RATING`, `SELECT`, `MULTI_SELECT` (`EnumFieldMetadataType`).
**Label-identifier-eligible types**: `TEXT`, `FULL_NAME`, `UUID`.
**Filterable types** (`FILTERABLE_FIELD_TYPES`): all of the above except `MORPH_RELATION`, `POSITION`, `NUMERIC`, `TS_VECTOR` (i.e. TEXT, PHONES, EMAILS, DATE_TIME, DATE, NUMBER, CURRENCY, FULL_NAME, LINKS, RELATION, ADDRESS, SELECT, RATING, MULTI_SELECT, ACTOR, ARRAY, RAW_JSON, FILES, BOOLEAN, UUID); `TS_VECTOR` is filterable only as search.

### Related field/relation enums
| Enum | Values |
|---|---|
| `RelationType` | `MANY_TO_ONE`, `ONE_TO_MANY`. |
| `RelationOnDeleteAction` | `CASCADE`, `RESTRICT`, `SET_NULL`, `NO_ACTION`. |
| `RelationAndMorphRelationFieldMetadataType` | union of `RELATION` \| `MORPH_RELATION`. |
| `ObjectRecordGroupByDateGranularity` | `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`, `DAY_OF_THE_WEEK`, `MONTH_OF_THE_YEAR`, `QUARTER_OF_THE_YEAR`, `NONE`. |

### Standard object names — `CoreObjectNameSingular` (runtime enum used by the front)
`activity`, `activityTarget`, `apiKey`, `attachment`, `blocklist`, `calendarChannel`, `calendarEvent`, `comment`, `company`, `dashboard`, `timelineActivity`, `message`, `messageChannel`, `messageParticipant`, `messageFolder`, `messageThread`, `messageThreadSubscriber`, `messageChannelMessageAssociation`, `note`, `noteTarget`, `opportunity`, `person`, `task`, `taskTarget`, `webhook`, `workspaceMember`, `workflow`, `workflowVersion`, `workflowRun`.

> Note: there is **no** `CoreObjectNamePlural` enum in shared — plural names are derived/route-driven (`AppPath.RecordIndexPage = /objects/:objectNamePlural`).

### Standard-object universal-identifier registry — `STANDARD_OBJECTS`
The authoritative seed map (`metadata/constants/standard-object.constant.ts`) assigning **immutable universal UUIDs** to every standard object and each of its fields (warning header: never mutate an existing identifier). Object keys present: `attachment`, `blocklist`, `calendarChannelEventAssociation`, `calendarEventParticipant`, `calendarEvent`, `company`, `dashboard`, `messageChannelMessageAssociation`, `messageChannelMessageAssociationMessageFolder`, `messageParticipant`, `messageThread`, `message`, `note`, `noteTarget`, `opportunity`, `person`, `task`, `taskTarget`, `timelineActivity`, `workflow`, `workflowAutomatedTrigger`, `workflowRun`, `workflowVersion`, `workspaceMember`. Companion constants: `default-relations-object-standard-ids`, `standard-page-layout-universal-identifiers`. This is the source of truth that lets the server seed/upgrade the data model deterministically across workspaces.

### Other shared enums & key constants
| Name | Purpose |
|---|---|
| `PermissionFlagType` | Full RBAC flag set — settings (API_KEYS_AND_WEBHOOKS, WORKSPACE, WORKSPACE_MEMBERS, ROLES, DATA_MODEL, SECURITY, WORKFLOWS, IMPERSONATE, SSO_BYPASS, APPLICATIONS, MARKETPLACE_APPS, LAYOUTS, BILLING, AI_SETTINGS) + tool perms (AI, VIEWS, UPLOAD_FILE, DOWNLOAD_FILE, SEND_EMAIL_TOOL, HTTP_REQUEST_TOOL, CODE_INTERPRETER_TOOL, IMPORT_CSV, EXPORT_CSV, CONNECTED_ACCOUNTS, PROFILE_INFORMATION). |
| `SystemPermissionFlag` | System-level permission flags. |
| `AppPath` | All client routes (auth, onboarding, record index/show, settings, developers, authorize, not-found). |
| `APP_LOCALES` / `SOURCE_LOCALE` | i18n supported-locale map + base locale (`en`). |
| `CurrencyCode` / `CurrencyCodeLabels` | ~150 ISO currency codes + labels. |
| `RATING_VALUES` | Allowed RATING field values. |
| `IanaTimeZones`, `CalendarStartDay`, `DateTypeFormat`, `NumberFormat` (via consts) | Localization primitives. |
| `ReservedSubdomains`, `SubdomainPattern` | Workspace-domain validation. |
| `Query*` / `BackendBatchRequestMaxCount` / `MaxEmailRecipients` / `MaxCustomIndexesPerObject` | API/limit guards. |
| `database-events/*` | `ObjectRecordBaseEvent` + create/update/delete/destroy/restore/upsert event classes, `ObjectRecordDiff`, `DatabaseEventPayload` — the typed shapes the SSE channel ships. |

### Shared utilities (`utils/`)
Pure isomorphic helpers grouped by domain: `array`, `date`, `format`, `filter`, `strings`, `json`, `url`, `image`, `files`, `graphql`, `fieldMetadata`, `indexMetadata`, `navigation`, `validation`, `typeguard`, `sentry`, `errors`, `upgrade`, `tiptap`, plus standalone helpers (`applyDiff`, `deepMerge`, `compute-diff-between-objects`, `base64UrlEncode`, `uuidToBase36`, `evalFromContext` + `variable-resolver`/`rich-text-variable-resolver` for the expression engine, `assertUnreachable`, `parseJson`/`getURLSafely` safe parsers). `metadata/check-if-field-is-{label,image}-identifier.util.ts` enforce identifier rules.

---

## Parity notes

Tagging each area by port difficulty for the SabCRM rebuild.

| Area | Tag | Rationale |
|---|---|---|
| **`twenty-shared` field-type & standard-object enums/constants** | **SIMPLE** | Pure data/contracts. Copy `FieldMetadataType`, composite sub-fields, `CoreObjectNameSingular`, relation enums, `STANDARD_OBJECTS` UUID registry verbatim — they are the load-bearing source of truth and must stay byte-identical to the server seed. No runtime. |
| **`twenty-shared` utilities** | **SIMPLE** | Isomorphic pure functions; lift as-is. |
| **Localization (date/number formatting) + i18n catalogs** | **SIMPLE → MEDIUM** | Formatting helpers are pure (SIMPLE); wiring `lingui` activation + member format-preference sync is MEDIUM. |
| **UI library components** | **MEDIUM** | Per the project rule we do **not** vendor twenty-ui; we rebuild on ZoruUI. Component categories map cleanly (buttons/cards/modals/menus/status pills/tags). |
| **Theme / `--t-*` tokens** | **MEDIUM** | We **replicated the token system as `--st-*`** (SabNode/ZoruUI namespace) rather than `--t-*` — same families (spacing/accent/background/border-radius/blur/box-shadow, light+dark mirrors), re-themed B&W. Generation pipeline (TS constants → CSS + typed object) is reproducible. |
| **Client-config bootstrap** | **MEDIUM** | Straightforward atom fan-out, but every toggle must be backed by a real server config value. |
| **Context store** | **MEDIUM** | Component-scoped state; logic is self-contained but tightly coupled to views/command-menu. |
| **Error handler** | **MEDIUM** | Boundaries + Sentry + Vite-stale-chunk handling; needs the host build tooling wired. |
| **Captcha** | **MEDIUM → RUNTIME-HEAVY** | Provider script loading + token refresh integrated into the Apollo link and auth submit. |
| **Apollo transport + optimistic effects** | **RUNTIME-HEAVY** | Multi-link chain (auth/rest/upload/streaming/retry/error), token-renewal-on-401, and the optimistic-cache + group-by effect engine are deeply coupled to the GraphQL schema and InMemoryCache; not portable without the live server. |
| **Auth (login/signup/SSO/2FA/email-verify/password-reset/impersonation)** | **RUNTIME-HEAVY** | Entire flow depends on server mutations, token-pair lifecycle, multi-workspace/domain redirects, and captcha. Frontend step-machine is portable but inert without the backend. |
| **Onboarding (workspace/profile/sync/invite/book-call)** | **RUNTIME-HEAVY** | Driven by server `onboardingStatus`; each step calls server mutations and feature flags. |
| **SSE realtime + Apollo subscriptions/optimistic updates** | **RUNTIME-HEAVY** | Requires the SSE event-stream endpoint, per-query subscription registry, and the optimistic-effect cache wiring. Highest-coupling area in this slice. |
