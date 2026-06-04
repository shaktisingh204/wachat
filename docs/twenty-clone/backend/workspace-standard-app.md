# Workspace Standard Application & Standard Objects Prefill Data

Documentation of all exported functions, services, and utilities in the twenty-standard-application and standard-objects-prefill-data packages. These modules define the metadata builders, fixtures, and configuration for Twenty's standard CRM objects, fields, views, and application structure.

## Core Services

### twenty-standard-application.service.ts
file:engine/workspace-manager/twenty-standard-application/services/twenty-standard-application.service.ts:25

### synchronizeTwentyStandardApplicationOrThrow()
Signature: `({ workspaceId: string }) => Promise<void>`
Orchestrates synchronization of the twenty-standard application by comparing cached vs. computed flat entity maps, building migrations with system-level settings, and running validation with deferred entity deletion. Uses WorkspaceMigrationValidateBuildAndRunService for core logic and caches data via WorkspaceCacheService.

---

### prefill-front-component.service.ts
file:engine/workspace-manager/standard-objects-prefill-data/services/prefill-front-component.service.ts:28

### ensureSeeded()
Signature: `({ workspaceId: string; definitions: SeedFrontComponentDefinition[] }) => Promise<void>`
Seeds front component definitions by checking if they exist, fetching seed project files (index.tsx and index.mjs), writing both source and built files to file storage, computing MD5 checksums, and creating FrontComponent metadata entities via FrontComponentService.

---

### prefill-logic-function.service.ts
file:engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service.ts:17

### ensureSeeded()
Signature: `({ workspaceId: string; definitions: PrefilledWorkflowCodeStepLogicFunctionDefinition[] }) => Promise<void>`
Seeds logic function definitions by checking for existing entities, extracting handler source code, and creating LogicFunction metadata via LogicFunctionFromSourceService with given id, name, description, and handler code.

---

## Metadata Builders - Object & Field

### object-metadata/build-standard-flat-object-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/object-metadata/build-standard-flat-object-metadata-maps.util.ts:8

### buildStandardFlatObjectMetadataMaps()
Signature: `(args: Omit<CreateStandardObjectArgs, 'context' | 'objectName'>) => FlatEntityMaps<FlatObjectMetadata>`
Aggregates all standard object builders from STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME (all 29 objects), calls each builder with provided args, and accumulates results in FlatEntityMaps using addFlatEntityToFlatEntityMapsOrThrow.

---

### object-metadata/create-standard-flat-object-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/object-metadata/create-standard-flat-object-metadata.util.ts:12

### STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME
Object literal mapping each standard object name (attachment, blocklist, calendarChannelEventAssociation, calendarEventParticipant, calendarEvent, company, dashboard, message, messageChannelMessageAssociation, messageChannelMessageAssociationMessageFolder, messageParticipant, messageThread, note, noteTarget, opportunity, person, task, taskTarget, timelineActivity, workflow, workflowAutomatedTrigger, workflowRun, workflowVersion, workspaceMember) to a builder function. Each builder calls createStandardObjectFlatMetadata with standardized context including i18n labels, icons, and metadata configuration.

---

### object-metadata/create-standard-object-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/object-metadata/create-standard-object-flat-metadata.util.ts:33

### createStandardObjectFlatMetadata()
Signature: `<O extends AllStandardObjectName>({ context, workspaceId, standardObjectMetadataRelatedEntityIds, twentyStandardApplicationId, now }) => FlatObjectMetadata`
Constructs FlatObjectMetadata entity from CreateStandardObjectContext (name, labels, icons, flags, duplicate criteria) and related entity IDs. Resolves label/image identifier field references from STANDARD_OBJECTS schema and returns complete metadata object.

---

### field-metadata/build-standard-flat-field-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/field-metadata/build-standard-flat-field-metadata-maps.util.ts:72

### buildStandardFlatFieldMetadataMaps()
Signature: `(args: Omit<CreateStandardFieldArgs<AllStandardObjectName, FieldMetadataType>, 'context' | 'objectName'>) => FlatEntityMaps<FlatFieldMetadata>`
Iterates over all object-specific field builders (buildAttachmentStandardFlatFieldMetadatas, buildBlocklistStandardFlatFieldMetadatas, etc., 29 total), calls each with args, flattens results, and accumulates in FlatEntityMaps.

---

### field-metadata/create-standard-field-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-field-flat-metadata.util.ts:1

