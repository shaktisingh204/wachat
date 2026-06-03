# Twenty Front — Navigation, Command Menu, Dashboards, Search & Layout Shell

Original structured catalog of the vendored Twenty CRM frontend (`twenty-front/src/modules`),
covering the application shell, the ⌘K command surface, keyboard shortcuts, the side panel,
dashboards/widgets, analytics, geo, banners, support, and the shared `ui` primitives/theme.

> All descriptions below are paraphrased from the source structure — no source code is reproduced verbatim.

---

## App shell & navigation (`navigation`, `navigation-menu-item`, `ui/navigation`)

The left-hand application drawer is the primary navigation surface. A top-level dispatcher
(`AppNavigationDrawer`) swaps between two drawers depending on route context: the **main drawer**
(object/workspace navigation) and the **settings drawer** (admin/configuration tree). This is decided
by a `useIsSettingsDrawer` hook.

**Main drawer composition** (`MainNavigationDrawer`):

| Layer | Responsibility |
|-------|----------------|
| Header | Workspace title / multi-workspace switcher dropdown |
| Fixed content (`MainNavigationDrawerTabsRow`) | A tabs row that toggles between the navigation tree and the AI-chat history pane (gated by an `AI` permission flag) |
| Scrollable content | Either the navigation content or the AI chat content, chosen by the active drawer tab |

**Scrollable navigation content** (`MainNavigationDrawerScrollableItems`) renders, in order:

1. **Opened section** — the currently expanded folder, if a navigation folder is open.
2. **Favorites section** (lazy-loaded `FavoritesSectionDispatcher`) — user/workspace favorites.
3. **Workspace section** (lazy-loaded `WorkspaceSectionDispatcher`) — the object list (companies, people, opportunities, custom objects, etc.), with both a drag-and-drop reorderable variant and a read-only variant.
4. **Other section** (`NavigationDrawerOtherSection`) — hidden while layout-customization mode is active.

**Navigation menu items** (`navigation-menu-item`) is a large sub-system splitting **display** vs **edit**:

- **Display side** renders sections, individual items (`NavigationMenuItemDisplay`), icons, skeleton loaders, drag-and-drop targets, and folder grouping. Item kinds: **record**, **view**, **object**, **link**, **folder**, and **page-layout**.
- **Edit side** drives a side-panel-based editor to add/edit nav items across the same kinds (record / view / object / link / folder / page-layout), including a folder-content dispatcher and orphan drop-targets.
- **Sections** are an enum: `WORKSPACE` and `FAVORITES`. Default colors are defined per item kind (link / folder / page-layout).

**Mobile** uses a separate `MobileNavigationBar` plus a `currentMobileNavigationDrawerState` atom.

**Navigation state** (Jotai atoms): last-visited object metadata id, last-visited view per object, drawer-expanded flag, and the current mobile drawer. Hooks resolve the default home path, settings-page detection, last-visited-view restoration, and opening settings.

**`ui/navigation`** provides the reusable drawer primitives (the *chrome*, separate from CRM-specific content):
`NavigationDrawer`, fixed/scrollable content wrappers, header, collapse + back buttons, animated collapse wrapper, search input, item / sub-item / item-group / item-breadcrumb, collapsable container, section + section title (with skeleton loaders), and the multi-workspace dropdown. Also includes breadcrumb, step-bar, navigation-bar, and generic menu-item primitives. Drawer tabs and active-tab live in `ui/navigation/states`.

---

## Command menu — the ⌘K surface (`command-menu`, `command-menu-item`)

> Architectural note: in this Twenty version the "command menu" is **fused into the right-hand side panel**. ⌘K toggles the side-panel menu; the command menu renders inside the same animated side-panel container (`CommandMenuOpenContainer` is a fixed, right-anchored, framer-motion panel). So "command menu" and "side panel" share one runtime surface.

**Hotkeys** (`useCommandMenuHotKeys`):

| Keys | Action |
|------|--------|
| `⌘K` / `Ctrl+K` | Close the keyboard-shortcut overlay and toggle the side-panel command menu |
| `/` | Open the **records search** page in the side panel |
| `@` | Open the **Ask AI** page in the side panel (resets nav stack) |
| `Esc` | Go back one level in the side-panel history |
| `Backspace` / `Delete` | Step back one sub-page (unless search text is present) |

**Command menu components** (`command-menu/components`): the open container, a mobile variant, the trigger button, and a family of menu-item primitives — plain item, dropdown item, text-input item, number-input item, and toggle item. Also includes "add to navigation" droppable wrappers (dnd-kit) so a command-menu result can be dragged into the nav drawer. Constants cap results via `MAX_SEARCH_RESULTS` and define a click-outside id.

