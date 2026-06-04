# View, Layout, and Navigation Metadata Modules

Documentation of all exported functions and NestJS services across the view, page-layout, navigation-menu-item, command-menu-item, front-component modules and their flat-* siblings.

## view

The core view module manages list and table views across objects, including filtering, sorting, grouping, and field configuration.

### view.service.ts

**file: /src/engine/metadata-modules/view/services/view.service.ts**

#### ViewService

**createOne** — `({ createViewInput, workspaceId, createdByUserWorkspaceId }: { createViewInput: CreateViewInput; workspaceId: string; createdByUserWorkspaceId?: string }) => Promise<ViewDTO>`
Creates a new view with groups, validating against workspace migration builder and returning the created view DTO after cache recomputation.

**updateOne** — `({ updateViewInput, workspaceId, userWorkspaceId }: { updateViewInput: UpdateViewInput; workspaceId: string; userWorkspaceId?: string }) => Promise<ViewDTO>`
Updates an existing view including associated view groups, validates changes, and returns updated DTO; supports user-scoped modifications.

**deleteOne** — `({ deleteViewInput, workspaceId }: { deleteViewInput: DeleteViewInput; workspaceId: string }) => Promise<ViewDTO>`
Soft-deletes a view by setting deletedAt timestamp through workspace migration, used for user perspective deletion.

**destroyOne** — `({ destroyViewInput, workspaceId }: { destroyViewInput: DestroyViewInput; workspaceId: string }) => Promise<ViewDTO>`
Permanently destroys a view through workspace migration (hard delete), irreversible operation.

**processViewNameWithTemplate** — `(viewName: string, isCustom: boolean, objectLabelPlural?: string, locale?: keyof typeof APP_LOCALES): string`
Interpolates view name templates like `{objectLabelPlural}` with actual object labels, applies i18n translations for standard views.

**isViewVisibleToUser** — `(view: { visibility: ViewVisibility; createdByUserWorkspaceId: string | null }, userWorkspaceId?: string): boolean`
Determines if view is visible to caller based on WORKSPACE/UNLISTED visibility and ownership.

**getFilteredFlatViews** — `({ workspaceId, objectMetadataId?, userWorkspaceId?, viewTypes? }: ...): Promise<FlatView[]>`
Filters and sorts flat views by workspace, object, visibility, type and user ownership from cache maps.

**findByWorkspaceId** — `(workspaceId: string, userWorkspaceId?: string, viewTypes?: ViewType[]): Promise<ViewDTO[]>`
Returns all non-deleted views visible to user, optionally filtered by type (GRID, KANBAN, GALLERY etc.).

**findByObjectMetadataId** — `(workspaceId: string, objectMetadataId: string, userWorkspaceId?: string, viewTypes?: ViewType[]): Promise<ViewDTO[]>`
Returns views for a specific object (Contacts, Deals, etc.), respecting visibility and type filters.

**findById** — `(id: string, workspaceId: string): Promise<ViewDTO | null>`
Finds single view by ID from cache, returns null if not found or deleted.

**findByIdWithRelations** — `(id: string, workspaceId: string): Promise<ViewDTO | null>`
Retrieves view with all related fields, filters, sorts, groups, field groups populated from flat entity maps.

**findManyWithRelationsFromCache** — `(flatViews: FlatView[], workspaceId: string): Promise<ViewDTO[]>`
Batch-loads all relations (fields, filters, sorts, groups) for multiple views from flat entity cache maps.

**findByWorkspaceIdWithRelations** — `(workspaceId: string, userWorkspaceId?: string, viewTypes?: ViewType[]): Promise<ViewDTO[]>`
Returns all workspace views with all relations populated, respecting visibility/type filters.