### createStandardFieldFlatMetadata()
Creates FlatFieldMetadata for a single field given object and field names from STANDARD_OBJECTS schema, applying context overrides (labels, descriptions, input type, validation rules) and resolving all entity ID references.

---

### field-metadata/create-standard-relation-field-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-relation-field-flat-metadata.util.ts:1

### createStandardRelationFieldFlatMetadata()
Constructs FlatFieldMetadata for relation-type fields, resolving target object and relation metadata references, handling both one-to-many and many-to-one cardinalities, and applying standard relation field defaults.

---

### field-metadata compute utilities
file:engine/workspace-manager/twenty-standard-application/utils/field-metadata/compute-*-standard-flat-field-metadata.util.ts

Collection of 29 builder functions (one per standard object: buildAttachmentStandardFlatFieldMetadatas, buildBlocklistStandardFlatFieldMetadatas, buildCalendarChannelEventAssociationStandardFlatFieldMetadatas, etc.). Each returns Record<fieldName, FlatFieldMetadata> containing all fields for that object with their metadata definitions.

---

## Metadata Builders - Views & Filters

### view/build-standard-flat-view-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view/build-standard-flat-view-metadata-maps.util.ts:1

### buildStandardFlatViewMetadataMaps()
Aggregates all standard view definitions from STANDARD_FLAT_VIEW_BUILDERS_BY_VIEW_NAME, calls each builder, and accumulates FlatViewMetadata maps. Views are defined per object (company has allCompanies, pipeline; opportunity has allOpportunities, byStage; etc.).

---

### view-field/build-standard-flat-view-field-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view-field/build-standard-flat-view-field-metadata-maps.util.ts:1

### buildStandardFlatViewFieldMetadataMaps()
Combines all view field builders (one per object, e.g., computeStandardNoteViewFields, computeStandardCompanyViewFields), calls each, flattens, and accumulates in FlatEntityMaps.

---

### view-field compute utilities
file:engine/workspace-manager/twenty-standard-application/utils/view-field/compute-standard-*-view-fields.util.ts

29 builder functions returning view field definitions per object. Example: computeStandardCompanyViewFields returns allCompanies/pipeline view fields with visibility, position, size config.

---

### view-filter/build-standard-flat-view-filter-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view-filter/build-standard-flat-view-filter-metadata-maps.util.ts:1

### buildStandardFlatViewFilterMetadataMaps()
Aggregates standard view filter definitions via STANDARD_FLAT_VIEW_FILTER_BUILDERS_BY_VIEW_NAME, calls each builder, and accumulates in FlatEntityMaps.

---

### view-filter compute utilities
file:engine/workspace-manager/twenty-standard-application/utils/view-filter/compute-standard-*-view-filters.util.ts

Specialized builders like computeStandardTaskViewFilters and computeStandardOpportunityViewFilters that create view filters per object (e.g., byStage for opportunity, myTasks for task).

---

### view-group/build-standard-flat-view-group-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view-group/build-standard-flat-view-group-metadata-maps.util.ts:1

### buildStandardFlatViewGroupMetadataMaps()
Aggregates view group builders, calls each, and accumulates FlatEntityMaps. View groups provide grouping hierarchy for views (e.g., groupByStage for opportunity pipeline view).

---

### view-group compute utilities
file:engine/workspace-manager/twenty-standard-application/utils/view-group/compute-standard-*-view-groups.util.ts

Builders like computeStandardOpportunityViewGroups and computeStandardTaskViewGroups that define group fields and keys for view aggregation.

---

### view-field-group/build-standard-flat-view-field-group-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view-field-group/build-standard-flat-view-field-group-metadata-maps.util.ts:1

### buildStandardFlatViewFieldGroupMetadataMaps()
Aggregates view field group definitions and accumulates in FlatEntityMaps. Field groups organize view fields into sections.

---

## Metadata Builders - Indexes & Indices

### index/build-standard-flat-index-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/index/build-standard-flat-index-metadata-maps.util.ts:1

### buildStandardFlatIndexMetadataMaps()
Aggregates all standard index builders (one per object), calls each with args, flattens, and accumulates in FlatEntityMaps. Indexes define database query optimization via field combinations.

---

### index/create-standard-index-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/index/create-standard-index-flat-metadata.util.ts:1

### createStandardIndexFlatMetadata()
Constructs FlatIndexMetadata for a single index given object and index names, resolving field references from STANDARD_OBJECTS schema.

---

