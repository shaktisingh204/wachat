# Masterplan Chunk 15 Analysis

## CRM Sales Pages
### `/src/app/dashboard/crm/sales-crm/forms/[formId]/edit/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/[formId]/edit/page.tsx`
- **Current Features**: Provides the form builder and editor for CRM form definitions. 
- **Possible Features**: Add drag-and-drop enhancements and conditional field logic.
- **Errors**: Lacks robust client-side validation before dispatching save action.
- **Enhancement Plan**: Migrate to a more reactive form editor UI with real-time preview side-by-side.

### `/src/app/dashboard/crm/sales-crm/forms/[formId]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/[formId]/page.tsx`
- **Current Features**: Displays a detailed view of a specific CRM form, sharing integration links and performance KPIs.
- **Possible Features**: Embedded analytics (conversion rates, drop-offs).
- **Errors**: Hardcoded assumptions about URL generation for public links might fail in custom domains.
- **Enhancement Plan**: Add copyable iFrame snippets and dynamic public URL generation based on environment variables.

### `/src/app/dashboard/crm/sales-crm/forms/[formId]/submissions/[submissionId]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/[formId]/submissions/[submissionId]/page.tsx`
- **Current Features**: Displays the data submitted for a specific form instance.
- **Possible Features**: 1-click export to PDF, "convert to lead/contact" buttons.
- **Errors**: No sanitization indicated for raw text field renders.
- **Enhancement Plan**: Build a generic renderer for form responses mapped to custom field types.

### `/src/app/dashboard/crm/sales-crm/forms/[formId]/submissions/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/[formId]/submissions/page.tsx`
- **Current Features**: Lists all submissions for a form with pagination and basic filtering.
- **Possible Features**: Bulk actions (export, tag, delete).
- **Errors**: Potential performance issue if fetching thousands of submissions without server-side pagination.
- **Enhancement Plan**: Implement virtualized rows and server-side filtering.

### `/src/app/dashboard/crm/sales-crm/forms/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/new/page.tsx`
- **Current Features**: Wrapper for creating a new form instance.
- **Possible Features**: Form templates to start quickly (e.g. "Contact Us", "Lead Gen").
- **Errors**: No strict check for tenant quota limits.
- **Enhancement Plan**: Provide a wizard UI instead of a basic settings form.

### `/src/app/dashboard/crm/sales-crm/forms/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/forms/page.tsx`
- **Current Features**: Lists all CRM forms with their active/inactive status.
- **Possible Features**: Group forms by category or tags.
- **Errors**: Standard list view lacking bulk archival.
- **Enhancement Plan**: Add quick toggle switches for active/inactive status directly in the list.

### `/src/app/dashboard/crm/sales-crm/lead-source-report/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/lead-source-report/page.tsx`
- **Current Features**: Visualizes where leads come from using recharts.
- **Possible Features**: Multi-dimensional filtering (date range + source).
- **Errors**: Hardcoded colors in recharts can conflict with dark mode.
- **Enhancement Plan**: Use CSS variables for chart colors to respect user themes.

### `/src/app/dashboard/crm/sales-crm/leads/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/leads/page.tsx`
- **Current Features**: Main lead database with Kanban/Table view toggling.
- **Possible Features**: Inline editing and mass assignment.
- **Errors**: High chance of hydration mismatches in table-to-kanban flip if not unmounted cleanly.
- **Enhancement Plan**: Optimize the state management between Kanban and Table views to share the same data context.

### `/src/app/dashboard/crm/sales-crm/leads-summary/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/leads-summary/page.tsx`
- **Current Features**: Dashboard for lead health, conversions, and metrics.
- **Possible Features**: AI-based predictive lead scoring.
- **Errors**: Aggregation might slow down the page on large datasets.
- **Enhancement Plan**: Cache the summary aggregations using Redis or Next.js ISR.

### `/src/app/dashboard/crm/sales-crm/notes/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/notes/page.tsx`
- **Current Features**: Global notes directory.
- **Possible Features**: Rich text support, @mentions.
- **Errors**: Global fetch could overfetch if not chunked.
- **Enhancement Plan**: Add full-text search capability.

### `/src/app/dashboard/crm/sales-crm/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/page.tsx`
- **Current Features**: CRM hub page overview.
- **Possible Features**: Customizable widgets.
- **Errors**: Missing error boundaries around individual stat cards.
- **Enhancement Plan**: Use React Suspense boundaries around each widget to prevent total page failure.

