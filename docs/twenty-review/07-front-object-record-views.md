# Twenty Front — Record Experience & Views (review 07)

Read-only catalog of the vendored Twenty CRM frontend "record experience" — the
`object-record` module tree and the `views` module. Descriptions are original;
no source is copied verbatim. Paths are relative to
`twenty-front/src/modules/`.

This slice is the heart of the CRM: how a list of records is displayed
(table / kanban / calendar), edited (inline cells, field inputs, bulk update,
merge), filtered/sorted/grouped, imported, and how all of that persists as
named "views".

---

## object-record (root)

The umbrella module. Shared concerns live at the root: `cache/`, `graphql/`,
`multiple-objects/`, `read-only/`, `record-store/`, `states/`, `types/`,
`utils/`, plus the object-level dropdowns
(`object-filter-dropdown`, `object-sort-dropdown`, `object-options-dropdown`).
Everything below is a specialization of "show/edit a set of records of one
object type".

---

## record-index

- **Feature:** The top-level record page controller. Owns the index page header,
  the active view, and decides which surface to render (table, board/kanban, or
  calendar) based on the current view's type.
- **Key pieces:** `RecordIndexContainer`, `RecordIndexContainerGater`
  (gates rendering until view/permissions resolve), `RecordIndexPageHeader`
  (+ icon, kanban add menu item), `RecordIndexTableContainer`,
  `RecordIndexCalendarContainer`, `RecordIndexViewBarEffect`.
- **Interactions / effects:** A swarm of "effect" components synchronize state:
  `RecordIndexLoadBaseOnContextStoreEffect` (load records from the context
  store), `RecordIndexFiltersToContextStoreEffect` (push view filters down),
  `RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect`
  (selection count → store), `RecordIndexGroupAggregateQueryEffect` +
  `RecordIndexGroupAggregatesDataLoader` (kanban/group footer aggregates),
  `RecordIndexRemoveSortingModal` / `RecordIndexRemoveSortingModal` (confirm
  before drag-reorder while a sort is active).
- **Export:** `export/` holds `useRecordIndexExportRecords` +
  `useRecordIndexLazyFetchRecords` — paginated CSV export of the current view's
  filtered/sorted records.

---

## record-table

The flagship spreadsheet-like grid. The most complex submodule by far.

- **Feature:** Virtualized, editable, multi-select data table with resizable /
  reorderable columns, per-column aggregate footer, inline editing, row
  selection, sticky header, group sections, and an "add column" affordance.
- **Structure:** split into `record-table-header`, `record-table-body`,
  `record-table-row`, `record-table-cell`, `record-table-section` (group
  bands), `record-table-footer` (aggregates), `virtualization`, `empty-state`.
- **Header (`record-table-header`):**
  - `RecordTableColumnHead` + `RecordTableColumnHeadWithDropdown` — per-column
    label with a dropdown (sort asc/desc, hide, edit field).
  - `RecordTableHeaderResizeHandler` — drag-to-resize column width.
  - `RecordTableHeaderDragDropColumn` — drag-to-reorder columns.
  - `RecordTableHeaderCheckboxColumn` — select-all checkbox.
  - `RecordTableHeaderAddColumnButton` / `...PlusButtonContent` — add a field
    column inline.
- **Cell (`record-table-cell`):** dual-mode display/edit. Display mode renders a
  field display component; clicking / Enter swaps to `RecordTableCellEditMode`
  which mounts the field input in a portal (`RecordTableCellEditModePortal`).
  Keyboard nav via `RecordTableCellArrowKeysEffect` + `...HotkeysEffect`
  (arrows move focus, Enter edits, Esc cancels, Tab advances).
  `RecordTableCellDragAndDrop` + `RecordTableDragAndDropPlaceholderCell`
  support row drag handles. Hover/focus portals draw the cell border + edit
  button without reflowing the grid.
- **Footer (`record-table-footer`):** per-column aggregation. A dropdown
  (`RecordTableColumnAggregateFooterWithDropdown`) lets the user pick an
  aggregate operation; the chosen op is persisted on the **view field**
  (`viewFieldAggregateOperationState`, `useViewFieldAggregateOperation`).
  Operation option sets are field-type aware:
  `countAggregateOperationOptions` (count, count empty/not-empty, % empty…),
  `dateAggregateOperationOptions` (min/max/earliest/latest),
  `percentAggregateOperationOptions`, `standardAggregateOperationOptions`,
  `nonStandardAggregateOperationsOptions`.
  `getAvailableAggregateOperationsForFieldMetadataType` maps field type →
  allowed ops. `useAggregateRecordsForRecordTableColumnFooter` runs the query.