### index compute utilities
file:engine/workspace-manager/twenty-standard-application/utils/index/compute-standard-*-flat-index-metadata.util.ts

29 builders (one per object, e.g., computeAttachmentStandardFlatIndexMetadata) returning Record<indexName, FlatIndexMetadata> for all indexes on that object.

---

## Metadata Builders - Page Layouts

### page-layout/build-standard-flat-page-layout-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout/build-standard-flat-page-layout-metadata-maps.util.ts:1

### buildStandardFlatPageLayoutMetadataMaps()
Aggregates standard page layout builders from STANDARD_FLAT_PAGE_LAYOUT_BUILDERS_BY_LAYOUT_NAME, calls each, and accumulates FlatPageLayoutMetadata maps.

---

### page-layout/create-standard-page-layout-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout/create-standard-page-layout-flat-metadata.util.ts:1

### createStandardPageLayoutFlatMetadata()
Constructs FlatPageLayoutMetadata given object name, layout config with icon, title, and metadata relationships (related object/field IDs).

---

### page-layout-tab/build-standard-flat-page-layout-tab-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout-tab/build-standard-flat-page-layout-tab-metadata-maps.util.ts:1

### buildStandardFlatPageLayoutTabMetadataMaps()
Aggregates page layout tab builders and accumulates in FlatEntityMaps. Tabs organize layout content (e.g., Details, Timeline, Activity).

---

### page-layout-widget/build-standard-flat-page-layout-widget-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout-widget/build-standard-flat-page-layout-widget-metadata-maps.util.ts:1

### buildStandardFlatPageLayoutWidgetMetadataMaps()
Aggregates page layout widget builders and accumulates in FlatEntityMaps. Widgets are UI components placed in tabs (e.g., Timeline, Kanban, Subobjects).

---

## Metadata Builders - Navigation & Commands

### navigation-menu-item/build-standard-flat-navigation-menu-item-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/navigation-menu-item/build-standard-flat-navigation-menu-item-maps.util.ts:1

### buildStandardFlatNavigationMenuItemMaps()
Aggregates navigation menu items (main, favorites, objectives) and accumulates in FlatEntityMaps. Menu items define the sidebar/main navigation structure.

---

### navigation-menu-item/create-standard-navigation-menu-item-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/navigation-menu-item/create-standard-navigation-menu-item-flat-metadata.util.ts:1

### createStandardNavigationMenuItemFlatMetadata()
Constructs FlatNavigationMenuItemMetadata with type (object, folder, label, separator), position, and relationships to views or sub-items.

---

### navigation-menu-item/create-standard-navigation-menu-item-folder-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/navigation-menu-item/create-standard-navigation-menu-item-folder-flat-metadata.util.ts:1

### createStandardNavigationMenuItemFolderFlatMetadata()
Creates folder-type navigation menu items for grouping multiple menu items hierarchically.

---

### command-menu-item/build-standard-flat-command-menu-item-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/command-menu-item/build-standard-flat-command-menu-item-maps.util.ts:1

### buildStandardFlatCommandMenuItemMaps()
Aggregates command menu items and accumulates in FlatEntityMaps. Command menu items provide quick-access commands (e.g., create company, search).

---

### command-menu-item/create-standard-command-menu-item-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/command-menu-item/create-standard-command-menu-item-flat-metadata.util.ts:1

### createStandardCommandMenuItemFlatMetadata()
Constructs FlatCommandMenuItemMetadata with action type, shortcut keys, and related object/view references.

---

## Metadata Builders - Roles, Skills, & Agents

### role-metadata/build-standard-flat-role-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/role-metadata/build-standard-flat-role-metadata-maps.util.ts:1

### buildStandardFlatRoleMetadataMaps()
Aggregates all standard roles (admin, member, guest) and accumulates in FlatEntityMaps.

---

### skill-metadata/build-standard-flat-skill-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-standard-flat-skill-metadata-maps.util.ts:1

### buildStandardFlatSkillMetadataMaps()
Aggregates all standard skills and accumulates in FlatEntityMaps. Skills define agent capabilities.

---

### agent-metadata/build-standard-flat-agent-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/agent-metadata/build-standard-flat-agent-metadata-maps.util.ts:1

### buildStandardFlatAgentMetadataMaps()
Aggregates all standard agents and accumulates in FlatEntityMaps. Agents are automation entities with triggered actions.

---

### agent-metadata/create-standard-agent-flat-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/agent-metadata/create-standard-agent-flat-metadata.util.ts:1

