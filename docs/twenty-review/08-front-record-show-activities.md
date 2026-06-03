# Twenty Front — Record Show Page, Page Layouts, Activities & Editors

Original structured catalog of the vendored Twenty CRM frontend
(`twenty-front/src/modules`). Descriptions are paraphrased; no source is
copied verbatim. This slice covers the record SHOW page, the page-layout
widget system, the activity types and their UIs, and the rich-text /
file-upload stack.

---

## 1. Record SHOW page architecture

The record show page is no longer a hardcoded layout — Twenty drives it
through a **configurable page-layout document** stored in metadata. The show
page is rendered by composing a page-layout (tabs → widgets) over a single
targeted record.

### Key modules / files

| Concern | Location |
| --- | --- |
| Show page glue | `object-record/record-show/components/` |
| Page renderer over a record | `record-show/components/PageLayoutRecordPageRenderer.tsx` |
| Record load effect | `record-show/components/RecordShowEffect.tsx` |
| SSE live-update subscription | `record-show/components/RecordShowPageSSESubscribeEffect.tsx` |
| Context-store targeting | `record-show/components/RecordShowContainerContextStoreTargetedRecordsEffect.tsx` |
| Editable record title | `record-show/components/ObjectRecordShowPageBreadcrumb.tsx` |
| Summary / identity card | `record-show/components/SummaryCard.tsx` |
| Page-layout renderer (shared) | `page-layout/components/PageLayoutRenderer.tsx` |

### Architecture summary

- A record show page binds a **PageLayout** (id, name, type, list of
  `PageLayoutTab`s) to the currently targeted record. The targeted record is
  pushed into the **context store** so every widget reads the same record id.
- **Tabs**: the layout has one or more `PageLayoutTab`s. Each tab carries a
  list of `PageLayoutWidget`s plus a per-tab **layout mode** (see §2). The tab
  list is rendered by `PageLayoutTabList*` components and is itself
  reorderable / overflow-aware (visible tabs + "more" dropdown).
- **Widgets** are the unit of content. Each widget has a `type` (the
  `WidgetType` enum, §2), a `configuration` blob (typed per widget kind), a
  grid/list **position**, and a title. Widgets are rendered through a single
  dispatch component (`WidgetContentRenderer`) that switches on `widget.type`.
- **Record-page vs dashboard vs canvas**: the same widget engine serves
  record pages, dashboards, and standalone canvases. `WidgetCardVariant`
  (`canvas | side-column | dashboard | standalone | record-page`) controls
  the card chrome. On a record page, widgets render inside `WidgetCardShell`.
- **Default layouts**: per object type there are seeded default layouts under
  `page-layout/constants/Default*RecordPageLayout.ts` (Person, Company,
  Opportunity, Note, Task, plus Workflow / WorkflowVersion / WorkflowRun).
  These define which widgets appear and where for an out-of-the-box object.
- **Access gating**: widgets can be forbidden (object/field perms) — rendered
  via `PageLayoutWidgetForbiddenDisplay`; invalid config →
  `PageLayoutWidgetInvalidConfigDisplay`; empty → `PageLayoutWidgetNoDataDisplay`.
- **Live updates**: the SSE subscribe effect keeps the shown record in sync
  with server-pushed DB events; an editable breadcrumb commits title edits via
  an update-one-record mutation.

### Page-layout tabs & sections (`PageLayoutTab`)

- `PageLayoutTab` = `{ id, title, position, widgets[] }` plus a layout-mode
  context. Tab management lives entirely in `page-layout/components/`:
  reorderable tabs, droppable "more" button, new-tab dropdown, render-clone
  for drag preview, and a tab-list effect that syncs the active tab.
- A single tab renders through `PageLayoutContent`, which branches on the
  tab's layout mode:
  - **CANVAS** → `PageLayoutCanvasViewer` / `PageLayoutGridLayout`
    (react-grid-layout: draggable, resizable, x/y/w/h grid positions, drag
    selector, resize handles, grid overlay).
  - **VERTICAL_LIST** → `PageLayoutVerticalListViewer` / `…Editor`
    (stacked single-column; supports a `side-column` variant that strips
    padding for the right rail of a record page).
- "Sections" on the record page are effectively the vertical-list grouping of
  widgets; in **edit mode** an `RecordPageAddWidgetSection` trailing element
  lets the user append widgets.