- **Virtualization (`virtualization`):** custom windowed renderer with a
  "treadmill" of recycled rows (`useLoadRecordsToVirtualRows`,
  `RecordTableVirtualizedRowTreadmillEffect`, `useTriggerFetchPages` for
  infinite scroll, SSE subscribe effect for live updates). Multiple
  reset hooks re-virtualize when data, sort, or field metadata changes.
- **Group sections (`record-table-section`):** when group-by is active, the
  table renders collapsible group bands with their own header/aggregate row;
  `RecordTableRecordGroupRows` vs `RecordTableNoRecordGroupRows`.

---

## record-table-widget

- **Feature:** Embeds a record table inside another surface (e.g. a dashboard
  page / page-layout widget) bound to a specific view.
- **Key pieces:** `RecordTableWidgetProvider`,
  `RecordTableWidgetContextStoreInitEffect`,
  `RecordTableWidgetViewLoadEffect`,
  `RecordTableWidgetSetReadOnlyColumnHeadersEffect` (renders columns read-only
  inside widgets). `computeRecordTableWidgetViewLoadContentSignature` keys
  re-loads on view-content change.

---

## record-board

- **Feature:** Kanban board grouped by a select/relation field, with drag-drop
  cards between columns, multi-card drag, per-column header aggregates, and an
  inline "new record" affordance per column.
- **Structure:** `record-board-column` and `record-board-card` sub-trees.
- **Columns:** `RecordBoardColumn`, `RecordBoardColumnHeader` (title + count),
  `RecordBoardColumnHeaderAggregateDropdown*` (pick a column-footer aggregate,
  same op model as the table footer), `RecordBoardColumnNewRecordButton`,
  `RecordBoardColumnDropdownMenu` (edit/sort column), skeleton loaders.
- **Cards:** `RecordBoardCard`, `RecordBoardCardHeader/Body`,
  `RecordBoardCardDraggableContainer`, plus multi-drag visuals —
  `RecordBoardCardMultiDragPreview`, `...MultiDragStack`,
  `...MultiDragCounterChip` (drag N selected cards at once with a stacked
  preview and a count badge).
- **Interactions:** `RecordBoardDragDropContext` wires drag-drop;
  `RecordBoardDragSelect` enables rubber-band marquee selection of cards;
  hotkey + click-outside + escape effects manage focus/selection;
  `RecordBoardFetchMoreInViewTriggerComponent` does per-column infinite scroll;
  `RecordBoardSSESubscribeEffect` applies live updates;
  `RecordBoardStickyHeaderEffect` pins column headers.

---

## record-drag (shared DnD engine)

- **Feature:** The shared drag-and-drop processing layer used by board, table,
  and calendar — computes new positions and target groups on drop, with
  optimistic update.
- **Key utils:** `getDragOperationType` (single vs multi, same-group vs
  cross-group), `processSingleDrag`, `processMultiDrag`, `processGroupDrop`,
  `extractRecordPositions` (fractional/position math for reordering).
- **Hooks:** `useStartRecordDrag` / `useEndRecordDrag`,
  `useProcessBoardCardDrop`, `useProcessCalendarCardDrop`,
  `useProcessTableWithGroupRecordDrop` / `...WithoutGroup...`,
  `useUpdateDroppedRecordOnBoard`, and an optimistic-update trigger.
- **State:** component-family atoms track primary/secondary dragged record ids,
  multi-drag active, original selection — drives the multi-drag stack visuals.

---

## record-calendar

- **Feature:** Month calendar view; records placed on a date field, draggable
  between days. Has its own top bar (month nav) and add-new affordance.
- **Key pieces:** `RecordCalendar`, `RecordCalendarTopBar`,
  `RecordCalendarAddNew`, month sub-tree (`RecordCalendarMonth`,
  `...MonthBody`, `...MonthBodyWeek`, `...MonthBodyDay`, header day cells),
  card sub-tree (`RecordCalendarCard`, draggable container).