### createStandardAgentFlatMetadata()
Constructs FlatAgentMetadata with name, description, enabled flag, and trigger/action configuration.

---

## Metadata Builders - Permissions & Features

### permission-flag/build-standard-flat-permission-flag-metadata-maps.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/permission-flag/build-standard-flat-permission-flag-metadata-maps.util.ts:1

### buildStandardFlatPermissionFlagMetadataMaps()
Aggregates permission flags and accumulates in FlatEntityMaps. Flags control feature availability per workspace (e.g., mobile UI, calendar sync).

---

## Main Orchestration

### twenty-standard-application-all-flat-entity-maps.constant.ts
file:engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant.ts:34

### computeTwentyStandardApplicationAllFlatEntityMaps()
Signature: `({ now: string, workspaceId: string, twentyStandardApplicationId: string }) => { allFlatEntityMaps: TwentyStandardAllFlatEntityMaps, idByUniversalIdentifierByMetadataName: IdByUniversalIdentifierByMetadataName }`
Master orchestrator that chains all metadata builders in dependency order: objects → fields → indexes → views → viewGroups → viewFieldGroups → viewFilters → viewFields → roles → permissions → agents → skills → pageLayouts → pageLayoutTabs → pageLayoutWidgets → navigationMenuItems → commandMenuItems. Returns combined flat entity maps and a legacy ID mapping.

---

## Entity ID Generation

### get-standard-object-metadata-related-entity-ids.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/get-standard-object-metadata-related-entity-ids.util.ts:129

### getStandardObjectMetadataRelatedEntityIds()
Signature: `() => StandardObjectMetadataRelatedEntityIds`
Generates UUIDs for all standard objects, their fields, and associated views (including viewFields, viewGroups, viewFieldGroups) by iterating STANDARD_OBJECTS schema and calling v4() for each entity.

---

### computeStandardViewObjectIds()
Signature: `<O extends AllStandardObjectName>({ objectName: O }) => StandardObjectViewIds<O> | undefined`
Recursively generates view IDs for an object by reading STANDARD_OBJECTS view definitions and creating UUID mappings for each viewField, viewGroup, and viewFieldGroup.

---

### get-standard-page-layout-metadata-related-entity-ids.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/get-standard-page-layout-metadata-related-entity-ids.util.ts:1

### getStandardPageLayoutMetadataRelatedEntityIds()
Generates UUIDs for all page layouts, tabs, and widgets by reading layout configuration and assigning v4() to each.

---

## Constants & Configurations

### constants/twenty-standard-all-metadata-name.constant.ts
file:engine/workspace-manager/twenty-standard-application/constants/twenty-standard-all-metadata-name.constant.ts

### TWENTY_STANDARD_ALL_METADATA_NAME
Array of all metadata type names: ['index', 'objectMetadata', 'fieldMetadata', 'viewField', 'viewFieldGroup', 'viewFilter', 'viewGroup', 'view', 'navigationMenuItem', 'permissionFlag', 'role', 'agent', 'skill', 'pageLayout', 'pageLayoutTab', 'pageLayoutWidget', 'commandMenuItem', 'logicFunction', 'frontComponent'].

---

### constants/twenty-standard-applications.ts
file:engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications.ts

### TWENTY_STANDARD_APPLICATION
Metadata constant with universalIdentifier, name, version (1.0.1), sourceType (LOCAL), and description.

---

### constants/standard-*.constant.ts
file:engine/workspace-manager/twenty-standard-application/constants/

Collection of configuration objects:
- STANDARD_NAVIGATION_MENU_ITEMS: Defines sidebar menu (allCompanies, allPeople, allOpportunities, etc.) with types, positions, and view references
- STANDARD_COMMAND_MENU_ITEMS: Quick-action commands with shortcut keys
- STANDARD_ROLE: Role definitions (admin, member, guest)
- STANDARD_SKILL: Skill definitions for agents
- STANDARD_AGENT: Agent definitions with triggers and actions
- TWENTY_CLI_APPLICATION_REGISTRATION: CLI application metadata

---

### constants/standard-page-layout*.constant.ts
file:engine/workspace-manager/twenty-standard-application/constants/standard-page-layout.constant.ts & standard-page-layout-tabs.template.ts

- STANDARD_PAGE_LAYOUTS: Maps object names to page layout configurations
- CONDITIONAL_DISPLAY_DEVICE_MOBILE, etc.: Template constants for conditionally-displayed UI elements

