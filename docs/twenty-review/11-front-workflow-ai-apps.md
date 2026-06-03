# Twenty Front — Workflow Builder, AI, Apps, Accounts & Import (Original Catalog)

Read-only structural review of the vendored Twenty CRM frontend
(`services/sabcrm/packages/twenty-front/src/modules`). This is an original,
paraphrased catalog of behaviour and UX — no source code is reproduced verbatim.

Slice covered: `workflow` (+ `workflow-diagram`, `workflow-nodes`,
`workflow-edges`, `workflow-trigger`, `workflow-steps`, `workflow-actions`,
`workflow-variables`, `workflow-version`), `ai` (+ `suggested-prompts`),
`logic-functions`, `applications`, `marketplace`, `accounts`,
`spreadsheet-import`, `file-upload`, `front-components`.

---

## 1. Visual Workflow Builder — Canvas

Twenty's automation builder is a **node-based directed-graph canvas**, not a
linear list. The rendering engine is **React Flow (`@xyflow/react`)**, with a
dotted `Background` grid (medium border colour, dot size 2). There is no
visible MiniMap/Controls cluster — navigation is pan/zoom + fit-view.

There are three canvas variants layered over one shared base
(`WorkflowDiagramCanvasBase`):

| Canvas variant | Purpose | Interactivity |
| --- | --- | --- |
| `WorkflowDiagramCanvasEditable` | Authoring a draft version | nodes draggable + connectable, edges reconnectable/deletable, right-click command menu, pane context menu |
| `WorkflowDiagramCanvasReadonly` | Viewing a published/locked version | static, no drag/connect |
| `WorkflowRunDiagramCanvas` | Visualising a single past/live run | static, per-node run status overlay |

The base canvas owns all the React Flow plumbing: applies node/edge changes
(`applyNodeChanges` / `applyEdgeChanges`), validates new connections
(`onConnect` → `assertWorkflowConnectionOrThrow`), guards deletes
(`OnBeforeDelete`), handles node drag-stop persistence, and a custom
connection-line component (`WorkflowDiagramConnection`). It wires into the
**side panel** width state so the canvas re-fits when the step editor panel
opens/closes. It also injects custom SVG arrowhead markers for branch edges
(`WorkflowDiagramCustomMarkers`, `EDGE_BRANCH_ARROW_MARKER`).

**Diagram generation / layout.** The graph is computed from the persisted
workflow version (a trigger + flat steps with parent/child links), not stored
as raw coordinates. Utilities: `generateWorkflowDiagram` (version → nodes +
edges), `generateWorkflowRunDiagram` (run → same, plus status), `getOrganizedDiagram`
/ `getWorkflowVersionDiagram` (auto-layout / organise into the
top-to-bottom flow). Auto-layout means the user does not manually place nodes
in the common case — dragging adjusts, but the canonical layout is derived.

### 1.1 Node types

React Flow `nodeTypes` registry (editable canvas):

| React Flow key | Component | Role |
| --- | --- | --- |
| `default` | `WorkflowDiagramStepNodeEditable` | A trigger or action step card |
| `empty` | `WorkflowDiagramStepNodeEditable` | Placeholder/empty step slot |
| `empty-trigger` | `WorkflowDiagramEmptyTriggerEditable` | "Add a trigger" starter node when no trigger is set yet |

`WorkflowDiagramNodeType = 'default' | 'empty-trigger' | 'empty'`.

The step-node card UX (`WorkflowDiagramStepNodeEditableContent`,
`WorkflowNodeContainer`, `WorkflowNodeLabel`, `WorkflowNodeTitle`,
`WorkflowNodeRightPart`, `WorkflowDiagramStepNodeIcon`):

- An **icon container** (`WorkflowNodeIconContainer`) with a per-type tinted
  icon (`WorkflowDiagramStepNodeIcon`), a **title** (step name) and **label**
  (the action/trigger type description).