- **Interactions:** `RecordIndexCalendarDataLoaderEffect` loads records for the
  visible month; `RecordIndexCalendarSelectedDateInitEffect` seeds the current
  month; dragging a card to another day → `useProcessCalendarCardDrop` (writes
  the record's date field); `RecordCalendarSSESubscribeEffect` live updates.

---

## record-show

- **Feature:** Single-record detail page. Renders the record's full field list,
  summary card, breadcrumb, and the page-layout-driven body.
- **Key pieces:** `SummaryCard` (header identity block),
  `ObjectRecordShowPageBreadcrumb`, `PageLayoutRecordPageRenderer`
  (tabs/sections from page layout), `RecordShowEffect` (targeted-record store
  wiring), `RecordShowPageSSESubscribeEffect`. Has its own
  `graphql/operations`.

---

## record-field

The field-type system — display + input components for every Twenty field type.

- **Feature:** For each field metadata type there is a **display** component
  (read mode) and an **input** component (edit mode); both consume a shared
  field-value context. This is the backbone reused by table cells, inline
  cells, board cards, and the record-show field list.
- **Display types (`ui/meta-types/display/components`):** Text, Number,
  Currency, Boolean, Rating, Date, DateTime, Select, MultiSelect, Links,
  Emails, Phones, Address, FullName, Array, RawJson, RichText, Uuid, Actor
  (created/updated-by), Chip, Relation-to-one / Relation-from-many,
  Morph-relation (poly), Files, Forbidden (no-permission placeholder).
- **Input types (`ui/meta-types/input/components`):** matching editors —
  TextFieldInput, NumberFieldInput, CurrencyFieldInput, BooleanFieldInput,
  RatingFieldInput, Date/DateTimeFieldInput, SelectFieldInput,
  MultiSelectFieldInput, LinksFieldInput, EmailsFieldInput, PhonesFieldInput,
  AddressFieldInput, FullNameFieldInput, ArrayFieldInput, RawJsonFieldInput,
  RichTextFieldEditor/Input, FilesFieldInput,
  Relation/MorphRelation One-to-many & Many-to-one inputs, and the
  `MultiItemFieldInput` family (repeatable composite editor used by
  links/emails/phones — add/remove rows, primary item).
- **Supporting:** `ui/validation-schemas` (per-field zod-style validation),
  `ui/form-types`, `ui/hooks` (draft value, persist, blur/submit),
  read-only awareness, and hooks at the module root to manage **field
  visibility & ordering** on a view: `useChangeRecordFieldVisibility`,
  `useReorderVisibleRecordFields`, `useMoveRecordField`,
  `useFilterVisibleAndReadableRecordField`.

---

## record-inline-cell

- **Feature:** The editable field cell used on the record-show page and side
  panel (the non-grid equivalent of a table cell). Click a value → it expands
  into an editor; click away / Enter commits.
- **Key pieces:** `RecordInlineCell`, `RecordInlineCellContainer`,
  `RecordInlineCellDisplayMode` / `...EditMode`, `RecordInlineCellEditButton`,
  hover & anchored portals (`...HoveredPortal`, `...AnchoredPortal`) that draw
  the edit chrome without shifting layout, `...SkeletonLoader`, and
  `RecordInlineCellCloseOnSidePanelOpeningEffect` (auto-close edit when the
  side panel opens). `useInlineCell` drives open/close state.

---

## record-title-cell

- **Feature:** The special "name/title" cell used when **creating a record
  inline** (the first column / identifier). Supports text, double-text
  (full-name first+last), and uuid identifier variants.
- **Key pieces:** `RecordTitleCell` + container, field-specific display/input
  (`RecordTitleCellTextField*`, `RecordTitleFullNameField*`,
  `RecordTitleDoubleTextInput`, `RecordTitleCellUuidFieldDisplay`).
  `useOpenNewRecordTitleCell` opens the inline create editor; on commit it
  creates the record and (optionally) opens it.

---

## record-card

- **Feature:** Generic record card layout primitive (header + body field
  rows) shared by board cards / pickers. `RecordCard`,
  `RecordCardHeaderContainer`, `RecordCardBodyContainer`.

---

## record-field-list

- **Feature:** Renders the ordered, visibility-filtered list of fields for a
  record (used on the show page / side panel). `RecordFieldList` +
  `useFieldListFieldMetadataItems` / `useFieldListFieldMetadataFromPosition`
  (resolve which fields show and in what order based on the view's field
  config).

---

## record-update-multiple (bulk edit)

- **Feature:** Bulk-edit a single field across all selected records. A footer
  bar appears when ≥1 record is selected; choosing a field opens a form to set
  one value applied to the whole selection.
- **Key pieces:** `UpdateMultipleRecordsContainer`,
  `UpdateMultipleRecordsFooter`, `UpdateMultipleRecordsForm`,
  `useUpdateMultipleRecordsActions` (action registration + batched update).

---

## record-merge

- **Feature:** Merge 2+ selected duplicate records into one, with a tabbed
  wizard: pick which record contributes each field, preview the merged result,
  and configure merge settings (e.g. keep/delete sources, relation handling).
- **Key pieces:** `MergeRecordsContainer` (tabbed shell),
  `MergeRecordTab` (per-source-record field selection),
  `MergePreviewTab` (resulting record preview),
  `MergeSettingsTab` (options), `MergeRecordsFooter` (confirm).
- **Hooks:** `useMergeRecordsContainerTabs`,
  `useMergeRecordsSelectedRecords`, `useMergeRecordsSettings`,
  `usePerformMergePreview` (server preview), `useMergeRecordsActions`.

---

## record-picker

- **Feature:** Modal/dropdown pickers to attach records via relations.
- **Single (`single-record-picker`):** searchable single-select list
  (`SingleRecordPicker`, `...MenuItemsWithSearch`, loading effect) — choose one
  record for a many-to-one relation.
- **Multiple (`multiple-record-picker`):** checkbox multi-select with search +
  infinite scroll (`MultipleRecordPicker`, `...MenuItems`, `...SearchInput`,
  `...FetchMoreLoader`, `...ItemsDisplay` of chosen chips,
  `...OnClickOutsideEffect`) — attach many records (one-to-many / many-to-many).

---

## select

- **Feature:** Lower-level multi-select dropdown primitive and the
  records-for-select fetch hook backing the pickers/filters.
  `MultipleSelectDropdown`, `useRecordsForSelect`, `getObjectFilterFields`.

---

## record-side-panel

- **Feature:** The right-hand peek/side panel that shows a record without
  leaving the list. Minimal here — holds the viewable-record id / singular-name
  states (`viewableRecordIdState`, `viewableRecordNameSingularState`); the
  panel body reuses `record-field-list` + inline cells.

---

## Filtering — record-filter / record-filter-group / advanced-filter / object-filter-dropdown

### record-filter

- **Feature:** The data model + hooks for a single filter on a field
  (field + operand + value, with display value).
- **Hooks:** `useCreateEmptyRecordFilterFromFieldMetadataItem`,
  `useCreateRecordFilterFromObjectFilterDropdownCurrentStates`,
  `useGetRecordFilterDisplayValue` (human label for the chip),
  `useFilterableFieldMetadataItems`, `useRemoveRecordFilter`,
  `useCheckIsSoftDeleteFilter`, relative-date timezone helper.

### record-filter-group

- **Feature:** Groups of filters joined by AND/OR, nestable, forming the
  advanced-filter tree. `useUpsertRecordFilterGroup`,
  `useRemoveRecordFilterGroup`, `useRemoveRootRecordFilterGroupIfEmpty`.

### object-filter-dropdown

- **Feature:** The UI for building one filter: pick field → pick operand →
  enter value, with type-specific inputs.
- **Operand model:** `ViewFilterOperand` (from twenty-shared) — IS / IS_NOT,
  CONTAINS / DOES_NOT_CONTAIN, IS_EMPTY / IS_NOT_EMPTY, GREATER/LESS_THAN(_OR_EQUAL),
  IS_BEFORE / IS_AFTER, IS_RELATIVE, IS_IN_PAST/FUTURE, etc.
  `getOperandsForFilterType` maps field type → allowed operands;
  `getOperandLabel` localizes; `configurableViewFilterOperands` marks which
  operands take a value.
- **Type-specific value inputs:** Text, Number, Date, DateTime (with relative
  date support + timezone), Rating, Boolean select, Currency select, Country
  select, Option/Select select, Actor/Source select, Record select (relation
  filter with pinned items), Any-field search input.

### advanced-filter

- **Feature:** The full nested AND/OR filter builder shown in a modal — rows of
  (field, operand, value) grouped by logical operator, with composite sub-field
  drill-down and relation target-field selection.
- **Key pieces:** `AdvancedFilterRecordFilterGroupChildren` (recursive group
  rendering), `AdvancedFilterLogicalOperatorCell` / `...Dropdown` (AND ↔ OR
  per group), `AdvancedFilterAddFilterRuleSelect` (add rule / add group),
  `AdvancedFilterFieldSelect*` (searchable field picker),
  `AdvancedFilterCompositeSubFieldSelectMenu` (drill into composite sub-fields),
  `AdvancedFilterDropdown{Text,Number,Filter}Input`,
  `AdvancedFilterRecordFilterGroupOptionsDropdown` (delete/ungroup).
- **Hooks:** apply source field / relation target field / composite sub-field;
  manage the row↔dropdown binding state.

---

## Sorting — record-sort / object-sort-dropdown

- **Feature:** One or more field sorts (asc/desc) on a view.
- **record-sort:** `useUpsertRecordSort`, `useRemoveRecordSort`.
- **object-sort-dropdown:** field picker + direction toggle UI that produces a
  `RecordSort`. Drag-reordering rows while a sort is active prompts the
  remove-sort confirmation (record-index).

---

## Grouping — record-group / record-aggregate

### record-group

- **Feature:** Defines how records are grouped (kanban columns / table bands) by
  a select/relation field, including group visibility and ordering.
- **Key pieces:** `RecordGroupsVisibilityDropdownSection`,
  `RecordGroupMenuItemDraggable` (drag to reorder groups),
  `RecordGroupReorderConfirmationModal` (+ hook).
- **Hooks:** `useSetRecordGroups`, `useReorderRecordGroups`,
  `useRecordGroupVisibility`, `useRecordGroupFilter` (per-group record query),
  `useCurrentRecordGroupId/Definition`, `useShouldHideRecordGroup`,
  `useRecordGroupActions`.

### record-aggregate

- **Feature:** Builds & runs group-by aggregate queries that feed the kanban
  column headers and table group/footer aggregate values.
- **Utils:** `generateGroupByAggregateQuery`,
  `generateGroupsRecordsGroupByQuery`, `getGroupByAggregateQueryName`,
  `transformAggregateRawValueIntoAggregateDisplayValue` (format raw → display),
  `getAggregateLabelWithFieldName`.

---

## spreadsheet-import (import wizard)

- **Feature:** Multi-step CSV/spreadsheet import wizard for bulk-creating
  records: upload → map spreadsheet columns to object fields → validate →
  review/fix invalid rows → import.
- **Key pieces:** `useOpenObjectRecordsSpreadsheetImportDialog` (launches the
  wizard for a given object), `useBuildSpreadSheetImportFields` (turns object
  field metadata into importable field defs, including composite sub-fields and
  relation-connect targets).
- **Utils:** `getSpreadSheetFieldValidationDefinitions` (per-field validation
  during import), composite sub-field key/label helpers,
  `spreadSheetGetRelationConnectSubFieldKey/Label` (map a column to a relation
  lookup, e.g. connect by email), `spreadsheetImportFilterAvailableFieldMetadataItems`,
  `spreadsheetImportGetUnicityTableHook` (dedupe / unique-key check),
  `buildRecordFromImportedStructuredRow` (assemble a record payload from a
  mapped row). The wizard chrome itself comes from a shared spreadsheet-import
  library; this module is the Twenty-object adapter around it.

---

## Cross-cutting infra

### cache

- **Feature:** Apollo cache read/write helpers so optimistic mutations and
  cross-view consistency work without refetch. `useCreateOneRecordInCache`,
  `useCreateManyRecordsInCache`, `useDeleteRecordFromCache`,
  `useGetRecordFromCache`, `useReadFindManyRecordsQueryInCache`,
  `useUpsertFindManyRecordsQueryInCache`, `useUpsertFindOneRecordQueryInCache`.

### graphql

- **Feature:** Dynamic GraphQL document generation for records.
  `record-gql-fields` (compute the minimal field selection set a surface needs),
  plus query/mutation builders and result types. Drives findMany/findOne and
  the aggregate queries.

### multiple-objects

- **Feature:** Query records across several object types at once (used by global
  search / command menu / "any object" surfaces).
  `useCombinedFindManyRecords`, `useGenerateCombinedFindManyRecordsQuery`,
  `usePerformCombinedFindManyRecords`, `useCombinedGetTotalCount`.

### read-only

- **Feature:** Centralized read-only determination. `useIsRecordReadOnly`
  (whole record — permissions, soft-deleted, etc.) and
  `useIsRecordFieldReadOnly` (per-field — system field, no update permission,
  derived field). Consumed by every cell/input to disable editing and render
  the Forbidden display.

---

## views module

The persistence + chrome layer that turns the above into saved, shareable
"views".

### view types (`views/types`)

- **`View`** — a saved configuration for one object: name, icon, `ViewType`
  (TABLE / KANBAN / CALENDAR), kanban field, calendar field, plus relations to
  its fields, filters, filter-groups, sorts, and groups.
- **`ViewField`** — a column: which field, visible?, position/order, size
  (width), and **per-field aggregate operation** (footer op).
- **`ViewFilter`** — a persisted filter: field, operand, value, display value,
  optional sub-field, and its owning filter group.
- **`ViewFilterGroup`** + **`ViewFilterGroupLogicalOperator`** (AND/OR) —
  persist the nested advanced-filter tree.
- **`ViewSort`** — field + direction.
- **`ViewGroup`** — a group definition (value, visible?, position) for
  kanban/table grouping.
- **`ViewFieldGroup`**, **`ViewKey`**, **`ViewType`** (icon mapping:
  table/kanban/calendar), `GraphQLView`, `ViewWithRelations`.
- **URL filter types** (`UrlSingleFilter`, `UrlRecursiveFilterGroup`,
  `UrlFilterDeserializationResult`) — filters can be encoded in / restored from
  the query string (shareable filtered links).

### view-picker

- **Feature:** The dropdown to switch between, create, edit, and delete views.
- **Key pieces:** `ViewPickerDropdown`, `ViewPickerListContent` (list of views
  with icons), `ViewPickerOptionDropdown` (rename/delete/edit a view),
  `ViewPickerContentCreateMode` / `...EditMode` (name + icon form),
  `ViewPickerCreateButton`, `ViewPickerEditButton`,
  `ViewPickerSaveButtonContainer`, `ViewPickerIconAndNameContainer`.

### ViewBar & details (`views/components`)

- **Feature:** The bar above every record list showing the current view, its
  active filter/sort chips, and edit affordances; the entry point for the
  filter dropdown, field-visibility editing, and "any field" search.
- **Key pieces:** `ViewBar`, `ViewBarPageTitle`, `ViewBarDetails` (chip row),
  `ViewBarDetailsAddFilterButton`, `ViewBarFilterButton`,
  `ViewBarFilterDropdown*` (field-select → input → bottom menu with the
  advanced-filter + any-field-search buttons), `UpdateViewButtonGroup`
  (Save / Save-as-new / Discard when the view is dirty),
  `ViewFieldsVisible/Hidden/SearchDropdownSection` (toggle column visibility),
  `SortOrFilterChip` / `SoftDeleteFilterChip` (chip rendering),
  `AnyFieldSearch*` (quick free-text search across fields),
  `ViewBarSkeletonLoader`.
- **Sync effects:** `ViewBarRecordFilterEffect`, `ViewBarRecordFilterGroupEffect`,
  `ViewBarRecordSortEffect`, `ViewBarRecordFieldEffect`,
  `ViewBarAnyFieldFilterEffect` keep the in-memory record-filter/sort/field
  states in sync with the persisted view, and
  `QueryParamsFiltersEffect` / `QueryParamsSortsEffect` /
  `QueryParamsCleanupEffect` serialize them to/from the URL.

### editable-chip & advanced-filter-chip

- **editable-chip:** the inline-editable filter/sort chip in the view bar — a
  chip you can click to re-open its editor; used to render and re-edit an
  applied filter without going back to the dropdown.
- **advanced-filter-chip:** the single chip that represents a whole nested
  advanced-filter (when filters are too complex for individual chips) and opens
  the advanced-filter modal on click.

### view-filter-value

- **Feature:** Serialize/deserialize and format filter values for persistence,
  chips, and URL encoding (`utils` + value `types`). Handles the
  field-type-specific value shapes (relative dates, multi-select arrays,
  relation ids, etc.).

### Persistence model (how views persist)

- A view stores **type** (table/board/calendar), its **fields** (visibility,
  order, width, aggregate op), **filters + filter-groups** (the AND/OR tree),
  **sorts**, and **groups** (kanban columns / table bands). Editing any of
  these marks the view dirty → `UpdateViewButtonGroup` offers
  Save / Save-as-new-view / Discard. Filters & sorts also round-trip through
  the URL so a filtered/sorted list is a shareable link, and
  `views/utils` diffing helpers (`getViewFiltersToCreate/Update/Delete`,
  `areViewFiltersEqual`, `viewMapFunctions`) compute the minimal mutations to
  persist on save.

---

## Parity notes

Legend: **BUILT** = already implemented in our SabCRM rebuild; **GAP** = not yet
(or only partially). Effort tags on gaps: **SIMPLE** (small UI/logic),
**MEDIUM** (multi-component feature), **RUNTIME-HEAVY** (needs backend support,
virtualization, SSE, or heavy state machinery).

### Already built (parity confirmed against our rebuild)

- **Record table + inline edit + pagination + sort** — BUILT.
- **Column reorder + resize** — BUILT.
- **Kanban board + drag-drop** — BUILT.
- **Calendar view** — BUILT.
- **Advanced AND/OR filters** — BUILT.
- **Group-by + aggregation footers** (table footer + kanban column headers) —
  BUILT.
- **Bulk actions** (multi-select + bulk single-field update) — BUILT.
- **Record merge flow** — BUILT.
- **View bar + saved views** (create/switch/edit/delete, dirty Save/Save-as) —
  BUILT.
- **Spreadsheet import wizard** — BUILT.

### Gaps / things to verify against Twenty's depth

- **Cell-level keyboard grid navigation** (arrow keys move focus, Enter to edit,
  Tab to advance, Esc to cancel, copy/paste between cells) — verify ours matches
  Twenty's hotkey effects. **MEDIUM.**
- **Row & column virtualization with infinite-scroll "treadmill"** — Twenty's
  table recycles rows and fetches pages on scroll; if ours renders all rows or
  uses simple pagination only, this is a **RUNTIME-HEAVY** gap for large
  datasets.
- **Live updates over SSE** (table/board/calendar/show subscribe effects that
  patch the cache in real time) — likely **GAP**. **RUNTIME-HEAVY.**
- **Multi-card drag** (drag N selected kanban cards at once with stacked preview
  + counter chip) and **marquee/rubber-band select** on the board — verify;
  likely **GAP**. **MEDIUM.**
- **Calendar card drag-to-reschedule** (writing the date field on drop) — verify
  ours does the optimistic write, not just display. **MEDIUM.**
- **Per-field-type aggregate option sets** (date min/max/earliest/latest,
  percent-empty, count variants gated by field type) — verify breadth.
  **SIMPLE–MEDIUM.**
- **Composite sub-field filtering & relation-target filtering** in the advanced
  filter (drill into address/full-name sub-fields, filter a relation by a field
  on the related object) — verify. **MEDIUM.**
- **Relative-date filters with timezone** (IS_RELATIVE, in-past/in-future,
  this/last/next periods) — verify. **MEDIUM.**
- **URL-encoded filters/sorts** (shareable filtered links round-tripping through
  query params) — likely **GAP**. **MEDIUM.**
- **Any-field quick search** chip/input in the view bar — verify. **SIMPLE.**
- **Spreadsheet import: relation-connect mapping** (import a column as "connect
  by email/identifier") + **unicity/dedupe** + composite sub-field column
  mapping + per-row validation/fix step — verify our wizard goes this deep;
  partial likely. **MEDIUM.**
- **Record merge wizard depth** — per-source field selection tab + live server
  merge **preview** + settings (relation handling, delete sources) — verify
  ours has the preview + settings tabs, not just "pick a survivor". **MEDIUM.**
- **Inline record creation via title cell** (full-name / uuid identifier
  variants, create-and-open) — verify. **SIMPLE–MEDIUM.**
- **Multi-object combined queries** (global "any object" search/command menu) —
  may be **GAP**. **MEDIUM.**
- **Record-table-as-widget** (embedding a bound, read-only-headers table inside
  a dashboard/page-layout) — likely **GAP**. **MEDIUM.**
- **Group reorder confirmation & remove-sort-before-reorder modals** — small UX
  guards; verify. **SIMPLE.**
- **CSV export of the current filtered/sorted view** (lazy paginated fetch) —
  verify. **SIMPLE–MEDIUM.**
- **Read-only resolution granularity** (per-field vs per-record, Forbidden
  display for no-permission fields) — verify ours mirrors
  `useIsRecordFieldReadOnly`. **SIMPLE.**