---

### utils/page-layout-config/standard-*-page-layout.config.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout-config/

18 object-specific page layout configs (company, opportunity, person, task, note, etc.) defining:
- Tabs (Details, Activity, Timeline, Relationships, etc.)
- Widgets per tab (ActivityMessages, ActivityTimeline, SubObjectsRelations, etc.)
- Conditional display for mobile/desktop

---

## Utility Functions

### i18n-label.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/i18n-label.util.ts:3

### i18nLabel()
Signature: `(descriptor: MessageDescriptor) => string`
Extracts message text from Lingui MessageDescriptor for UI labels. Used in all metadata builders for i18n field/object labels.

---

## Prefill Data Utilities

### prefill-companies.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-companies.util.ts:10

### prefillCompanies()
Signature: `(entityManager: EntityManager, schemaName: string) => Promise<void>`
Inserts 5 sample companies (Airbnb, Anthropic, Stripe, Figma, Notion) with domain URLs, addresses, employee counts, and system metadata (createdBySource, timestamps). Uses orIgnore() for idempotency.

---

### prefill-people.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-people.util.ts

### prefillPeople()
Inserts sample people linked to companies with names, emails, phone numbers, avatars, and system metadata.

---

### prefill-opportunities.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-opportunities.util.ts

### prefillOpportunities()
Inserts sample opportunities linked to companies with names, amounts, stages, and metadata.

---

### prefill-workflows.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflows.util.ts

### prefillWorkflows()
Inserts sample workflow templates with triggers and actions.

---

### prefill-dashboards.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-dashboards.util.ts

### prefillDashboards()
Inserts sample dashboard definitions with widgets and configurations.

---

### prefill-front-component-definitions.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-front-component-definitions.util.ts

### SeedFrontComponentDefinition
Type and definitions for seeded front components with id, name, description, componentName, seedProjectSubdir, isHeadless.

---

### prefill-workflow-code-step-logic-functions.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util.ts

### PrefilledWorkflowCodeStepLogicFunctionDefinition
Type and definitions for seeded logic functions with id, name, description, sourceHandlerCode.

---

### prefill-workflow-command-menu-items.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-command-menu-items.util.ts

Defines command menu items for workflow-related actions.

---

### prefill-front-component-command-menu-items.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-front-component-command-menu-items.util.ts

Defines command menu items for front component creation/management.

---

## Type Definitions

### types/all-standard-*.type.ts
file:engine/workspace-manager/twenty-standard-application/types/

Collection of discriminated union types derived from STANDARD_OBJECTS schema:
- AllStandardObjectName: Union of all object names
- AllStandardObjectFieldName<T>: Field names for a specific object
- AllStandardObjectViewName<T>: View names for an object
- AllStandardObjectViewFieldName<T, V>: Fields in a view
- AllStandardObjectIndexName<T>: Index names for an object
- AllStandardObjectViewGroupName<T, V>: Groups in a view
- AllStandardObjectViewFieldGroupName<T, V>: Field groups in a view
- AllStandardAgentName, AllStandardRoleName, AllStandardSkillName: Union types for those entities

---

### types/metadata-standard-buillder-args.type.ts
file:engine/workspace-manager/twenty-standard-application/types/metadata-standard-buillder-args.type.ts:16

### StandardBuilderArgs<T>
Generic type combining:
- standardObjectMetadataRelatedEntityIds: Pre-generated UUIDs for objects/fields/views
- dependencyFlatEntityMaps: Already-built maps for dependent metadata
- ComputeTwentyStandardApplicationAllFlatEntityMapsArgs: Timestamp, workspace/application IDs

---

### types/twenty-standard-all-flat-entity-maps.type.ts
file:engine/workspace-manager/twenty-standard-application/types/twenty-standard-all-flat-entity-maps.type.ts

### TwentyStandardAllFlatEntityMaps
Pick of AllFlatEntityMaps constrained to the 18 metadata types defined in TWENTY_STANDARD_ALL_METADATA_NAME.

---

## Modules

### twenty-standard-application.module.ts
file:engine/workspace-manager/twenty-standard-application/twenty-standard-application.module.ts

NestJS module exporting TwentyStandardApplicationService with dependencies: ApplicationModule, TwentyConfigModule, WorkspaceCacheModule, WorkspaceMigrationModule, GlobalWorkspaceDataSourceModule, WorkspaceManyOrAllFlatEntityMapsCacheModule.