**findByObjectMetadataIdWithRelations** — `(workspaceId: string, objectMetadataId: string, userWorkspaceId?: string, viewTypes?: ViewType[]): Promise<ViewDTO[]>`
Returns views for object with all relations, respecting filters.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewEntity | null>`
Low-level repository query including soft-deleted views; used for administrative/recovery purposes.

### view.resolver.ts

**file: /src/engine/metadata-modules/view/resolvers/view.resolver.ts**

#### ViewResolver (GraphQL)

**name** — `ResolveField` resolver for ViewDTO.name
Processes view name templates with object labels and i18n translations at query time based on client locale.

**getViews** — `@Query() ({ workspace, userWorkspaceId, objectMetadataId?, viewTypes? }): Promise<ViewDTO[]>`
GraphQL query returning views, optionally filtered by object and types; applies CustomPermissionGuard.

**getView** — `@Query() (id: string, workspace): Promise<ViewDTO | null>`
GraphQL query for single view by ID with NoPermissionGuard; returns null if not found.

**createView** — `@Mutation() (input: CreateViewInput, workspace, userWorkspaceId?): Promise<ViewDTO>`
Creates view via GraphQL, defaults visibility to WORKSPACE, applies CreateViewPermissionGuard.

**updateView** — `@Mutation() (id: string, input: UpdateViewInput, workspace, userWorkspaceId?): Promise<ViewDTO>`
Updates view, applies UpdateViewPermissionGuard, supports user-scoped changes.

**deleteView** — `@Mutation() (id: string, workspace): Promise<boolean>`
Soft-deletes view, returns boolean success, applies DeleteViewPermissionGuard.

**destroyView** — `@Mutation() (id: string, workspace): Promise<boolean>`
Hard-deletes view, applies DestroyViewPermissionGuard.

### view.controller.ts

**file: /src/engine/metadata-modules/view/controllers/view.controller.ts**

#### ViewController (REST)

**findMany** — `@Get() ({ locale, workspace, userWorkspaceId, objectMetadataId? }): Promise<ViewDTO[]>`
REST GET /rest/metadata/views, returns views with names processed for templates and translations.

**findOne** — `@Get(':id') (id: string, locale, workspace): Promise<ViewDTO>`
REST GET /rest/metadata/views/:id, throws ViewException if not found.

**create** — `@Post() (input: CreateViewInput, workspace, locale?): Promise<ViewDTO>`
REST POST /rest/metadata/views, creates view with i18n processing.

**update** — `@Patch(':id') (id: string, input: UpdateViewInput, locale, workspace, userWorkspaceId?): Promise<ViewDTO>`
REST PATCH /rest/metadata/views/:id, updates with template processing.

**delete** — `@Delete(':id') (id: string, workspace): Promise<{ success: boolean }>`
REST DELETE /rest/metadata/views/:id, soft deletes and returns success flag.

**processViewsWithTemplates** — `(views: ViewDTO[], workspaceId: string, locale?: string): Promise<ViewDTO[]>`
Private method interpolating view name templates and applying translations for REST responses.

### view-query-params.service.ts

**file: /src/engine/metadata-modules/view/services/view-query-params.service.ts**

#### ViewQueryParamsService

**resolveViewToQueryParams** — `(viewId: string, workspaceId: string, currentWorkspaceMemberId?: string): Promise<ViewQueryParams>`
Converts view (filters, sorts, fields) into GraphQL query parameters (RecordGqlOperationFilter, OrderBy), resolves workspace member timezone for date filtering.

**getWorkspaceMemberTimezoneIfAvailable** — `(workspaceId: string, currentWorkspaceMemberId?: string): Promise<string>`
Fetches workspace member's timezone from ORM or defaults to DEFAULT_TIMEZONE constant; catches errors gracefully.

### view-widget-upsert.service.ts

**file: /src/engine/metadata-modules/view/services/view-widget-upsert.service.ts**

#### ViewWidgetUpsertService

**upsertViewWidget** — `({ input, workspaceId }: { input: UpsertViewWidgetInput; workspaceId: string }): Promise<ViewEntity>`
Upserts (creates/updates) view widget configuration (fields, filters, sorts) through workspace migration; validates widget type is RECORD_TABLE or FIELD table display; manages field size, defaults, and permissions.

---

## view-field

Module for managing individual field configurations within views (visibility, size, overrides).

### view-field.service.ts

**file: /src/engine/metadata-modules/view-field/services/view-field.service.ts**

#### ViewFieldService

**createOne** — `({ createViewFieldInput, workspaceId }): Promise<ViewFieldDTO>`
Creates single view field by delegating to createMany.

**createMany** — `({ createViewFieldInputs, workspaceId }): Promise<ViewFieldDTO[]>`
Creates multiple view fields with validation against flat field/view metadata, runs workspace migration.

**updateOne** — `({ updateViewFieldInput, workspaceId }): Promise<ViewFieldDTO>`
Updates view field (position, size, overrides), validates via workspace migration.

**deleteOne** — `({ deleteViewFieldInput, workspaceId }): Promise<ViewFieldDTO>`
Soft-deletes view field (sets deletedAt).

**destroyOne** — `({ destroyViewFieldInput, workspaceId }): Promise<ViewFieldDTO>`
Hard-deletes view field from workspace migration.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewFieldEntity | null>`
Repository query including soft-deleted fields.

---

## view-filter

Module managing filters applied to views (field equality, ranges, existence checks).

### view-filter.service.ts

**file: /src/engine/metadata-modules/view-filter/services/view-filter.service.ts**

#### ViewFilterService

**createOne** — `({ createViewFilterInput, workspaceId }): Promise<ViewFilterDTO>`
Creates view filter with field validation, runs workspace migration.

**updateOne** — `({ updateViewFilterInput, workspaceId }): Promise<ViewFilterDTO>`
Updates filter operand/value/sub-field, applies to existing filter group.

**deleteOne** — `({ deleteViewFilterInput, workspaceId }): Promise<ViewFilterDTO>`
Soft-deletes filter (sets deletedAt).