**`command-menu-item`** is the heavier registry/runtime layer:

- **Context API** (`useCurrentCommandMenuContextApi`, `EmptyCommandMenuContextApi`) — supplies the active record/page context that commands act on.
- **Display** — item renderer + error boundary, loader, and **pinned inline command-menu items** with a measured inline layout (pinned action buttons computed against available width).
- **Edit** — a side-panel edit page for command-menu items.
- **Engine commands** (`engine-command`) — a *headless command* execution model. Commands mount/unmount via `useMountCommand` / `useUnmountEngineCommand`, register through a `headlessCommandContextApisState` atom, and run via `CommandRunner`. Built-in record commands: **delete**, **restore**, **destroy** (permanent), **export** (keyed by `RecordCommandKeys`), plus **trigger-workflow-version**, **compose-email**, **navigate**, **open-side-panel-page**, and **front-component renderer** headless commands.
- **Surface variants**: `RecordIndexCommandMenu`, `RecordShowCommandMenu`, `RecordPageSidePanelCommandMenu`, and `StandalonePageCommandMenu` (each with a dropdown counterpart) — i.e. the command menu adapts its action set to the current page (record index vs record show vs standalone).

So the command registry = **navigation targets** + **records search results** + **context actions** (record CRUD/export/workflow) + **AI** + **pinned actions**, resolved per page context.

---

## Keyboard shortcuts system (`keyboard-shortcut-menu`)

A help overlay listing shortcuts, opened from the command menu / `⌘K` flow. Components: the menu, its dialog, grouped sections, individual items, an open-content panel, and shared styles. A `useKeyboardShortcutMenu` hook controls open/close.

**Shortcut model** (`Shortcut` type): `label`, a `type` (`General` | `Table`), an optional first/second hot-key glyph, and an `areSimultaneous` flag. Two constant tables:

- **General**: Open search (`⌘`+`K`), Mark as favourite (`⇧`+`F`).
- **Table**: Move right (`→`), Move left (`←`), Clear selection (`esc`).

Note the OS-aware control glyph via `getOsControlSymbol` (⌘ vs Ctrl).

---

## Side panel (`side-panel`)

The right-hand panel is a **stack-based router** that hosts the command menu, search, record views, AI, workflow editing, dashboard widget settings, email compose, and more. It is the runtime backbone the command menu lives in.

**Page registry** (`SidePanelPages` enum, in `twenty-shared`): ~30 page ids including
`CommandMenuDisplay`, `SearchRecords`, `ViewRecord`, `MergeRecords`, `UpdateRecords`,
`ViewCalendarEvent`, `EditRichText`, `Copilot`, `AskAI`, `ViewPreviousAiChats`, the `Workflow*`
step pages, the `PageLayout*` / `Dashboard*` widget-settings pages, `RecordPageField(s)Settings`,
`ViewFrontComponent`, `NavigationMenuItemEdit` / `NavigationMenuAddItem`, `CommandMenuEdit`, and `ComposeEmail`.

**Routing & history**: `SidePanelRouter` + `SidePanelSubPageRouter` render the active page; a navigation
**stack** atom (`sidePanelNavigationStackState`) plus sub-page stack atoms enable back/forward.
Hooks: `useNavigateSidePanel`, `useSidePanelHistory`, `useSidePanelMenu`, `useSidePanelSubPageHistory`,
and a family of `useOpen…InSidePanel` openers (record, search, ask-AI, compose-email, calendar event,
front-component, merge/update records, rich text, widget settings).

**Container chrome**: desktop vs mobile containers, top bar (with search input + focus effect + right-corner
icon), back/toggle buttons, context chips (record/folder/link/page/multi-record), width effect, and a
close-animation cleanup. State atoms track open/closing/animating, width, search text + object filter,
selection, and per-page info.

**Side-panel pages** (`side-panel/pages`): page-layout, front-component, calendar-event, compose-email,
**search** (`SidePanelSearchRecordsPage` + `useSidePanelSearchRecords`), ai-chat-threads, rich-text,
workflow, record-page, ask-ai, root, and common. The **search page** is the `/`-triggered global record
search (object-filtered, capped by `MAX_SEARCH_RESULTS`).

---

## Dashboards & widgets (`dashboards`, `page-layout`)