---

### standard-objects-prefill.module.ts
file:engine/workspace-manager/standard-objects-prefill-data/standard-objects-prefill.module.ts

NestJS module exporting PrefillLogicFunctionService and PrefillFrontComponentService with dependencies: LogicFunctionModule, FrontComponentModule, FileStorageModule, ApplicationModule, WorkspaceManyOrAllFlatEntityMapsCacheModule.


---

## View Builders - Object-Specific

### view/compute-standard-*-views.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/view/

29 builder functions (one per object) returning view definitions. Examples:
- computeStandardCompanyViews: Returns allCompanies and pipeline views
- computeStandardOpportunityViews: Returns allOpportunities and byStage views
- computeStandardPersonViews: Returns allPeople view
- computeStandardTaskViews: Returns myTasks and allTasks views

Each builder returns Record<viewName, FlatView> with full metadata.

---

## Index Builders - Object-Specific

### index/compute-standard-*-flat-index-metadata.util.ts
file:engine/workspace-manager/twenty-standard-application/utils/index/

29 builder functions (one per object) returning index definitions. Each returns Record<indexName, FlatIndexMetadata> defining database query optimization via field combinations per object.

---

## Page Layout Config

### page-layout-config/index.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout-config/index.ts

Barrel export aggregating all 18 page layout config objects.

---

### page-layout-config/standard-*-page-layout.config.ts
file:engine/workspace-manager/twenty-standard-application/utils/page-layout-config/

18 object-specific configuration files (company, opportunity, person, task, note, dashboard, message, workflow, etc.) each exporting a CONFIG object (e.g., STANDARD_COMPANY_PAGE_LAYOUT_CONFIG) defining:
- Tabs array with id, title, icon, order, defaultSizeConfig
- Widgets per tab with type (ActivityMessages, ActivityTimeline, SubObjectsRelations, etc.), position, size
- Conditional display rules (showOnDesktop, showOnMobile)

---

## Type Definitions - Metadata Args

### Types for builders
Types used across builders define argument contracts:
- CreateStandardObjectArgs<O>: Object metadata builder args
- CreateStandardFieldArgs<O, F>: Field metadata builder args
- CreateStandardViewArgs<O>: View metadata builder args
- CreateStandardIndexArgs<O>: Index metadata builder args
- CreateStandardPageLayoutContext: Page layout metadata args

---

## Integration Points

All builders follow a consistent pattern:
1. Export a main aggregation function (e.g., buildStandardFlatObjectMetadataMaps)
2. Call object-specific sub-builders (e.g., STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME)
3. Accumulate results in FlatEntityMaps using addFlatEntityToFlatEntityMapsOrThrow
4. Return FlatEntityMaps<T> for the metadata type

This modular structure allows:
- Per-object customization via dedicated compute functions
- Incremental dependency building (objects → fields → indexes → views, etc.)
- Easy testing of individual object/field definitions
- Clean type safety with strict TypeScript generics

---

## Build Process Summary

When computeTwentyStandardApplicationAllFlatEntityMaps() is called:

1. **Entity IDs generated**: getStandardObjectMetadataRelatedEntityIds() creates UUIDs for all objects, fields, views, and indexes
2. **Objects built**: buildStandardFlatObjectMetadataMaps() aggregates 29 objects with descriptors, icons, and system flags
3. **Fields built**: buildStandardFlatFieldMetadataMaps() defines 200+ fields across objects with types, validations, and relations
4. **Indexes built**: buildStandardFlatIndexMetadataMaps() creates database optimization hints
5. **Views built**: buildStandardFlatViewMetadataMaps() defines 20+ views per object (allCompanies, byStage, myTasks, etc.)
6. **View groups built**: Groups for aggregation (byStage for opportunity, byStatus for task)
7. **View field groups built**: Sections within views
8. **View filters built**: Predefined filters (my tasks, closed deals, etc.)
9. **View fields built**: Column/field selections per view with visibility and ordering
10. **Roles built**: admin, member, guest with permissions
11. **Permission flags built**: Feature toggles (mobile UI, calendar sync, etc.)
12. **Agents built**: Automation agents with triggers
13. **Skills built**: Capabilities for agents
14. **Page layouts built**: UI frame definitions (company detail page, opportunity kanban, etc.)
15. **Page layout tabs built**: Sections (Details, Timeline, Activity)
16. **Page layout widgets built**: Components (ActivityTimeline, SubObjects, etc.)
17. **Navigation menu items built**: Sidebar structure (allCompanies, allPeople, etc.)
18. **Command menu items built**: Quick actions (create, search, etc.)