- A **target handle** on top (`WorkflowDiagramHandleTarget`,
  `WorkflowDiagramNodeDefaultTargetHandleId`) and a **source handle** on bottom
  (`WorkflowDiagramHandleSource`, `WorkflowDiagramNodeDefaultSourceHandleId`) so
  edges connect downward. Iterator nodes get an **extra loop handle**
  (`WorkflowDiagramIteratorNodeLoopHandleId`) for the per-item sub-flow.
- A connection-state hook (`useConnectionState`) highlights valid drop targets
  while dragging a new edge; `isNodeTitleHighlighted` highlights matching nodes.
- Iterator nodes display an **iteration counter** in the run view
  (`WorkflowNodeLabelWithCounterPart`, `getNodeIterationCount`).
- The **run** variant (`WorkflowRunDiagramStepNode`) overlays per-step run
  status (success/failure/pending/running).
- Selecting a node opens that step's editor in the side panel
  (`workflowSelectedNodeComponentState`).

### 1.2 Edge types & the "insert step" UX

React Flow `edgeTypes` (editable): `blank` (`WorkflowDiagramBlankEdge`) and
`editable` (`WorkflowDiagramDefaultEdgeEditable`); readonly canvas uses a
`readonly` variant (`WorkflowDiagramDefaultEdgeReadonly`). Edge type union:
`'blank' | 'editable' | 'readonly'`.

| Edge concept | Component | Behaviour |
| --- | --- | --- |
| Default editable edge | `WorkflowDiagramDefaultEdgeEditable` | Smooth path between two steps; hover reveals a mid-edge button group |
| Edge button group | `WorkflowDiagramEdgeButtonGroup` | Hover/active controls to **insert a step on this edge** and to **delete** the connection |
| Edge label | `WorkflowDiagramEdgeLabel` / `WorkflowDiagramEdgeLabelContainer` | Labels branch edges (e.g. If/Else "True"/"False", iterator "Loop") |
| Blank edge | `WorkflowDiagramBlankEdge` | Dangling/empty connector (e.g. open branch end) |
| Connection (drag) line | `WorkflowDiagramConnection` | Live line shown while the user drags from a handle |
| V2 container / visibility | `WorkflowDiagramEdgeV2Container`, `WorkflowDiagramEdgeV2VisibilityContainer` | Wrap edges to manage hover/selection visibility and z-order |

Edge interactivity is backed by `useEdgeState`, with hover/selection in
`workflowHoveredEdgeComponentState` / `workflowSelectedEdgeComponentState`.
Branch routing depends on the **source handle** — `getConnectionOptionsForSourceHandle`
and `WorkflowStepConnectionOptions` decide what may attach to a default handle
vs an If/Else branch handle vs an iterator loop handle. `getEdgePath` computes
the bezier/step path geometry.