Dashboards in this version are a **specialization of the page-layout system**. The `dashboards` module
itself is thin: a duplicate-dashboard mutation/hook and queries to fetch a single page layout (and its
type). The heavy lifting is in **`page-layout`**, a grid-based, tabbed, drag-resizable canvas shared by
both dashboards and record pages.

**Layout model**: a `PageLayout` has `PageLayoutTab`s, each holding `PageLayoutWidget`s positioned on a
responsive grid (`GridLayoutItem` with x/y/w/h, react-grid-layout style). Constants define breakpoints,
row height, margins, min/buffer rows, z-indices (normal / dragging / overlay), and per-widget default +
minimum sizes. A `DraftPageLayout` supports an editing draft.

**Widget types** (`page-layout/widgets`):

| Widget family | Notes |
|---------------|-------|
| **Graph / chart** (`graph`, `chart-core`) | The dashboard chart widgets |
| Aggregate chart | Single-number KPI (`AGGREGATE_CHART`, default 2×2) |
| Bar chart | `BAR_CHART`, default 6×6 |
| Line chart | `LINE_CHART`, default 6×10 |
| Pie chart | `PIE_CHART`, default 4×4 |
| Record table | Embedded record list |
| Iframe | Embed external content |
| Tasks / Notes / Emails / Email thread / Calendar / Files | Record-relational content widgets |
| Field / Fields | Single-field & field-group display |
| Front-component | Headless/custom rendered component |
| Standalone rich text | Inline rich-text block |
| Workflow | Workflow display widget |

Widget chrome includes a `widget-card`, placeholder displays (empty / no-data / forbidden / invalid-config),
add-widget sections (record-page and standalone), and renderers split by host (`RecordPageWidgetRenderer`
vs `NonRecordPageWidgetRenderer`). Widget settings (chart config, iframe, record-table, field config) are
edited through dedicated **side-panel pages** (`DashboardChartSettings`, `DashboardIframeSettings`,
`DashboardRecordTableSettings`, etc.). Widget actions are typed (`WidgetAction`), and access denial is
modeled (`WidgetAccessDenialInfo`).

**Default layouts**: pre-baked page layouts ship for Company, Person, Opportunity, Note, Task,
MessageThread, and Workflow/WorkflowVersion/WorkflowRun records, plus a generic default and an empty layout.

---

## Analytics (`analytics`)

A lightweight product-analytics event tracker. A single `track` GraphQL mutation plus a
`useEventTracker` hook fire named events to the backend. This is telemetry — **not** a user-facing
charting dashboard (charts live in `page-layout/widgets/graph`).

---

## Geo (`geo-map`)

Despite the name, this module is a **Google Places address autocomplete**, not a rendered map view.
It provides a `PlaceAutocompleteSelect` dropdown and a `useGetPlaceApiData` hook over typed place APIs
(`PlaceAutocompleteVariables`/`Result`, `PlaceDetailsResult` returning street/city/state/postcode/country
+ lat/lng). Used to populate structured address fields. There is no tile/marker map renderer here.

---

## Information banners (`information-banner`)

Top-of-app contextual banners, dispatched by `InformationBanner` / `InformationBannerWrapper`. Categories:

- **Billing**: subscription paused, end-of-trial, failed payment, no subscription, no more credits.
- **Reconnect account**: email-alias reconnect, insufficient permissions.
- **Maintenance**: maintenance-mode notice.
- **Impersonate**: "you are impersonating" warning.
- **Deleted record**: viewing a soft-deleted record.

Backed by graphql queries/mutations and context state.

---

## Support (`support`)

Thin integration that boots a third-party support chat widget (`SupportChatEffect` +
`useInstantiateSupportChat`) and a `getDocumentationUrl` helper. No bespoke UI.

---

## `ui` — shared primitives & theming

The `ui` module is the design-system layer (≈600 files). Major categories:

| Category | Scope (approx file count) | Contents |
|----------|---------|----------|
| **layout** (~143) | Largest | dropdown, modal, overlay, page + page-header, tab-list, table, top-bar, resizable-panel, selectable-list, draggable-list, expandable-list, fullscreen, show-page, side-panel, contexts/constants/hooks |
| **utilities** (~115) | Cross-cutting | hotkey, focus, scroll, drag-select, responsive, state (Jotai helpers), page-title, page-favicon, pointer-event, loading-state, dimensions, debug |
| **input** (~80) | Form controls | text/number/select/etc inputs, relation-picker, effect-components, mention/slash menu constants |
| **navigation** (~52) | Nav chrome | drawer primitives, breadcrumb, step-bar, navigation-bar, menu-item (covered above) |
| **field** (~42) | Record fields | field input + field display renderers |
| **feedback** (~17) | Transient UI | snack-bar manager, dialog manager |
| **theme** (~5) | Theming | color-scheme system (below) |
| **suggestion** (~3) | AI/typeahead suggestion components |
| **drag-and-drop** / **display** | Small | dnd wrapper + a display component |