All results aggregated into TwentyStandardAllFlatEntityMaps and returned along with legacy ID mappings.


---

## Prefill Data Builders - Details

### prefill-front-component-definitions.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-front-component-definitions.util.ts

### SeedFrontComponentDefinition
Type defining a front component seed with: id (UUID), universalIdentifier, name, description, componentName, isHeadless flag, usesSdkClient flag, seedProjectSubdir (path to project files).

### getSeedFrontComponentIds()
Signature: `(workspaceId: string) => { helloWorldId: string, showNotificationId: string }`
Generates stable UUIDs for seed components (hello-world, show-notification) scoped to workspace using uuidv5 with SEED_FRONT_COMPONENT_ID_NAMESPACE.

### getSeedFrontComponentDefinitions()
Signature: `(workspaceId: string) => SeedFrontComponentDefinition[]`
Returns array of two seed front components: HelloWorld (visual) and ShowNotification (headless). Both include source paths to project subdirectories.

### SeedFrontComponentCommandMenuItemDefinition
Type defining command menu entry for front component with: universalIdentifier, frontComponentId, label, icon, position, optional isPinned, optional pageLayoutId.

### getSeedFrontComponentCommandMenuItemDefinitions()
Signature: `(workspaceId: string) => SeedFrontComponentCommandMenuItemDefinition[]`
Returns 3 command menu items for seed components: two inline (HelloWorld, ShowNotification) and one standalone page (ShowNotification pinned to documentation page).

---

### prefill-workflow-code-step-logic-functions.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util.ts

### getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionIds()
Signature: `(workspaceId: string) => { extractDomainLogicFunctionId: string, findMatchingCompanyByDomainLogicFunctionId: string, isPersonalEmailLogicFunctionId: string }`
Generates stable UUIDs for 3 workflow helper logic functions scoped to workspace using uuidv5.

### PrefilledWorkflowCodeStepLogicFunctionDefinition
Type for logic function seed with: id (UUID), name, description, sourceHandlerCode (JavaScript function source).

### getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions()
Signature: `(workspaceId: string) => PrefilledWorkflowCodeStepLogicFunctionDefinition[]`
Returns 3 logic function definitions:
1. **Extract domain from email**: Parses email domain using psl library, returns normalized domain and URL
2. **Find matching company by domain**: Searches existing companies by matching their website domain
3. **Is this a personal email?**: Checks if email is from common personal providers (gmail, outlook, yahoo, etc.) using hardcoded domain set

---

### prefill-workflows.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflows.util.ts

### Workflow IDs (Constants)
- QUICK_LEAD_WORKFLOW_ID: UUID for example quick-lead workflow
- CREATE_COMPANY_WHEN_ADDING_NEW_PERSON_WORKFLOW_ID: UUID for automation workflow
- CREATE_COMPANY_WHEN_ADDING_NEW_PERSON_WORKFLOW_VERSION_ID: UUID for workflow version
- CREATE_COMPANY_WHEN_ADDING_NEW_PERSON_AUTOMATED_TRIGGER_ID: UUID for automation trigger

### prefillWorkflows()
Signature: `(entityManager: EntityManager, workspaceId: string, schemaName: string, flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>) => Promise<void>`
Seeds workflow definitions with sample templates. Uses logic function IDs to build workflow step configuration, generates fake object record events, and inserts workflow + version + trigger records into workspace database.

---

### prefill-people.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-people.util.ts

### People IDs (Constants)
- BRIAN_CHESKY_ID, DARIO_AMODEI_ID, DYLAN_FIELD_ID, IVAN_ZHAO_ID, PATRICK_COLLISON_ID: UUIDs for sample people

### prefillPeople()
Signature: `(entityManager: EntityManager, schemaName: string) => Promise<void>`
Inserts 5 sample people (founders: Chesky, Amodei, Field, Zhao, Collison) linked to companies (Airbnb, Anthropic, Figma, Notion, Stripe) with names, emails, phones, avatars, and system metadata.

---

### prefill-opportunities.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-opportunities.util.ts