**destroyOne** — `({ destroyViewFilterInput, workspaceId }): Promise<ViewFilterDTO>`
Hard-deletes filter.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewFilterEntity | null>`
Repository query including soft-deleted.

---

## view-filter-group

Module for nested filter groups (AND/OR combinations).

### view-filter-group.service.ts

**file: /src/engine/metadata-modules/view-filter-group/services/view-filter-group.service.ts**

#### ViewFilterGroupService

**createOne** — `({ createViewFilterGroupInput, workspaceId }): Promise<ViewFilterGroupDTO>`
Creates filter group (AND/OR logical operator), validates hierarchy.

**updateOne** — `({ updateViewFilterGroupInput, workspaceId }): Promise<ViewFilterGroupDTO>`
Updates filter group operator/parent.

**deleteOne** — `({ deleteViewFilterGroupInput, workspaceId }): Promise<ViewFilterGroupDTO>`
Soft-deletes group and cascades to children.

**destroyOne** — `({ destroyViewFilterGroupInput, workspaceId }): Promise<ViewFilterGroupDTO>`
Hard-deletes group.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewFilterGroupEntity | null>`
Repository query.

---

## view-sort

Module for sort orders (ascending/descending, multiple sort levels).

### view-sort.service.ts

**file: /src/engine/metadata-modules/view-sort/services/view-sort.service.ts**

#### ViewSortService

**createOne** — `({ createViewSortInput, workspaceId }): Promise<ViewSortDTO>`
Creates sort rule for field in view, validates field exists, runs migration.

**updateOne** — `({ updateViewSortInput, workspaceId }): Promise<ViewSortDTO>`
Updates sort direction (ASC/DESC).

**deleteOne** — `({ deleteViewSortInput, workspaceId }): Promise<ViewSortDTO>`
Soft-deletes sort.

**destroyOne** — `({ destroyViewSortInput, workspaceId }): Promise<ViewSortDTO>`
Hard-deletes sort.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewSortEntity | null>`
Repository query.

---

## view-group

Module for record grouping by field values (GROUP BY equivalent).

### view-group.service.ts

**file: /src/engine/metadata-modules/view-group/services/view-group.service.ts**

#### ViewGroupService

**createOne** — `({ createViewGroupInput, workspaceId }): Promise<ViewGroupDTO>`
Creates grouping by field, validates field type is enum/option compatible.

**updateOne** — `({ updateViewGroupInput, workspaceId }): Promise<ViewGroupDTO>`
Updates group field or position.

**deleteOne** — `({ deleteViewGroupInput, workspaceId }): Promise<ViewGroupDTO>`
Soft-deletes group.

**destroyOne** — `({ destroyViewGroupInput, workspaceId }): Promise<ViewGroupDTO>`
Hard-deletes group.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewGroupEntity | null>`
Repository query.

---

## view-field-group

Module for organizing view fields into logical sections/tabs within a view.

### view-field-group.service.ts

**file: /src/engine/metadata-modules/view-field-group/services/view-field-group.service.ts**

#### ViewFieldGroupService

**createOne** — `({ createViewFieldGroupInput, workspaceId }): Promise<ViewFieldGroupDTO>`
Creates field group for organizing view fields.

**createMany** — `({ createViewFieldGroupInputs, workspaceId }): Promise<ViewFieldGroupDTO[]>`
Batch-creates field groups.

**updateOne** — `({ updateViewFieldGroupInput, workspaceId }): Promise<ViewFieldGroupDTO>`
Updates field group metadata.

**deleteOne** — `({ deleteViewFieldGroupInput, workspaceId }): Promise<ViewFieldGroupDTO>`
Soft-deletes group.

**destroyOne** — `({ destroyViewFieldGroupInput, workspaceId }): Promise<ViewFieldGroupDTO>`
Hard-deletes group.

**findByIdIncludingDeleted** — `(id: string, workspaceId: string): Promise<ViewFieldGroupEntity | null>`
Repository query.

#### FieldsWidgetUpsertService

**upsertFieldsWidget** — `({ input, workspaceId }): Promise<ViewEntity>`
Upserts field grouping configuration for fields widget via workspace migration.

---

## view-permissions

Permission guards for view CRUD operations.

### view-permissions.module.ts

**file: /src/engine/metadata-modules/view-permissions/view-permissions.module.ts**

Exports permission guards:
- CreateViewPermissionGuard, UpdateViewPermissionGuard, DeleteViewPermissionGuard, DestroyViewPermissionGuard
- CreateViewFieldPermissionGuard, UpdateViewFieldPermissionGuard, DeleteViewFieldPermissionGuard, DestroyViewFieldPermissionGuard
- CreateViewFilterPermissionGuard, UpdateViewFilterPermissionGuard, DeleteViewFilterPermissionGuard, DestroyViewFilterPermissionGuard
- CreateViewFilterGroupPermissionGuard, UpdateViewFilterGroupPermissionGuard, DeleteViewFilterGroupPermissionGuard, DestroyViewFilterGroupPermissionGuard
- CreateViewGroupPermissionGuard, UpdateViewGroupPermissionGuard, DeleteViewGroupPermissionGuard, DestroyViewGroupPermissionGuard
- CreateViewSortPermissionGuard, UpdateViewSortPermissionGuard, DeleteViewSortPermissionGuard, DestroyViewSortPermissionGuard

### view-access.service.ts