**Theming / token system** (`ui/theme` + `twenty-ui/theme-constants`): styling is **Linaria** zero-runtime
CSS-in-JS. Components read from a `themeCssVariables` object (e.g. `background.primary`,
`border.color.medium`, `boxShadow.strong`, `spacing[n]`, `font.family`) and a `ThemeContext`. The
**color scheme** is a three-way choice — `System` / `Dark` / `Light` (`useColorScheme`, persisted to the
workspace member's `colorScheme` and to a `persistedColorSchemeState` atom; `useSystemColorScheme` reads
the OS preference). Theme is applied via `BaseThemeProvider` and synced by `UserThemeProviderEffect`.
This is the upstream equivalent of our `.st-*` token / dark-mode system.

---

## Parity notes

How our SabCRM build maps to the upstream slice. Tags: **SIMPLE** (static/markup), **MEDIUM** (stateful, some wiring), **RUNTIME-HEAVY** (deep engine/registry/grid runtime).

| Area | Upstream feature | Our status | Complexity |
|------|------------------|------------|------------|
| App shell | Main drawer + settings drawer dispatch, workspace switcher | **BUILT** (sidebar + notifications bell + workspace context) | MEDIUM |
| Favorites | Favorites section in drawer | **BUILT** (favorites in sidebar) | MEDIUM |
| Nav menu items | Folders + record/view/object/link/page-layout kinds, dnd reorder, side-panel editor | **PARTIAL** (basic items + favorites; folder dnd & full edit side-panel not done) | RUNTIME-HEAVY |
| Command menu ⌘K | Search records + navigate + context actions + recent + favorites | **BUILT** (search + navigate + actions + recent + favorites) | RUNTIME-HEAVY |
| Command engine | Headless mount/unmount command registry, record CRUD/export/workflow commands | **PARTIAL** (actions wired directly, not via a headless command-context engine) | RUNTIME-HEAVY |
| Keyboard shortcuts | `Shortcut` model + General/Table tables + help overlay | **BUILT** (shortcuts overlay) | SIMPLE |
| Side panel | Stack-router hosting ~30 page ids, history, openers | **PARTIAL** (command menu surface built; not a generalized 30-page stack router) | RUNTIME-HEAVY |
| Search | `/`-triggered global record search, object-filtered | **BUILT** (search in command menu) | MEDIUM |
| Dashboards | Page-layout grid, tabs, draggable/resizable widgets | **BUILT** (saved dashboards with editable widgets) | RUNTIME-HEAVY |
| Chart widgets | Aggregate / Bar / Line / Pie + record-table/iframe/notes/etc. | **PARTIAL** (editable widgets; verify full chart-type + relational-widget coverage) | RUNTIME-HEAVY |
| Widget settings | Per-widget side-panel settings pages | **PARTIAL** (depends on widget editor depth) | MEDIUM |
| Analytics | `track` event mutation + `useEventTracker` | **MISSING** (no product-event telemetry pipe) | SIMPLE |
| Geo | Google Places address autocomplete | **MISSING / PARTIAL** — note: we built a **map view**; upstream `geo-map` is *autocomplete*, not a tile map, so this is a divergence, not a 1:1 port | MEDIUM |
| Information banners | Billing/reconnect/maintenance/impersonate/deleted-record | **PARTIAL** (some banners likely; full billing/impersonate set unverified) | SIMPLE |
| Support | Third-party support chat boot | **MISSING** (optional) | SIMPLE |
| Theme / tokens | 3-way System/Dark/Light, Linaria `themeCssVariables`, `ThemeContext` | **BUILT** (dark mode + `.st-*` token system) — our token transport differs (CSS vars vs Linaria objects) | MEDIUM |

**Key divergences to flag:**
- Upstream **command menu == side panel** (one fused surface); ours is a discrete ⌘K overlay. Functionally equivalent for search/nav/actions, but we don't get the side-panel's record/workflow/widget-settings page hosting for free.
- Our **map view** has no upstream counterpart — `geo-map` is address autocomplete. If we want true parity we'd add Places autocomplete to address fields; our map is net-new.
- The upstream **headless engine-command registry** is the main unbuilt depth: actions are modeled as mountable headless commands with a shared context API rather than direct handlers.