### `/src/app/dashboard/crm/sales-crm/pipeline-stages/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/pipeline-stages/page.tsx`
- **Current Features**: Defines stages within a pipeline, allowing reordering.
- **Possible Features**: Enforce required fields upon entering a stage.
- **Errors**: Reordering mutations need optimistic UI to avoid sluggish feel.
- **Enhancement Plan**: Implement `dnd-kit` for smooth drag and drop reordering of stages.

### `/src/app/dashboard/crm/sales-crm/pipelines/[pipelineId]/edit/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/pipelines/[pipelineId]/edit/page.tsx`
- **Current Features**: Form to edit a specific pipeline configuration.
- **Possible Features**: Automations tied to the pipeline.
- **Errors**: None apparent, standard form.
- **Enhancement Plan**: Consolidate edit and create into a shared form component.

### `/src/app/dashboard/crm/sales-crm/pipelines/[pipelineId]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/pipelines/[pipelineId]/page.tsx`
- **Current Features**: Displays pipeline details.
- **Possible Features**: Visual representation of the pipeline flowchart.
- **Errors**: Standard view page.
- **Enhancement Plan**: Add analytics specific to the pipeline.

### `/src/app/dashboard/crm/sales-crm/pipelines/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/pipelines/new/page.tsx`
- **Current Features**: Creation form for pipelines.
- **Possible Features**: Template pipelines (e.g. "B2B Sales", "SaaS").
- **Errors**: Minimal validation.
- **Enhancement Plan**: Add default stages automatically upon creation.

### `/src/app/dashboard/crm/sales-crm/pipelines/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/pipelines/page.tsx`
- **Current Features**: List of all configured pipelines.
- **Possible Features**: Set default pipeline.
- **Errors**: None.
- **Enhancement Plan**: Show quick metrics (deals count, total value) per pipeline on this list.

### `/src/app/dashboard/crm/sales-crm/products/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/products/page.tsx`
- **Current Features**: Manages products used in deals/proposals.
- **Possible Features**: Inventory tracking integration.
- **Errors**: Standard CRUD missing bulk import/export.
- **Enhancement Plan**: Add CSV import functionality for products.

### `/src/app/dashboard/crm/sales-crm/settings/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/settings/page.tsx`
- **Current Features**: Sales CRM module settings.
- **Possible Features**: Default deal rotting times.
- **Errors**: Settings mutation can be slow.
- **Enhancement Plan**: Add a sticky save bar and auto-save capabilities.

### `/src/app/dashboard/crm/sales-crm/sources/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/sources/page.tsx`
- **Current Features**: Dictionary of lead sources.
- **Possible Features**: UTM mapping to sources.
- **Errors**: None.
- **Enhancement Plan**: Allow merging duplicate sources.

### `/src/app/dashboard/crm/sales-crm/statuses/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/statuses/page.tsx`
- **Current Features**: Defines statuses for entities.
- **Possible Features**: Color coding statuses.
- **Errors**: None.
- **Enhancement Plan**: Standardize status colors across the app using a theme map.

### `/src/app/dashboard/crm/sales-crm/tasks/[id]/activity/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/tasks/[id]/activity/page.tsx`
- **Current Features**: Audit timeline for a task.
- **Possible Features**: Filter by event type (status change, comment).
- **Errors**: None.
- **Enhancement Plan**: Integrate comment input directly into the timeline.

### `/src/app/dashboard/crm/sales-crm/tasks/[id]/edit/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/tasks/[id]/edit/page.tsx`
- **Current Features**: Task edit form.
- **Possible Features**: Add subtasks.
- **Errors**: Date pickers might have timezone edge cases.
- **Enhancement Plan**: Ensure all task dates are stored in UTC and parsed to the user's timezone.

### `/src/app/dashboard/crm/sales-crm/tasks/[id]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/tasks/[id]/page.tsx`
- **Current Features**: Task detail view with linked entities.
- **Possible Features**: Rich text description rendering.
- **Errors**: Missing fallback if the linked entity is deleted.
- **Enhancement Plan**: Handle orphaned linked entities gracefully.

### `/src/app/dashboard/crm/sales-crm/tasks/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/tasks/new/page.tsx`
- **Current Features**: Form for creating tasks.
- **Possible Features**: Recurring tasks.
- **Errors**: None.
- **Enhancement Plan**: Add a quick "Assign to me" button.