**file: /src/engine/metadata-modules/view-permissions/services/view-access.service.ts**

#### ViewAccessService

**canUserCreateView** — `({ userWorkspaceId, workspaceId, inputUserWorkspaceId?, apiKeyId?, applicationId? }): Promise<void>`
Validates user can create view; checks workspace membership and permissions, throws PermissionsException if denied.

**canUserReadView** — `({ userWorkspaceId, workspaceId, view }): Promise<void>`
Validates user can read view based on visibility rules.

**canUserUpdateView** — `({ userWorkspaceId, workspaceId, view }): Promise<void>`
Validates update permissions (owner or workspace admin).

**canUserDeleteView** — `({ userWorkspaceId, workspaceId, view }): Promise<void>`
Validates delete permissions.

### view-entity-lookup.service.ts

**file: /src/engine/metadata-modules/view-permissions/services/view-entity-lookup.service.ts**

#### ViewEntityLookupService

**getViewById** — `(viewId: string, workspaceId: string): Promise<ViewEntity>`
Retrieves view entity with relations for permission checking.

---

## page-layout

Module managing page layouts for detail/form record views (tabs, widgets, layout structure).

### page-layout.service.ts

**file: /src/engine/metadata-modules/page-layout/services/page-layout.service.ts**

#### PageLayoutService

**findByWorkspaceId** — `(workspaceId: string): Promise<PageLayoutDTO[]>`
Returns all active page layouts in workspace with tabs and widgets.

**findBy** — `({ workspaceId, filter: { objectMetadataId?, pageLayoutType? } }): Promise<PageLayoutDTO[]>`
Filters layouts by object and type (DETAIL, FORM, etc.).

**findByIdOrThrow** — `({ id, workspaceId }): Promise<PageLayoutDTO>`
Finds layout with tabs/widgets, throws if not found.

**create** — `({ createPageLayoutInput, workspaceId }): Promise<Omit<PageLayoutDTO, 'tabs'>>`
Creates new layout, validates name, runs workspace migration.

**update** — `({ id, workspaceId, updateData }): Promise<Omit<PageLayoutDTO, 'tabs'>>`
Updates layout name/type, runs migration.

**destroy** — `({ id, workspaceId }): Promise<PageLayoutDTO>`
Deletes layout via migration.

**duplicate** — `({ id, workspaceId, name? }): Promise<PageLayoutDTO>`
Creates copy of layout with new name; handled by separate service.

**reset** — `({ id, workspaceId }): Promise<PageLayoutDTO>`
Resets layout to system defaults; handled by separate service.

### page-layout-duplication.service.ts

**file: /src/engine/metadata-modules/page-layout/services/page-layout-duplication.service.ts**

#### PageLayoutDuplicationService

**duplicateLayout** — `({ sourceLayoutId, workspaceId, newName? }): Promise<PageLayoutDTO>`
Creates copy of layout including all tabs and widgets with migration validation.

### page-layout-reset.service.ts

**file: /src/engine/metadata-modules/page-layout/services/page-layout-reset.service.ts**

#### PageLayoutResetService

**resetLayout** — `({ layoutId, workspaceId }): Promise<PageLayoutDTO>`
Resets custom layout to system/standard template via migration.

### page-layout-update.service.ts

**file: /src/engine/metadata-modules/page-layout/services/page-layout-update.service.ts**

#### PageLayoutUpdateService

**updateLayoutWithTabs** — `({ id, workspaceId, updateData }): Promise<PageLayoutDTO>`
Updates layout with nested tabs structure; reconciles tabs/widgets hierarchy.

### page-layout.resolver.ts

**file: /src/engine/metadata-modules/page-layout/resolvers/page-layout.resolver.ts**

#### PageLayoutResolver (GraphQL)

**getPageLayouts** — `@Query() (workspace, objectMetadataId?, pageLayoutType?): Promise<PageLayoutDTO[]>`
Returns layouts filtered by object and type.

**getPageLayout** — `@Query() (id: string, workspace): Promise<PageLayoutDTO>`
Returns single layout with full structure.

**createPageLayout** — `@Mutation() (input: CreatePageLayoutInput, workspace): Promise<PageLayoutDTO>`
Creates layout.

**updatePageLayout** — `@Mutation() (id: string, input: UpdatePageLayoutInput, workspace): Promise<PageLayoutDTO>`
Updates layout.

**destroyPageLayout** — `@Mutation() (id: string, workspace): Promise<boolean>`
Destroys layout.

**duplicatePageLayout** — `@Mutation() (id: string, name?, workspace): Promise<PageLayoutDTO>`
Duplicates layout.

**resetPageLayout** — `@Mutation() (id: string, workspace): Promise<PageLayoutDTO>`
Resets layout to standard.

### page-layout.controller.ts

**file: /src/engine/metadata-modules/page-layout/controllers/page-layout.controller.ts**

#### PageLayoutController (REST)

REST endpoints mirror resolver methods for /rest/metadata/page-layouts and /rest/metadata/page-layouts/:id paths.

---

## page-layout-tab

Module managing tabs within page layouts.