---

## 2. Page-layout WIDGET types (complete)

Source of truth: `WidgetType` enum (server enum + generated GraphQL). Renderer
dispatch: `page-layout/widgets/components/WidgetContentRenderer.tsx`.
Each widget kind has its own folder under `page-layout/widgets/`.

| `WidgetType` | Renderer component | Folder | What it shows / configures |
| --- | --- | --- | --- |
| `VIEW` | (record-table backed view) | `record-table/` | A saved view rendered as a table widget (view-id config). |
| `RECORD_TABLE` | `RecordTableWidgetRenderer` | `record-table/` | Embedded record table (object + view + filters); reuses the main record-table engine inside a card. |
| `FIELD` | `FieldWidget` | `field/` | A single record field rendered as a card (one `fieldMetadataId`). |
| `FIELDS` | `FieldsWidget` | `fields/` | A grouped block of record fields — the classic "details" panel. Config = ordered field items grouped into sections (`FieldsConfigurationGroup`). |
| `FIELD_RICH_TEXT` | `FieldRichTextWidgetRenderer` | `field-rich-text/` | A rich-text **record field** (BlockNote) shown as a widget. |
| `STANDALONE_RICH_TEXT` | `StandaloneRichTextWidgetRenderer` | `standalone-rich-text/` | A free-floating rich-text note attached to the layout (not a record field) — its body is stored in the widget config. |
| `GRAPH` | `GraphWidgetRenderer` | `graph/` | Data-viz widget. Sub-charts: **bar**, **line**, **pie**, **aggregate/number** (see §2.1). Config selects object, field, aggregate op, group-by, order-by. |
| `IFRAME` | `IframeWidget` | `iframe/` | Embeds an external URL in an iframe (config = url; default created by `createDefaultIframeWidget`). |
| `FRONT_COMPONENT` | `FrontComponentWidgetRenderer` | `front-component/` | Renders a named first-party front-end component (extension/app surface) by key. |
| `TIMELINE` | `TimelineWidget` | `timeline/` | The activity timeline feed for the record (see §3.1). |
| `TASKS` | `TaskWidget` | `tasks/` | Tasks panel for the record (see §3.2). |
| `NOTES` | `NoteWidget` | `notes/` | Notes panel for the record (see §3.3). |
| `FILES` | `FileWidget` | `files/` | Attachments / files panel for the record (see §3.6). |
| `EMAILS` | `EmailWidget` | `emails/` | Email messages associated with the record (thread list). |
| `EMAIL_THREAD` | `EmailThreadWidget` | `email-thread/` | A single expanded email thread view. |
| `CALENDAR` | `CalendarWidget` | `calendar/` | Calendar events linked to the record (see §3.5). |
| `WORKFLOW` | `WorkflowWidget` | `workflow/` | Workflow object's visual diagram. |
| `WORKFLOW_VERSION` | `WorkflowVersionWidget` | `workflow/` | A specific workflow version's diagram. |
| `WORKFLOW_RUN` | `WorkflowRunWidget` | `workflow/` | A workflow run's execution view. |

Supporting render states (not widget types): `WidgetSkeletonLoader`,
`PageLayoutWidgetForbiddenDisplay`, `PageLayoutWidgetInvalidConfigDisplay`,
`PageLayoutWidgetNoDataDisplay`, `DashboardWidgetPlaceholder`,
`StandaloneWidgetPlaceholder`. Widget actions (`edit`, `see-all`) are rendered
by `WidgetActionRenderer` / `WidgetActionField*`.

### 2.1 Graph widget sub-charts

| Sub-chart folder | Chart | Notes |
| --- | --- | --- |
| `graph-widget-bar-chart/` | Bar chart | full hooks/states/constants/utils set |
| `graph-widget-line-chart/` | Line chart | trend over a grouping dimension |
| `graph-widget-pie-chart/` | Pie chart | category breakdown |
| `graph-widget-aggregate-chart/` | Number / aggregate | single-value KPI (count/sum/avg/min/max) |

Shared chart plumbing lives in `graph/chart-core/`, `graph/components/`,
`graph/graphql/`, `graph/states/`. Config type `GraphWidgetFieldSelection`
chooses the object + field(s); `GraphOrderBy` controls ordering.

---

## 3. Activity types & their UIs (`activities/`)