### Opportunity IDs (Constants)
- OPPORTUNITY_STRIPE_PLATFORM_MIGRATION_ID
- OPPORTUNITY_ANTHROPIC_AI_MODEL_ID
- OPPORTUNITY_NOTION_WORKSPACE_ID
- OPPORTUNITY_STRIPE_API_INTEGRATION_ID
- OPPORTUNITY_AIRBNB_ENTERPRISE_ID
- OPPORTUNITY_FIGMA_DESIGN_ID

### prefillOpportunities()
Signature: `(entityManager: EntityManager, schemaName: string) => Promise<void>`
Inserts 6 sample opportunities across companies with names, amounts, stages, expected close dates, and linked to people/companies. Fetches workspace member for ownership assignment.

---

### prefill-dashboards.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-dashboards.util.ts

### prefillDashboards()
Inserts sample dashboard definitions with widget configurations and layout information.

---

### prefill-workflow-command-menu-items.util.ts
file:engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-command-menu-items.util.ts

Defines command menu items for workflow-related quick actions (create workflow, view templates, etc.).

---

## File Organization Summary

### twenty-standard-application/
- **services/**: TwentyStandardApplicationService (orchestration)
- **constants/**: TWENTY_STANDARD_ALL_METADATA_NAME, TWENTY_STANDARD_APPLICATION, STANDARD_NAVIGATION_MENU_ITEMS, STANDARD_COMMAND_MENU_ITEMS, STANDARD_ROLE, STANDARD_SKILL, STANDARD_AGENT, TWENTY_CLI_APPLICATION_REGISTRATION, page layout configs
- **types/**: AllStandardObjectName, AllStandardObjectFieldName, AllStandardObjectViewName, etc. (TypeScript union types)
- **utils/**:
  - **object-metadata/**: Object builders (29 objects)
  - **field-metadata/**: Field builders (29 objects × ~7 fields avg)
  - **index/**: Index builders (29 objects)
  - **view/**: View builders (29 objects)
  - **view-field/**: View field builders (29 objects × ~2 views avg)
  - **view-field-group/**: View field group builders
  - **view-filter/**: View filter builders (select objects)
  - **view-group/**: View group builders (select objects)
  - **page-layout/**: Page layout builders (18 objects)
  - **page-layout-tab/**: Page layout tab builders
  - **page-layout-widget/**: Page layout widget builders
  - **page-layout-config/**: Static layout configs (18 files)
  - **navigation-menu-item/**: Navigation menu builders
  - **command-menu-item/**: Command menu builders
  - **role-metadata/**: Role builders (3 roles)
  - **skill-metadata/**: Skill builders
  - **agent-metadata/**: Agent builders
  - **permission-flag/**: Permission flag builders
  - **get-standard-*-metadata-related-entity-ids.util.ts**: UUID generators
  - **twenty-standard-application-all-flat-entity-maps.constant.ts**: Master orchestrator
  - **i18n-label.util.ts**: i18n utility

### standard-objects-prefill-data/
- **services/**:
  - PrefillFrontComponentService: Seeds front components from project files
  - PrefillLogicFunctionService: Seeds logic functions from source code
- **utils/**:
  - prefill-companies.util.ts: 5 sample companies
  - prefill-people.util.ts: 5 sample people
  - prefill-opportunities.util.ts: 6 sample opportunities
  - prefill-workflows.util.ts: Sample workflow templates
  - prefill-dashboards.util.ts: Sample dashboards
  - prefill-front-component-definitions.util.ts: 2 sample front components
  - prefill-workflow-code-step-logic-functions.util.ts: 3 workflow helper functions
  - prefill-workflow-command-menu-items.util.ts: Workflow command menu
  - prefill-front-component-command-menu-items.util.ts: Front component command menu

---

## Coverage Summary

**Total exported functions, classes, constants documented**: 120+

**Not yet covered** (due to 213 total files and token constraints, these files were sampled but not exhaustively documented):
- Individual compute-standard-*-flat-field-metadata.util.ts builders (29 files) - each exports 1 builder function
- Individual compute-standard-*-flat-index-metadata.util.ts builders (29 files) - each exports 1 builder function
- Individual compute-standard-*-view-fields.util.ts builders (29 files) - each exports 1 builder function
- Individual compute-standard-*-view-*.util.ts builders for view/view-filter/view-group (50+ files) - each exports 1-2 builder functions
- Individual standard-*-page-layout.config.ts files (18 files) - each exports 1 CONFIG constant
- Other specialized builders in create-standard-*.util.ts files across all metadata types

These follow consistent patterns and are referenced in the aggregate builder maps documented above.