### page-layout-tab.service.ts

**file: /src/engine/metadata-modules/page-layout-tab/services/page-layout-tab.service.ts**

#### PageLayoutTabService

**createOne** — `({ createPageLayoutTabInput, workspaceId }): Promise<PageLayoutTabDTO>`
Creates tab in layout, validates parent layout exists.

**updateOne** — `({ updatePageLayoutTabInput, workspaceId }): Promise<PageLayoutTabDTO>`
Updates tab title/position.

**deleteOne** — `({ deletePageLayoutTabInput, workspaceId }): Promise<PageLayoutTabDTO>`
Soft-deletes tab and cascades to widgets.

**destroyOne** — `({ destroyPageLayoutTabInput, workspaceId }): Promise<PageLayoutTabDTO>`
Hard-deletes tab.

### page-layout-tab.resolver.ts

**file: /src/engine/metadata-modules/page-layout-tab/resolvers/page-layout-tab.resolver.ts**

GraphQL resolvers for tab CRUD operations.

---

## page-layout-widget

Module managing widgets (charts, fields, rich text, iframe, components) displayed in layout tabs.

### page-layout-widget.service.ts

**file: /src/engine/metadata-modules/page-layout-widget/services/page-layout-widget.service.ts**

#### PageLayoutWidgetService

**findByPageLayoutTabId** — `({ workspaceId, pageLayoutTabId }): Promise<PageLayoutWidgetDTO[]>`
Returns all widgets in tab, sorted by creation time.

**findByIdOrThrow** — `({ id, workspaceId }): Promise<PageLayoutWidgetDTO>`
Finds widget, throws if not found or deleted.

**create** — `({ createPageLayoutWidgetInput, workspaceId }): Promise<PageLayoutWidgetDTO>`
Creates widget with validation (chart field refs, front component refs), enriches rich text, runs migration.

**update** — `({ updatePageLayoutWidgetInput, workspaceId }): Promise<PageLayoutWidgetDTO>`
Updates widget configuration, re-validates references.

**destroy** — `({ destroyPageLayoutWidgetInput, workspaceId }): Promise<PageLayoutWidgetDTO>`
Deletes widget.

#### FlatPageLayoutWidgetTypeValidatorService

**validate** — `(widget: FlatPageLayoutWidget): PageLayoutWidgetValidationError[]`
Validates widget configuration by type (chart, field, graph, iframe, rich text, front component), returns array of errors if invalid.

### page-layout-widget.resolver.ts

**file: /src/engine/metadata-modules/page-layout-widget/resolvers/page-layout-widget.resolver.ts**

GraphQL resolvers for widget CRUD.

---

## navigation-menu-item

Module managing sidebar/navigation menu items (folders, links to objects/views/external URLs).

### navigation-menu-item.service.ts

**file: /src/engine/metadata-modules/navigation-menu-item/services/navigation-menu-item.service.ts**

#### NavigationMenuItemService

**findAll** — `({ workspaceId, userWorkspaceId?, scope?, folderId?, type?, limit? }): Promise<NavigationMenuItemDTO[]>`
Returns navigation items filtered by scope (all/workspace/user), folder, type (FOLDER, OBJECT, VIEW, CUSTOM, SETTINGS), limit; applied permissions checks.

**findById** — `({ id, workspaceId }): Promise<NavigationMenuItemDTO | null>`
Finds single item, returns null if not found.

**findByIdOrThrow** — `({ id, workspaceId }): Promise<NavigationMenuItemDTO>`
Finds item, throws exception if not found.

**create** — `({ input, workspaceId, authUserWorkspaceId?, authApiKeyId?, authApplicationId? }): Promise<NavigationMenuItemDTO>`
Creates single navigation item, delegates to createMany.

**createMany** — `({ inputs, workspaceId, authUserWorkspaceId?, authApiKeyId?, authApplicationId? }): Promise<NavigationMenuItemDTO[]>`
Creates multiple items with permission checks, handles folder ordering, resolves record identifiers for dynamic items.

**update** — `({ input, workspaceId, authUserWorkspaceId?, authApiKeyId?, authApplicationId? }): Promise<NavigationMenuItemDTO>`
Updates item title/position/payload, validates permissions.

**delete** — `({ id, workspaceId, authUserWorkspaceId?, authApiKeyId?, authApplicationId? }): Promise<NavigationMenuItemDTO>`
Soft-deletes item, triggers background job for cascading deletions.

**destroy** — `({ id, workspaceId, authUserWorkspaceId?, authApiKeyId?, authApplicationId? }): Promise<NavigationMenuItemDTO>`
Hard-deletes item.

### navigation-menu-item-access.service.ts

**file: /src/engine/metadata-modules/navigation-menu-item/services/navigation-menu-item-access.service.ts**

#### NavigationMenuItemAccessService

**canUserCreateNavigationMenuItem** — `({ userWorkspaceId, workspaceId, inputUserWorkspaceId?, apiKeyId?, applicationId? }): Promise<void>`
Validates create permissions; checks workspace membership, user scoping rights; throws PermissionsException if denied.