Activities are the record-attached, time-ordered content: timeline events,
tasks, notes, emails, calendar events, and files. The page-layout widgets in
§2 (`TIMELINE`, `TASKS`, `NOTES`, `EMAILS`, `CALENDAR`, `FILES`) are thin
wrappers that mount these activity card components.

### 3.1 Timeline feed (`activities/timeline-activities/`)

The timeline is a chronological feed of heterogeneous **events** grouped by
time. Rendering pipeline: `TimelineCard` → `EventList` → `EventsGroup` →
`EventRow` → `EventRowDynamicComponent`, which **dispatches on the linked
object** (`linkedObjectMetadataItem.nameSingular`) to a specialized row:

| Event kind | Row component | UI |
| --- | --- | --- |
| Record field change | `EventRowMainObject` / `…Updated` | Field diff: label + before/after value (`EventFieldDiff*`). |
| Activity (note/task) | `EventRowActivity` | Reference to a created note/task. |
| Calendar event | `EventRowCalendarEvent` (+ `EventCardCalendarEvent`) | Inline calendar-event summary, expandable card. |
| Message / email | `EventRowMessage` (+ `EventCardMessage`) | Email summary; body may be "not shared" (`EventCardMessageBodyNotShared`) or "forbidden" (`EventCardMessageForbidden`). |

Each row uses `EventRowItem` for the timeline rail (icon via
`EventIconDynamicComponent`, actor avatar, relative time) and an optional
`EventCardToggleButton` to expand a rich `EventCard`.

### 3.2 Tasks panel (`activities/tasks/`)

| File | Role |
| --- | --- |
| `TasksCard.tsx` | Panel container mounted by the TASKS widget. |
| `TaskGroups.tsx` | Buckets tasks (e.g. To-do / Done, by due date). |
| `TaskList.tsx` / `TaskRow.tsx` | Rows: checkbox/status, title, due date, assignee. |
| `AddTaskButton.tsx` | Creates a new task linked to the record. |

### 3.3 Notes panel (`activities/notes/`)

| File | Role |
| --- | --- |
| `NotesCard.tsx` | Panel container for the NOTES widget. |
| `NoteList.tsx` | List of note tiles. |
| `NoteTile.tsx` | Per-note preview: title + body excerpt; opens the BlockNote editor. |

### 3.4 Emails (`activities/emails/`)

A full email surface, not just a list:

| File | Role |
| --- | --- |
| `EmailsCard.tsx` | Thread list for the record (EMAILS widget). |
| `EmailThreadHeader.tsx` | Thread subject + participants. |
| `EmailThreadMessage.tsx` | One message: sender, receivers, body. |
| `EmailThreadMessageBody.tsx` | Rendered message body (HTML). |
| `EmailThreadMessageSender` / `…Receivers` | Participant rows w/ `MessageParticipantRole`. |
| `EmailThreadBottomBar.tsx` | Reply / actions bar. |
| `ComposeEmailButton.tsx` / `EmailComposer.tsx` | Compose flow: `EmailComposerFields`, `EmailAttachmentsField`. |
| `EmailLoader.tsx` | Loading state. |