### `/src/app/dashboard/crm/sales-crm/tasks/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/tasks/page.tsx`
- **Current Features**: Task list with Kanban, Table, and Calendar views.
- **Possible Features**: Drag and drop on the calendar view.
- **Errors**: Switching views might cause flicker.
- **Enhancement Plan**: Retain view preference in URL or local storage.

### `/src/app/dashboard/crm/sales-crm/team-sales-report/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/sales-crm/team-sales-report/page.tsx`
- **Current Features**: Sales team performance charts.
- **Possible Features**: Leaderboard gamification.
- **Errors**: Chart responsiveness on mobile needs checking.
- **Enhancement Plan**: Improve tooltip styling in Recharts.

## CRM Search
### `/src/app/dashboard/crm/search/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/search/page.tsx`
- **Current Features**: Global search across all CRM entities with grouped results. Reads `?q=` from URL.
- **Possible Features**: Keyboard shortcuts (Cmd+K) to open search anywhere, recent searches list.
- **Errors**: No explicit caching or debouncing of the query param parsing (debouncing is client-side).
- **Enhancement Plan**: Add filtering toggles (e.g., search ONLY in contacts).

## CRM Service Contracts
### `/src/app/dashboard/crm/service-contracts/[id]/activity/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/service-contracts/[id]/activity/page.tsx`
- **Current Features**: Audit timeline for a specific service contract.
- **Possible Features**: Export timeline to PDF for compliance.
- **Errors**: Standard wrapper, relies heavily on `EntityAuditTimeline` component.
- **Enhancement Plan**: Combine with the main detail page as a tab to reduce navigation.

### `/src/app/dashboard/crm/service-contracts/[id]/edit/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/service-contracts/[id]/edit/page.tsx`
- **Current Features**: Edit form for an AMC (Annual Maintenance Contract). Contains a right rail with summary metrics.
- **Possible Features**: Amendment history tracking.
- **Errors**: Handled date formats are raw, potential localization issues with `en-IN` hardcoded in `fmtMoney`.
- **Enhancement Plan**: Pull `en-IN` and `INR` from the company profile settings dynamically.

### `/src/app/dashboard/crm/service-contracts/[id]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/service-contracts/[id]/page.tsx`
- **Current Features**: Detailed view of a service contract (AMC), including coverage details, visit schedule, and billing history.
- **Possible Features**: Quick action to generate a visit ticket directly from the contract.
- **Errors**: Hardcoded `en-IN` format for money. The billing history section is a stub (`TODO 1D.2: billing-history child collection not yet implemented`).
- **Enhancement Plan**: Implement the billing history sub-collection and fix hardcoded localizations.

### `/src/app/dashboard/crm/service-contracts/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/service-contracts/new/page.tsx`
- **Current Features**: Creation form for service contracts with dual-write entity pickers (customer, technician).
- **Possible Features**: Auto-calculate end date based on start date and frequency.
- **Errors**: The state error is generic. Missing client-side constraints on End Date being after Start Date.
- **Enhancement Plan**: Add dynamic date validation and auto-fill defaults.

### `/src/app/dashboard/crm/service-contracts/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/service-contracts/page.tsx`
- **Current Features**: List of all AMCs connected directly to MongoDB `crm_amc_contracts`.
- **Possible Features**: Visual indicators for expiring soon.
- **Errors**: Fetching is done directly in the page rather than an action, breaking the pattern used elsewhere.
- **Enhancement Plan**: Move the database query to a dedicated action file to centralize data fetching and security.

## CRM Service Catalog
### `/src/app/dashboard/crm/services/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/services/page.tsx`
- **Current Features**: Catalog of services with inline create/edit dialog. KPI strip, bulk actions, image uploading via SabFiles.
- **Possible Features**: Bundle services into packages.
- **Errors**: Extensive local state and multiple `useEffect` hooks could cause race conditions.
- **Enhancement Plan**: Migrate the form logic to use `react-hook-form` and `zod` for cleaner validation and state management.

## CRM Settings: API Tokens
### `/src/app/dashboard/crm/settings/api-tokens/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/api-tokens/new/page.tsx`
- **Current Features**: Generates an API token and shows it exactly once. Scope selection UI.
- **Possible Features**: IP restriction fields for tokens.
- **Errors**: No strict enforcement of copying the token (user might leave accidentally).
- **Enhancement Plan**: Add a warning modal if the user attempts to navigate away before clicking "I've saved it".