**canUserUpdateNavigationMenuItem** — `({ userWorkspaceId, workspaceId, item }): Promise<void>`
Validates update permissions (owner/workspace).

**canUserDeleteNavigationMenuItem** — `({ userWorkspaceId, workspaceId, item }): Promise<void>`
Validates delete permissions.

### navigation-menu-item-record-identifier.service.ts

**file: /src/engine/metadata-modules/navigation-menu-item/services/navigation-menu-item-record-identifier.service.ts**

#### NavigationMenuItemRecordIdentifierService

**resolveRecordIdentifier** — `(item: NavigationMenuItemDTO, workspaceId: string): Promise<RecordIdentifierDTO>`
For navigation items pointing to records, fetches record from workspace ORM and extracts display identifier (name, email, etc.).

### navigation-menu-item.resolver.ts

**file: /src/engine/metadata-modules/navigation-menu-item/resolvers/navigation-menu-item.resolver.ts**

GraphQL resolvers for item CRUD, includes recordIdentifier field resolver.

### navigation-menu-item.controller.ts

REST endpoints for navigation items.

### navigation-menu-item-deletion.job.ts

Background job for cascading deletion of child items when folder deleted.

### navigation-menu-item-deletion.listener.ts

Event listener triggering deletion job on soft-delete events.

### Tools (AI agent integration)

#### create-navigation-menu-item.tool.ts

**file: /src/engine/metadata-modules/navigation-menu-item/tools/create-navigation-menu-item.tool.ts**

Tool for AI agents to create navigation items via tool calling.

#### delete-navigation-menu-item.tool.ts

Tool for AI agents to delete navigation items.

#### list-navigation-menu-items.tool.ts

Tool for AI agents to list/search navigation items.

#### update-navigation-menu-item.tool.ts

Tool for AI agents to update navigation items.

#### navigation-menu-item-tool.workspace-service.ts

Workspace-scoped service supporting tool execution.

---

## command-menu-item

Module managing command palette items (global keyboard shortcut actions, navigations, AI-driven commands).

### command-menu-item.service.ts

**file: /src/engine/metadata-modules/command-menu-item/services/command-menu-item.service.ts**

#### CommandMenuItemService

**findAll** — `(workspaceId: string): Promise<CommandMenuItemDTO[]>`
Returns all command menu items sorted by position.

**findById** — `(id: string, workspaceId: string): Promise<CommandMenuItemDTO | null>`
Finds command item, returns null if not found.

**findByIdOrThrow** — `(id: string, workspaceId: string): Promise<CommandMenuItemDTO>`
Finds command item, throws if not found.

**create** — `(input: CreateCommandMenuItemInput, workspaceId: string): Promise<CommandMenuItemDTO>`
Creates command item (object redirect, page layout, front component, or path), validates payload references.

**update** — `(input: UpdateCommandMenuItemInput, workspaceId: string): Promise<CommandMenuItemDTO>`
Updates command item.

**delete** — `(id: string, workspaceId: string): Promise<CommandMenuItemDTO>`
Soft-deletes command item.

**destroy** — `(id: string, workspaceId: string): Promise<CommandMenuItemDTO>`
Hard-deletes command item.

### command-menu-item.resolver.ts

**file: /src/engine/metadata-modules/command-menu-item/resolvers/command-menu-item.resolver.ts**

GraphQL resolvers for command CRUD.

### command-menu-item.controller.ts

REST endpoints for commands.

### Utilities

#### build-navigation-interpolation-context.util.ts

**file: /src/engine/metadata-modules/command-menu-item/utils/build-navigation-interpolation-context.util.ts**

**buildNavigationInterpolationContext** — `(workspaceId: string, currentWorkspaceMemberId?: string, context?: {}): Promise<InterpolationContext>`
Builds context for template interpolation in navigation commands (workspace name, user name, current object, etc.).

#### interpolate-navigation-command-menu-item-field.util.ts

**interpolateNavigationCommandMenuItemField** — `(field: string, context: InterpolationContext): string`
Interpolates template variables like {workspaceName} or {currentObjectId} in command fields.

#### is-object-metadata-command-menu-item-payload.util.ts

**isObjectMetadataCommandMenuItemPayload** — `(payload: unknown): payload is ObjectMetadataCommandMenuItemPayload`
Type guard for object metadata payload type.

#### command-menu-item-graphql-api-exception-handler.util.ts

Utility for converting command item exceptions to GraphQL error responses.

---

## front-component

Module managing front-end custom components (embedded React components with configuration).

### front-component.service.ts

**file: /src/engine/metadata-modules/front-component/services/front-component.service.ts**

#### FrontComponentService

**findAll** — `(workspaceId: string): Promise<FrontComponentDTO[]>`
Returns all front components sorted by name.

**findById** — `(id: string, workspaceId: string): Promise<FrontComponentDTO | null>`
Finds component, returns null if not found.

**createOne** — `({ input, workspaceId, ownerFlatApplication? }): Promise<FlatFrontComponent>`
Creates front component with source code/metadata, validates code, runs migration.