**Adding a step** is the central authoring gesture. The "+" affordance lives
**on the edge between two nodes** (or on the trigger's source handle):
`useStartNodeCreation` / `StartNodeCreationParams` plus the create-step element
(`WorkflowDiagramCreateStepElement`) open a step-type picker so the new step is
inserted into the flow at that exact position. `workflowInsertStepIdsComponentState`
remembers the insertion anchor; `useResetWorkflowInsertStepIds` clears it.

### 1.3 Canvas chrome & menus

- **Right-click command menu** (`WorkflowDiagramRightClickCommandMenu` +
  `...ClickOutsideEffect`) — a contextual menu opened on pane/node right-click,
  driven through the shared command-menu context.
- **Status tag** — the canvas shows a coloured status tag (Draft / Active /
  Deactivated) wired via `tagColor` / `tagText`.
- **Effects** — a family of effect components keep canvas state in sync:
  `WorkflowDiagramEffect`, `WorkflowDiagramCanvasEditableEffect`,
  `WorkflowVisualizerEffect`, `WorkflowVersionVisualizerEffect`,
  `WorkflowRunVisualizerEffect`, and SSE subscribers
  (`WorkflowSSESubscribeEffect`, `WorkflowRunSSESubscribeEffect`,
  `WorkflowRunVisualizer`) that stream live run progress onto the canvas.
- **Cards** — `WorkflowCard`, `WorkflowVersionCard`, `WorkflowRunCard` are the
  record-page summary cards that embed a read-only diagram preview and deep-link
  into the full visualizer (`WorkflowVisualizer`, `WorkflowVersionVisualizer`,
  `WorkflowRunVisualizer`).

---

## 2. Trigger Configuration UI

A workflow has exactly one trigger. Trigger definitions live under
`workflow-trigger/constants/triggers/`:

| Trigger | Constant | Config form | Key settings |
| --- | --- | --- | --- |
| Record Created | `RecordIsCreatedTrigger` | `WorkflowEditTriggerDatabaseEventForm` | object to watch |
| Record Updated | `RecordIsUpdatedTrigger` | same | object + (optionally) watched fields |
| Record Deleted | `RecordIsDeletedTrigger` | same | object |
| Record Upserted | `RecordUpsertedTrigger` | same | object |
| Manual | `ManualTrigger` | `WorkflowEditTriggerManual` | availability (which record views / global), is-pinned, icon |
| Webhook | `WebhookTrigger` | `WorkflowEditTriggerWebhookForm` | HTTP method, authentication mode, generated URL + sample payload |
| Cron / Schedule | `CronTrigger` | `WorkflowEditTriggerCronForm` | interval type, cron expression with live human description |

Supporting constants: `DatabaseTriggerTypes`, `OtherTriggerTypes`,
`WebhookTriggerHttpMethodOptions`, `WebhookTriggerAuthenticationOptions`,
`CronTriggerIntervalOptions`, `ManualTriggerAvailability(Type)Options`,
`ManualTriggerIsPinnedOptions`, `DatabaseTriggerDefaultLabel`,
`CommandMenuDefaultIcon`.

**Cron UX is notably rich.** The cron form ships a from-scratch
**cron-to-human description engine** (`cron-to-human/`): `parseCronExpression`,
field validators, and per-field descriptors (minutes/hours/day-of-month/
month/day-of-week) compose into `describeCronExpression`, which renders a plain
English summary ("Every day at 9:00 AM") below the expression. There is a
`CronExpressionHelper` (lazily loaded via `CronExpressionHelperLazy`) and
`getTriggerScheduleDescription` for the node label. `convertScheduleToCronExpression`
supports a simpler interval picker that emits a valid cron string, and
`calculateNextExecutionsForMinuteInterval` previews upcoming run times.

Trigger helpers: `getTriggerDefaultDefinition`, `getTriggerDefaultLabel`,
`getTriggerDefaultSettings` per type, `getTriggerIcon` / `getTriggerIconColor`,
`getTriggerHeaderType`, `getTestPayloadFromTrigger` (sample event for testing),
`getRootStepIds`, and `useUpdateWorkflowVersionTrigger` (persistence). All have
unit tests.

---

## 3. Step / Action Editor UI

Selecting a node opens a **side panel** step editor. Shared scaffolding lives
in `workflow-steps/components/`: `WorkflowStepDetail` (the panel),
`WorkflowStepBody`, `WorkflowStepFooter`, `WorkflowStepCmdEnterButton`
(⌘-Enter to save/run), the **step-type picker**
(`SidePanelWorkflowSelectStepContainer` / `...Title`), and the run-inspection
panels (`WorkflowRunStepNodeDetail`, `WorkflowRunStepInputDetail`,
`WorkflowRunStepOutputDetail`, `WorkflowRunStepJsonContainer`,
`WorkflowDropdownStepOutputItems`) that show a finished step's input/output JSON.

### 3.1 Action catalogue & their config forms

Action types are grouped into five palette categories
(`workflow-steps/workflow-actions/constants/`): **RecordActions**,
**CoreActions**, **HumanInputActions**, **AiActions**, **FlowActions**.
`WorkflowActionType` union:
`CREATE_RECORD | UPDATE_RECORD | DELETE_RECORD | UPSERT_RECORD | FIND_RECORDS |
CODE | SEND_EMAIL | HTTP_REQUEST | FORM | AI_AGENT | ITERATOR | FILTER |
IF_ELSE | DELAY | LOGIC_FUNCTION` (+ internal `EMPTY`).

| Category | Action (type) | Editor component(s) | Config UI summary |
| --- | --- | --- | --- |
| Record | Create Record (`CREATE_RECORD`) | `WorkflowEditActionCreateRecord` | pick object, then a dynamic field-input form (`WorkflowFormFieldInput`) per field, values supporting variables |
| Record | Update Record (`UPDATE_RECORD`) | `WorkflowEditActionUpdateRecord` | object + record-to-update (variable) + fields to set |
| Record | Delete Record (`DELETE_RECORD`) | `WorkflowEditActionDeleteRecord` | object + record id (variable) |
| Record | Upsert Record (`UPSERT_RECORD`) | `WorkflowEditActionUpsertRecord` | object + match/insert fields |
| Record | Find Records (`FIND_RECORDS`) | `WorkflowEditActionFindRecords` (+ `WorkflowFindRecordsFilters`/`...Effect`, `WorkflowFindRecordsSorts`, `WorkflowObjectDropdownContent`) | object picker, structured filter builder, sort list, limit; outputs an array schema |
| Core | Send Email (`SEND_EMAIL`) | `WorkflowEditActionEmailBase` | connected-account sender, to/subject/body, variable-aware |
| Core | Code (`CODE`) | `WorkflowEditActionCode` (+ `WorkflowEditActionCodeFields`, `WorkflowCodeEditor`, `WorkflowActionCode`, `WorkflowReadonlyActionCode`) | Monaco code editor (see §4), test-run, output schema |
| Core | HTTP Request (`HTTP_REQUEST`) | `WorkflowEditActionHttpRequest` (+ `BodyInput`, `KeyValuePairInput`, `HttpRequestTestVariableInput`, `HttpRequestExecutionResult`) | method, URL, headers/query as key-value rows, body editor, test panel showing live response |
| Human input | Form (`FORM`) | `WorkflowEditActionFormBuilder` (+ `...FormFieldSettings`, per-type settings: Text/Number/Date/Select/RecordPicker; `WorkflowEditActionFormFiller`) | drag-to-build form, per-field type + settings; "filler" renders the live form when the run pauses for human input |
| AI | AI Agent (`AI_AGENT`) | `WorkflowEditActionAiAgent` (+ prompt tab, permissions tabs, `WorkflowOutputSchemaBuilder`, `WorkflowOutputFieldTypeSelector`) | prompt editor, model, an **agent permissions matrix** (per-object CRUD + feature flags), and a builder for the structured output schema |
| Flow | Filter (`FILTER`) | `WorkflowEditActionFilter` / `...FilterBody` | predicate that stops the flow unless conditions pass; reuses the filter sub-module |
| Flow | If / Else (`IF_ELSE`) | `WorkflowEditActionIfElse` / `...IfElseBody`, `WorkflowIfElseBranchEditor` | branch condition editor; produces two labelled edges (true/false) on the canvas |
| Flow | Iterator (`ITERATOR`) | `WorkflowEditActionIterator`, `WorkflowIteratorSubStepSwitcher` | pick an array variable to loop; exposes a **loop handle / sub-flow** on the node (`useStartIteratorFirstNodeCreation`) |
| Flow | Delay (`DELAY`) | `WorkflowEditActionDelay` | wait a duration / until a time before continuing |
| Custom | Logic Function (`LOGIC_FUNCTION`) | `WorkflowEditActionLogicFunction` | run an installed serverless/logic function with mapped inputs |

The **Filter** sub-module (`workflow-steps/filters/`) is a self-contained
condition builder (types/utils/components/hooks/states) shared by both the
Filter action and the If/Else branch editor — field + operator + value rows,
where values may be variables.

`workflow-steps/workflow-actions/hooks/` + `utils/` hold the persistence and
default-settings logic shared across all action editors.

---

## 4. Logic Functions — Code Editor

Two surfaces: the **inline Code action editor** and the standalone
**logic-functions** module (`modules/logic-functions/`).

- **Editor.** `WorkflowCodeEditor` wraps `@monaco-editor/react` (Monaco) via
  Twenty's `CodeEditor` from `twenty-ui/input`, themed with
  `themeCssVariables`. Minimum height ~343px, a maximize (`IconMaximize`)
  button for a fullscreen editing modal. It validates the exported handler with
  Monaco markers (`getWrongExportedFunctionMarkers`) so the user sees an inline
  error if the required function isn't exported correctly.
- **Module hooks.** `useLogicFunctionForm` / `useLogicFunctionUpdateFormState`
  (form state), `useGetLogicFunctionSourceCode`, `useGetOneLogicFunction`,
  `usePersistLogicFunction` (save), `useGetAvailablePackages` (npm packages the
  sandbox allows), `useExecuteLogicFunction` (test-run).
- **Test/output components.** `LogicFunctionExecutionResult` (run result),
  `LogicFunctionLogs` (console/log stream), `LogicFunctionTestInputInitEffect`
  (seeds test inputs from the inferred input schema).

---

## 5. Workflow Variables — Picker & Type Inference

A first-class system for referencing the output of upstream steps inside any
field of a downstream step.

- **Picker UI.** `WorkflowVariablePicker` opens `WorkflowVariablesDropdown`
  (searchable), organised by source step (`WorkflowVariablesDropdownSteps` →
  `...DropdownStepItems`). Selecting a leaf inserts a variable token.
- **Inline tokens.** In rich text fields, variables render as chips:
  `WorkflowTextEditorVariableChip` (a resolved `{{step.field}}` reference, shows
  the human display name) vs `WorkflowTextEditorTextChip` (literal text).
- **Type inference / output schemas.** Each step type declares an **output
  schema** so the picker only offers fields that will actually exist. Schema
  types in `workflow-variables/types/`: `ManualTriggerOutputSchema`,
  `DatabaseEventTriggerOutputSchema`, `RecordActionOutputSchema`,
  `FindRecordsOutputSchema`, `FormOutputSchema`, `CodeOutputSchema`,
  `IteratorOutputSchema`, `LinkOutputSchema`, `RecordOutputSchemaV2`,
  `OpenStepOutputSchema`, `StepOutputSchemaV2`, with matching `guards/`.
- **Schema generation.** `computeStepOutputSchema` walks the trigger + all
  steps and produces the available-variable tree. Generators:
  `generateRecordOutputSchema`, `generateRecordEventOutputSchema`,
  `generateFindRecordsOutputSchema`, `generateFormOutputSchema`,
  `generateFakeValue`. Steps whose output is only known at runtime
  (AI_AGENT, CODE, HTTP_REQUEST, LOGIC_FUNCTION, WEBHOOK, ITERATOR) carry a
  **persisted output schema** rather than a statically derived one.

`workflow-version/` handles draft-vs-published versioning (graphql mutations +
hooks) that the canvas and editors persist against.

---

## 6. AI Chat Interface + Suggested Prompts

A full agent chat experience (`modules/ai/`), built around streaming agent
turns and a multi-thread sidebar.

**Chat surface.**
- `AiChatTab` + `AiChatTabMessageList` render the conversation;
  `AiChatMessage`, `AiChatAssistantMessageRenderer`,
  `AiChatLastMessageWithStreamingState`, `AiChatNonLastMessageIdsList` handle
  message rendering and streaming.
- Markdown via lazy renderer (`LazyMarkdownRenderer` +
  `LazyMarkdownRendererStyledComponents`); `RecordLink` turns record references
  into deep links.
- **Editor / composer.** `AiChatEditorSection` + `internal/SendMessageButton`,
  with file attachments (`AgentChatFileUploadButton`, `AgentChatFilePreview`,
  `useAiChatFileUpload`, `uploadAiChatFile`) and a context-usage indicator
  (`AiChatContextUsageButton`, `ContextUsageProgressRing` — a ring showing how
  much of the model context window is consumed). `useAiChatEditor`,
  `AiChatEditorFocusEffect`.
- **Agent reasoning visualisation.** `ThinkingStepsDisplay`,
  `ReasoningSummaryDisplay`, `ToolStepRenderer`, `CodeExecutionDisplay`,
  `TerminalOutput`, `RoutingStatusDisplay` / `RoutingDebugDisplay`,
  `ShimmeringText` (animated "thinking" text), `AiChatCompactionIndicator`
  (shows when older context is being compacted).
- **Threads.** `AiChatThreadsList` (+ `AiChatThreadGroup`,
  `AiChatThreadListItem`, `AiChatThreadItemMenu`), filter dropdown
  (`AiChatThreadFilterDropdown*` — group-by / last-activity / status menus),
  rename/delete (`AiChatThreadDeleteConfirmationModal`,
  `useRenameChatThread`, `useDeleteChatThread`, archive/unarchive hooks). Also
  surfaced in the navigation drawer (`NavigationDrawerAiChat*`).
- **States.** Empty state (`AiChatEmptyState`), API-key-not-configured,
  credits-exhausted / no-more-billing-credits banners, several error renderers
  (`AiChatErrorMessage/Renderer/UnderMessageList`, `AiChatStandaloneError`),
  queued messages (`AiChatQueuedMessages`), scroll-to-bottom button + several
  auto-scroll layout effects.

**Streaming pipeline.** `AgentChatProvider` / `...Content` provide context;
`useAgentChat`, `useAgentChatSubscription` (GraphQL subscription
`OnAgentChatEvent`), `useProcessStreamingMessageUpdate`,
`useUpdateStreamingPartsWithDiff` / `AgentChatStreamingPartsDiffSyncEffect`
(diff-based streaming so only changed parts re-render),
`useProcessUIToolCallMessage`. Thread lifecycle:
`useEnsureAgentChatThreadExistsForDraft`,
`useEnsureAgentChatThreadIdForSend`, `useCreateAgentChatThread`,
`useSwitchToNewAiChat`, optimistic unarchive-on-send. Model selection:
`useAgentChatModelId`, `useAiModelOptions`, `useWorkspaceAiModelAvailability`,
`SettingsAgentModelCapabilities`. Tools: `useGetToolIndex`, `getToolIndex`,
`getToolInputSchemas`.

**GraphQL.** Agents CRUD (`createOneAgent`/`updateOneAgent`/`deleteOneAgent`,
`findManyAgents`, `findOneAgent`, role assignment), skills CRUD
(`create/update/delete/activate/deactivate Skill`, `activateSkill`),
chat threads + messages (`sendChatMessage`, `stopAgentChatStream`,
`getChatMessages`, `getChatThreads`, queued-message delete), and an agent
evaluation harness (`evaluateAgentTurn`, `getAgentTurns`, `runEvaluationInput`).

**Suggested prompts** (`ai/components/suggested-prompts/`).
`AiChatSuggestedPrompts` renders a small set of starter cards shown on the empty
state. `DEFAULT_SUGGESTED_PROMPTS` defines each as `{ id, label, Icon,
prefillPrompts[] }` — e.g. "Create a dashboard", "Create a workflow", "Create a
record" — clicking a card prefills the composer with a concrete, CRM-flavoured
example prompt (i18n `MessageDescriptor`s).

---

## 7. Applications & Marketplace (browse / install apps)

**`applications/`** — display + identity for installed third-party apps.
`ApplicationDisplay`, `AppChip`, `AppMenuItem`, `AppConnectionHeader`,
`AuthorizeActionButtons` (OAuth-style authorize/deny). Hooks:
`useApplicationChipData`, `useApplicationAvatarColors`,
`useResolvedApplicationDescription`, `useIsThirdPartyApplication`. GraphQL:
`findManyApplications` / `findOneApplication` fragments + queries.

**`marketplace/`** — install/upgrade flow.
`useMarketplaceApps` (browse catalogue), `useInstallMarketplaceApp`,
`useInstallMarketplaceAppWithPermissionValidation` (gates install behind a
**permission-validation modal**, `SettingsApplicationInstallPermissionValidationModal`,
that lists what the app will be allowed to access before the user confirms),
`useUpgradeApplication`.

**`front-components/`** — apps can ship **custom embedded UI**. Twenty fetches an
app's front-end bundle and renders it sandboxed: `FrontComponentRenderer`,
`FrontComponentRendererWithSdkClient`, `FrontComponentRendererProvider`. The
app SDK client blob URLs are fetched (`fetchSdkClientBlobUrls`,
`getSdkClientUrls`, `getFrontComponentUrl`, `SdkClientBlobUrlsEffect`) and a
short-lived **application token** is minted/renewed for the embedded component
(`frontComponentApplicationTokenPairComponentState`, `renewApplicationToken`,
`useRequestApplicationTokenRefresh`). Execution context + Apollo cache bridge:
`useFrontComponentExecutionContext`, `useOnFrontComponentUpdated`,
`useUpdateFrontComponentApolloCache`, plus an input-focus cleanup effect.
GraphQL: `findManyFrontComponents` / `findOneFrontComponent`. This is the
runtime that lets marketplace apps inject bespoke React UI into the CRM.

---

## 8. Accounts (connect email / calendar)

`accounts/` is mostly **types + constants + scope logic** (the connect UI lives
in settings pages elsewhere, but the data model is here). Types:
`ConnectedAccount`, `MessageChannel`, `CalendarChannel`, `MessageFolder`,
`BlocklistItem`, and `ImapSmtpCaldavAccountInput` (manual IMAP/SMTP/CalDAV
connection input, i.e. non-OAuth providers). OAuth scope constants:
`GmailSendScope`, `GmailComposeScope`, `MicrosoftSendScope`. Utility
`hasMissingDraftEmailScopes` checks whether a connected account is missing the
send/compose scopes needed to draft email and prompts re-consent. Supports
Gmail / Microsoft (OAuth) plus generic IMAP/SMTP/CalDAV.

---

## 9. Spreadsheet Import Wizard

`spreadsheet-import/` is a full **multi-step modal wizard** (its own
provider + stepper). Driver: `SpreadsheetImportStepper` /
`SpreadsheetImportStepperContainer`, provider components, types/constants/states.

| Step | Component | UX |
| --- | --- | --- |
| Upload | `UploadStep` (+ `DropZone`) | drag-and-drop / pick a `.csv` / `.xlsx`; CSV security sanitisation in `utils/csv-security` (guards against formula-injection) |
| Select sheet | `SelectSheetStep` | choose which sheet of a multi-sheet workbook to import |
| Select header | `SelectHeaderStep` | pick which row is the header row |
| Match columns | `MatchColumnsStep` (+ `ColumnGrid`, `TemplateColumn`, `UserTableColumn`, `SubMatchingSelect*`, `UnmatchColumn`/`Banner`) | map each spreadsheet column to a CRM field; for enum/select fields, a **sub-matching** UI maps each distinct source value to a target option; unmatched columns are flagged |
| Validation | `ValidationStep` (+ `columns.tsx`) | an editable data grid showing per-row/per-cell validation errors before commit |
| Import | `ImportDataStep` | runs the import and reports results |

Has `__mocks__` and extensive `__tests__`, indicating this is a battle-tested,
self-contained vendored wizard (Twenty's fork of `react-spreadsheet-import`).

---

## 10. File Upload (shared primitive)

`file-upload/` is a small shared upload context: `FileUploadProvider` +
`FileUploadContext`, consumed via `useFileUpload`. It's the generic
"upload a file and get back a URL/token" primitive used by attachments, the AI
chat file attachments, avatars, etc.

---

## Parity notes

We built a **Twenty-style workflow BUILDER** at
`src/app/sabcrm/settings/automations/page.tsx` (~1,200 lines): a two-pane layout
— left = workflow list (name, enable toggle, trigger summary), right = builder
for the selected workflow as a **trigger card → ordered, connector-linked steps
list** with a small **per-type config form** for each step, plus
enable / save / **run-now** (`runWorkflowNowTw`). It is wired to the real engine
through gated server actions (`sabcrm-workflows.actions`) with session → project
→ RBAC → plan guards. We also shipped a **logic-functions settings page**
(`settings/functions`, Monaco-ish code textarea + runtime select, definition-only)
and a **segments / smart-list page** (`settings/segments`, live counts).

The big gap is the **visual node-canvas**: ours is a vertical list, Twenty's is
a React Flow directed graph with branches, loops, drag-connect, and
insert-on-edge. Mapping:

| Area | Status | Notes / complexity tag |
| --- | --- | --- |
| Two-pane builder shell (list + editor) | **BUILT** | SIMPLE |
| Trigger card (event + object select) | **BUILT** | SIMPLE |
| Trigger: webhook / cron / manual / upsert variants | **PARTIAL** | only record.created/updated/deleted; no webhook URL, no cron-to-human engine — MEDIUM |
| Ordered steps list + per-type config forms | **BUILT** | create_task / send_notification / update_field / webhook — SIMPLE |
| Enable / Save / Run-now | **BUILT** | wired to engine actions — SIMPLE |
| **Visual node canvas (React Flow)** | **MISSING** | the headline gap — RUNTIME-HEAVY (canvas engine, layout, drag-connect, handles) |
| Edge insert-step / branch / loop handles | **MISSING** | depends on canvas — RUNTIME-HEAVY |
| If/Else branches, Iterator loops on canvas | **MISSING** | needs graph + branch edges — RUNTIME-HEAVY |
| Full action catalogue (15 types) | **PARTIAL** | we have ~4 step types vs Twenty's 15 (record CRUD, code, http, form, ai-agent, filter, delay, logic-function) — MEDIUM→RUNTIME-HEAVY |
| Workflow variables picker + type inference | **MISSING** | no `{{step.field}}` variable system / output-schema engine — RUNTIME-HEAVY |
| Code action (Monaco) + test-run | **PARTIAL** | functions page has a code textarea, definition-only, no execution — MEDIUM |
| HTTP request action with live test | **MISSING** | MEDIUM |
| Form action (build + filler/human-in-the-loop) | **MISSING** | RUNTIME-HEAVY |
| AI Agent action + permissions matrix + output schema | **MISSING** | RUNTIME-HEAVY |
| Run visualizer (per-step status, SSE streaming) | **MISSING** | needs canvas + SSE — RUNTIME-HEAVY |
| Workflow versioning (draft vs published) | **PARTIAL** | engine supports it; our UI is single-state — MEDIUM |
| Segments / smart lists | **BUILT** | live counts, CRUD, deep-link — SIMPLE |
| AI chat interface + suggested prompts | **MISSING** (this slice) | streaming agent chat, threads, tool rendering — RUNTIME-HEAVY |
| Applications / marketplace browse+install | **MISSING** (this slice) | permission-validation install flow — MEDIUM |
| Front-components (embedded app UI + token mint) | **MISSING** (this slice) | sandboxed SDK runtime — RUNTIME-HEAVY |
| Accounts (email/calendar connect) | **PARTIAL** (this slice) | data model exists; OAuth + IMAP connect UI separate — MEDIUM |
| Spreadsheet import wizard (5-step) | **MISSING** (this slice) | upload→sheet→header→match→validate→import — MEDIUM |
| File-upload primitive | **PARTIAL** | SabFiles is our equivalent shared uploader — SIMPLE |