### `/src/app/dashboard/crm/settings/api-tokens/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/api-tokens/page.tsx`
- **Current Features**: Lists API tokens, bulk revoke/delete, export to CSV (sans tokens).
- **Possible Features**: Last used IP address tracking.
- **Errors**: None apparent. Good security practices applied.
- **Enhancement Plan**: Add a "test token" action to verify its scopes are still valid.

## CRM Settings: General
### `/src/app/dashboard/crm/settings/attendance-settings/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/attendance-settings/page.tsx`
- **Current Features**: Office hours, IP whitelisting, check-in methods.
- **Possible Features**: Geofencing configuration map.
- **Errors**: IP whitelist parsing might break on trailing newlines.
- **Enhancement Plan**: Add strict IP address format validation.

### `/src/app/dashboard/crm/settings/company-addresses/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/company-addresses/page.tsx`
- **Current Features**: Manages branch, billing, shipping addresses. Uses cascade entity pickers for Country -> State -> City.
- **Possible Features**: Google Maps autocomplete integration.
- **Errors**: Cascade filter relies on siblings object which might be brittle during rapid edits.
- **Enhancement Plan**: Use a dedicated Address input component.

### `/src/app/dashboard/crm/settings/company-profile/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/company-profile/page.tsx`
- **Current Features**: Giant form for company profile including tax, locale, and prefixes.
- **Possible Features**: Multiple profiles for subsidiary companies.
- **Errors**: Huge form payload; partial saves are not supported.
- **Enhancement Plan**: Break down into tabbed views with auto-saving to avoid data loss.

### `/src/app/dashboard/crm/settings/currencies/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/currencies/page.tsx`
- **Current Features**: Manages ISO 4217 currencies, base currency toggle, bulk delete.
- **Possible Features**: Automatic exchange rate fetching via API.
- **Errors**: Missing constraint to prevent deleting all currencies.
- **Enhancement Plan**: Integrate an external API for daily FX rates.

### `/src/app/dashboard/crm/settings/currency-formats/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/currency-formats/page.tsx`
- **Current Features**: Setup display format (prefix/suffix/space) and separators for currencies.
- **Possible Features**: Live preview of the formatted number.
- **Errors**: None.
- **Enhancement Plan**: Add a live preview string updating dynamically based on current selections.

## CRM Settings: Custom Fields
### `/src/app/dashboard/crm/settings/custom-fields/[id]/edit/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/custom-fields/[id]/edit/page.tsx`
- **Current Features**: Wrapper for the custom field edit form.
- **Possible Features**: Form logic rules (hide if X).
- **Errors**: None.
- **Enhancement Plan**: Migrate the form to the centralized dialog UI used in the main list.

### `/src/app/dashboard/crm/settings/custom-fields/[id]/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/custom-fields/[id]/page.tsx`
- **Current Features**: Detail view of a custom field definition, flags, options, and validation.
- **Possible Features**: Show usage metrics (how many records have this field filled).
- **Errors**: Option color styling might fail on malformed hex strings.
- **Enhancement Plan**: Validate color options strictly.

### `/src/app/dashboard/crm/settings/custom-fields/groups/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/custom-fields/groups/page.tsx`
- **Current Features**: Groups custom fields logically for display in specific modules.
- **Possible Features**: Reordering groups.
- **Errors**: The entity filter options are hardcoded.
- **Enhancement Plan**: Dynamically generate entity options based on the available schemas.

### `/src/app/dashboard/crm/settings/custom-fields/new/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/custom-fields/new/page.tsx`
- **Current Features**: Fallback creation page using a suspense boundary.
- **Possible Features**: Cloned from existing fields.
- **Errors**: Duplicate of the dialog functionality.
- **Enhancement Plan**: Remove this page and rely entirely on the dialog in `page.tsx` for creation.

### `/src/app/dashboard/crm/settings/custom-fields/page.tsx`
- **Route / Component**: `src/app/dashboard/crm/settings/custom-fields/page.tsx`
- **Current Features**: Master list of all custom fields with an inline complex creation dialog. Includes validation builders and option list makers.
- **Possible Features**: Bulk import of custom field options via CSV.
- **Errors**: Hidden input serialized JSON can be brittle.
- **Enhancement Plan**: Refactor the `OptionsRepeater` to use a structured form context instead of hidden JSON inputs.