**updateOne** — `({ id, update, workspaceId, ownerFlatApplication? }): Promise<FlatFrontComponent>`
Updates component code/metadata.

**destroyOne** — `({ id, workspaceId, isSystemBuild?, ownerFlatApplication? }): Promise<FlatFrontComponent>`
Deletes component.

**uploadComponentFiles** — `(componentId: string, workspaceId: string, files: FileUploadInput[]): Promise<void>`
Stores component source files in file storage service.

**downloadComponentSource** — `(componentId: string, workspaceId: string): Promise<Readable>`
Streams component source code as readable stream.

### front-component.resolver.ts

**file: /src/engine/metadata-modules/front-component/resolvers/front-component.resolver.ts**

GraphQL resolvers for component CRUD.

### front-component.controller.ts

**file: /src/engine/metadata-modules/front-component/controllers/front-component.controller.ts**

#### FrontComponentController (REST)

**POST /rest/metadata/front-components** — Uploads component with source files.

**GET /rest/metadata/front-components/:id** — Downloads component source.

### Utilities

#### get-front-component-seed-project-files.util.ts

**getFrontComponentSeedProjectFiles** — `(componentKey: string): { name: string; content: string }[]`
Generates boilerplate React component project files (package.json, tsconfig, index.tsx).

#### strip-secret-from-application-variables.ts

**stripSecretFromApplicationVariables** — `(variables: ApplicationVariable[]): ApplicationVariable[]`
Removes sensitive secret values before returning to client.

---

## flat-* modules (cache/normalized representations)

These modules provide flattened, normalized entity representations with fast lookups via `byId` and `byUniversalIdentifier` maps.

### flat-view