Visibility respects `MessageChannelVisibility` (body can be hidden when the
channel isn't shared with the viewer).

### 3.5 Calendar events (`activities/calendar/`)

| File | Role |
| --- | --- |
| `CalendarEventsCard.tsx` | Event list for the record (CALENDAR widget). |
| `CalendarEventRow.tsx` / `CalendarDayCardContent.tsx` | Day-grouped event rows. |
| `CalendarEventDetails.tsx` (+ Effect) | Expanded event details. |
| `CalendarEventParticipants*` | Attendee avatars + RSVP/response status (`CalendarEventParticipantsResponseStatus*`). |
| `CalendarEventNotSharedContent.tsx` | Privacy fallback when the event isn't shared. |

### 3.6 Files / attachments (`activities/files/`)

| File | Role |
| --- | --- |
| `FilesCard.tsx` | Attachments panel for the FILES widget. |
| `AttachmentList.tsx` / `AttachmentRow.tsx` | List of attachments w/ icon, name, actions. |
| `AttachmentDropdown.tsx` | Per-file actions (download/delete/rename). |
| `DropZone.tsx` | Drag-and-drop upload target. |
| `DocumentViewer.tsx` | Inline preview of a file. |

File icons/sizing come from the shared `file/` module (`FileIcon`,
`AttachmentChip`, `formatFileSize`, `fileIconMappings`, category colors).

---

## 4. Rich-text editors

Twenty ships **two** editors with different roles:

### 4.1 BlockNote editor (`blocknote-editor/`) — record bodies / notes

Block-based editor (built on `@blocknote/core` + `@blocknote/react`) used for
note bodies and rich-text fields. Schema is assembled in `blocks/Schema.ts`:
default block specs **plus** a custom `file` block, and default inline-content
specs **plus** a custom `mention` inline content.

#### Block types

| Block | Source | Notes |
| --- | --- | --- |
| Paragraph | default | base text block |
| Heading 1–6 | default | incl. **Toggle Heading 1–3** (collapsible) |
| Bullet List | default | unordered list |
| Numbered List | default | ordered list |
| Check List | default | task/checkbox list |
| Toggle List | default | collapsible list |
| Quote | default | blockquote |
| Code Block | default | monospace code |
| Divider | default | horizontal rule |
| Table | default | data table |
| Image | default | image embed |
| Video | default | video embed |
| Audio | default | audio embed |
| Emoji | default | emoji picker entry |
| **File** | `blocks/FileBlock.tsx` (custom) | Custom block: upload via `editor.uploadFile`, stores `{ url, name, fileCategory }`; renders a `FileIcon` + link, or an upload dropzone when empty. **Replaces** the default BlockNote File block (filtered out of the slash menu). |

#### Inline content

| Inline | Source | Notes |
| --- | --- | --- |
| (default marks) | default | bold/italic/underline/strike/code/link |
| **Mention** | `blocks/MentionInlineContent.tsx` (custom) | Stores `{ recordId, objectMetadataId, objectNameSingular, label, imageUrl }`; renders a `MentionRecordChip` (avatar + label) that links to the record. Backward-compatible with older mentions lacking denormalized fields. |

#### Slash menu (`utils/getSlashMenu.ts`)

Wraps `getDefaultReactSlashMenuItems` (Heading 1–6, Toggle headings, lists,
quote, code, divider, table, image/video/audio, emoji, paragraph) and
re-skins each with twenty-ui icons. The default **File** item is removed and a
**custom File item** is appended that inserts the custom `file` block.
Slash-menu open state is tracked in `states/isSlashMenuOpenComponentState.ts`;
selection sync via `CustomSlashMenuSelectedIndexSyncEffect`. Custom UI:
`CustomSlashMenu`, `CustomSlashMenuListItem`, `CustomAddBlockItem`,
`CustomSideMenu`/`CustomSideMenuOptions`, `CustomMentionMenu`.

Other BlockNote utilities: `parseInitialBlocknote`,
`prepareBodyWithSignedUrls` (swaps stored file keys for signed URLs),
`useAttachmentSync`, `useReplaceBlockEditorContent`,
`getFirstNonEmptyLineOfRichText` (derives a title from body).

### 4.2 Advanced text editor (`advanced-text-editor/`) — workflow/email bodies

A **TipTap/ProseMirror-based** editor (distinct from BlockNote) used for
workflow email bodies. Key parts:

- `components/AdvancedTextEditor.tsx` — editor shell.
- **Bubble menus**: `TextBubbleMenu` (inline formatting via
  `BubbleMenuIconButton`), `LinkBubbleMenu` + `EditLinkPopover`,
  `ImageBubbleMenu`, `TurnIntoBlockDropdown` (paragraph/heading/list
  conversions via `useTurnIntoBlockOptions`).
- **Slash command extension** (`extensions/slash-command/`): `SlashCommand.ts`
  + `SlashCommandMenu.tsx`, with `DefaultSlashCommands.ts` (paragraph,
  headings, bullet list, numbered list, quote, code, image, etc.).
- **Resizable image extension** (`extensions/resizable-image/`):
  `ResizableImage`, `ResizableImageView`, drag-resize + upload-image plugin
  (`UploadImagePlugin`, `UploadImageExtension`).
- Attachments: `WorkflowSendEmailAttachments` + `useUploadWorkflowFile`,
  bounded by `maxAttachmentSize`.

### 4.3 Mention module (`mention/`)

Shared @-mention machinery used by the editors:

- `extensions/MentionSuggestion.ts` + `MentionTag.ts` — ProseMirror suggestion
  plugin (trigger `@`) keyed by `MentionSuggestionPluginKey`.
- `components/MentionSuggestionMenu.tsx` + `MentionMenuListItem.tsx` — the
  searchable record picker dropdown.
- `components/MentionChip.tsx` / `MentionRecordChip.tsx` — the inserted chip
  (avatar + label, links to the record).
- `hooks/useMentionMenu.ts`, types `MentionSearchResult`,
  `MentionSuggestionMenuProps`.

### 4.4 File upload & file modules

- `file-upload/` — `FileUploadProvider` + `FileUploadContext` +
  `useFileUpload` hook: the shared upload pipeline editors and panels call.
- `file/` — presentation + helpers: `FileIcon`, `AttachmentChip`,
  `formatFileSize`, `fileIconMappings`, category/icon colors, and upload
  mutations (`uploadFilesFieldFile`, `uploadWorkflowFile`,
  `uploadEmailAttachmentFile`).

---

## Parity notes

Comparison of the SabCRM record experience we already built vs Twenty's
vendored frontend. Tags: **SIMPLE** (small port), **MEDIUM** (moderate),
**RUNTIME-HEAVY** (needs server/runtime, third-party libs, or live channels).

### Built (have parity or close)

| Area | Status |
| --- | --- |
| Record page with **Fields / Notes / Tasks / Activity** tabs | Built — covers Twenty's FIELDS + NOTES + TASKS + TIMELINE widgets as fixed tabs. |
| **Relations** on the record | Built — equivalent to Twenty's relation fields in the FIELDS panel. |
| **Timeline** feed | Built — maps to Twenty's `TIMELINE` widget / `timeline-activities` (event rows). |
| **Composer** for activities | Built — analogous to note/task creation + Twenty's email composer (text portion). |
| **Attachments** panel | Built — maps to `FILES` widget / `activities/files` (list + drop-zone). |
| **Comments** | Built — covers the comment/activity-reply surface. |
| **Collapsible sections** | Built — equivalent to Twenty's vertical-list grouping. |
| Dependency-free **rich-text editor** | Built — replaces BlockNote's heavy `@blocknote/*` dependency for basic bodies. |
| **Templates in composer** | Built — SabCRM-specific, no direct Twenty analog. |
| **Print** | Built — SabCRM-specific, no direct Twenty analog. |

### Gaps (not yet built)

| Gap | Tag | Why |
| --- | --- | --- |
| **Configurable widget layout** (drag/resize grid, tabs as data, per-object default layouts, add/remove widgets) | **RUNTIME-HEAVY** | Twenty's whole page-layout engine: `WidgetType` enum, grid (react-grid-layout) + vertical-list modes, `PageLayoutTab`s persisted in metadata, edit-mode reorder/resize, seeded default layouts per object. Requires a layout metadata model + editor + server persistence. |
| **BlockNote slash/block editor** (block types, slash menu, toggle headings, tables, media blocks, @mentions inline) | **RUNTIME-HEAVY** | Our editor is dependency-free and lacks BlockNote's block schema, slash menu, custom file block, and mention inline-content. Full parity means adopting `@blocknote/*` (heavy dep) or rebuilding the block model + slash UI + mention suggestion plugin. |
| **Email widget / thread view** (`EMAILS`, `EMAIL_THREAD`) | **RUNTIME-HEAVY** | Needs message-channel sync, participant/visibility model, thread rendering, and a compose+send pipeline — depends on a mail backend, not just UI. |
| **Calendar widget** (`CALENDAR`) | **RUNTIME-HEAVY** | Needs calendar-event sync, participants + RSVP status, sharing/visibility — backend-dependent. |
| **Graph widgets** (bar/line/pie/aggregate) | **MEDIUM** | Pure-frontend charting over record data; achievable with a chart lib + aggregate queries, no live channel required. |
| **Iframe / Front-component / Workflow widgets** | **MEDIUM** | Iframe is **SIMPLE**; front-component needs an extension surface; workflow widgets depend on the workflow engine (**RUNTIME-HEAVY**). |
| **Advanced text editor** (TipTap bubble menus, resizable image, workflow email body) | **MEDIUM** | Needed only if we add workflow email composition; otherwise lower priority. |
| **Mention `@record` picker** in composer/notes | **MEDIUM** | Searchable record-mention dropdown + linked chips; frontend-heavy but no live channel. |