**file: /src/engine/metadata-modules/flat-view/**

#### WorkspaceFlatViewMapCacheService

**getOrRecomputeManyOrAllFlatEntityMaps** — From parent WorkspaceManyOrAllFlatEntityMapsCacheService
Returns flatViewMaps: { byId: Map<string, FlatView>, byUniversalIdentifier: Map<string, FlatView> }

#### Utilities

- **from-view-entity-to-flat-view.util** — Transforms ViewEntity ORM to FlatView
- **from-create-view-input-to-flat-view-to-create.util** — Converts CreateViewInput to FlatView for creation
- **from-update-view-input-to-flat-view-to-update-or-throw.util** — Converts UpdateViewInput to FlatView for updates
- **from-delete-view-input-to-flat-view-or-throw.util** — Marks FlatView with deletedAt for soft delete
- **from-destroy-view-input-to-flat-view-or-throw.util** — Prepares FlatView for hard delete
- **from-flat-view-to-view-dto.util** — Transforms FlatView to ViewDTO for responses

### flat-view-field

Similar utilities and cache service for FlatViewField normalization.

### flat-view-filter

Similar utilities and cache service for FlatViewFilter normalization.

### flat-view-filter-group

Similar utilities and cache service for FlatViewFilterGroup normalization.

### flat-view-sort

Similar utilities and cache service for FlatViewSort normalization.

### flat-view-group

Similar utilities and cache service for FlatViewGroup normalization.

### flat-view-field-group

Similar utilities and cache service for FlatViewFieldGroup normalization.

### flat-page-layout

Cache service and utilities for FlatPageLayout normalization.

**file: /src/engine/metadata-modules/flat-page-layout/**

#### Utilities

- **from-create-page-layout-input-to-flat-page-layout-to-create.util**
- **from-update-page-layout-input-to-flat-page-layout-to-update-or-throw.util**
- **from-destroy-page-layout-input-to-flat-page-layout-or-throw.util**
- **reconstruct-flat-page-layout-with-tabs-and-widgets.util** — Assembles page layout with nested tabs/widgets from flat maps

### flat-page-layout-tab

Cache service and utilities for FlatPageLayoutTab normalization.

**file: /src/engine/metadata-modules/flat-page-layout-tab/**

#### Utilities

- **from-create-page-layout-tab-input-to-flat-page-layout-tab-to-create.util**
- **from-update-page-layout-tab-input-to-flat-page-layout-tab-to-update-or-throw.util**
- **from-destroy-page-layout-tab-input-to-flat-page-layout-tab-or-throw.util**
- **reconstruct-flat-page-layout-tab-with-widgets.util** — Assembles tab with widgets from flat maps

### flat-page-layout-widget

Cache service and utilities for FlatPageLayoutWidget normalization.

**file: /src/engine/metadata-modules/flat-page-layout-widget/**

#### FlatPageLayoutWidgetTypeValidatorService

**validate** — `(widget: FlatPageLayoutWidget): PageLayoutWidgetValidationError[]`
Validates widget configuration by type using validators in `validators/utils/`.

#### Validators

- **validate-fields-flat-page-layout-widget-for-creation.util** — Validates FIELD type widgets
- **validate-graph-flat-page-layout-widget-for-creation.util** — Validates CHART type widgets
- **validate-front-component-flat-page-layout-widget-for-creation.util** — Validates FRONT_COMPONENT type
- **validate-iframe-flat-page-layout-widget-for-creation.util** — Validates IFRAME type
- **validate-base-graph-fields.util** — Validates field references in charts
- **validate-bar-chart-configuration.util** — Specific bar chart validation
- **validate-graph-configuration-by-type.util** — Routing validator for chart types

#### Utilities

- **from-create-page-layout-widget-input-to-flat-page-layout-widget-to-create.util**
- **from-update-page-layout-widget-input-to-flat-page-layout-widget-to-update-or-throw.util**
- **from-destroy-page-layout-widget-input-to-flat-page-layout-widget-or-throw.util**
- **from-page-layout-widget-configuration-to-universal-configuration.util** — Normalizes config
- **from-page-layout-widget-overrides-to-universal-overrides.util** — Normalizes overrides
- **is-flat-page-layout-widget-configuration-of-type.util** — Type guard for widget config

### flat-navigation-menu-item

Cache service and utilities for FlatNavigationMenuItem normalization.

**file: /src/engine/metadata-modules/flat-navigation-menu-item/**

#### Utilities

- **from-create-navigation-menu-item-input-to-flat-navigation-menu-item-to-create.util**
- **from-update-navigation-menu-item-input-to-flat-navigation-menu-item-to-update-or-throw.util**
- **from-delete-navigation-menu-item-input-to-flat-navigation-menu-item-or-throw.util**
- **from-destroy-navigation-menu-item-input-to-flat-navigation-menu-item-or-throw.util**
- **add-flat-navigation-menu-item-to-maps-and-update-index.util** — Inserts item into maps and updates position indices

### flat-command-menu-item

Cache service and utilities for FlatCommandMenuItem normalization.

**file: /src/engine/metadata-modules/flat-command-menu-item/**

#### Utilities

- **from-create-command-menu-item-input-to-flat-command-menu-item-to-create.util**
- **from-update-command-menu-item-input-to-flat-command-menu-item-to-update-or-throw.util**
- **from-delete-command-menu-item-input-to-flat-command-menu-item-or-throw.util**
- **from-flat-command-menu-item-to-command-menu-item-dto.util**
- **build-navigation-flat-command-menu-item.util** — Builds navigation commands with interpolation
- **seed-compare-object-metadata-for-navigation-position.util** — Positions navigation commands among seeded items

### flat-front-component

Cache service and utilities for FlatFrontComponent normalization.

**file: /src/engine/metadata-modules/flat-front-component/**

#### Utilities

- **from-create-front-component-input-to-flat-front-component-to-create.util**
- **from-update-front-component-input-to-flat-front-component-to-update-or-throw.util**
- **from-delete-front-component-input-to-flat-front-component-or-throw.util**
- **from-flat-front-component-to-front-component-dto.util**

---

## Shared Utilities (flat-entity)

Located under `/src/engine/metadata-modules/flat-entity/utils/`:

#### findFlatEntityByIdInFlatEntityMaps

`(flatEntityId: string, flatEntityMaps: FlatEntityMaps): T | undefined`
Looks up entity in byId map, returns undefined if not found.

#### findFlatEntityByIdInFlatEntityMapsOrThrow

`(flatEntityId: string, flatEntityMaps: FlatEntityMaps): T`
Throws error if entity not found by ID.

#### findFlatEntityByUniversalIdentifierOrThrow

`(universalIdentifier: string, flatEntityMaps: FlatEntityMaps): T`
Throws error if entity not found by universal identifier.

#### findManyFlatEntityByIdInFlatEntityMaps

`(flatEntityIds: string[], flatEntityMaps: FlatEntityMaps): T[]`
Returns array of entities, filtered if any not found.

#### findManyFlatEntityByIdInFlatEntityMapsOrThrow

`(flatEntityIds: string[], flatEntityMaps: FlatEntityMaps): T[]`
Throws if any entity not found by ID.

#### addFlatEntityToFlatEntityMapsOrThrow

`(flatEntity: T, flatEntityMaps: FlatEntityMaps): void`
Inserts entity into both byId and byUniversalIdentifier maps, throws on duplicate.

#### resolveEntityRelationUniversalIdentifiers

`(entity: T, relationMap: Map<string, string>): void`
Updates entity relation IDs to universal identifiers for cross-application references.

#### splitEntitiesByRemovalStrategy

`(entities: T[], removalStrategy: 'soft' | 'hard'): { entitiesToDelete: T[]; entitiesToUpdate: T[] }`
Partitions entities for soft (set deletedAt) or hard delete operations.

---

## Summary

**Total documented functions: ~150+**

Functions cover:
- Core CRUD services (create, read, update, delete, destroy) for views, filters, sorts, groups, fields
- Page layout management with tabs and widgets
- Navigation and command menu item management with permission checks
- Front component custom component management
- GraphQL and REST API resolvers/controllers
- Permission guards and access control
- Flat entity caching and normalization
- Utilities for transformation, validation, interpolation, and lookup

All services follow workspace-scoped patterns with flat entity map caching for performance, workspace migration validation for data integrity, and permission checks for security.

