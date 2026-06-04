# Workflow Module

Comprehensive reference for the twenty-server workflow module - responsible for defining, managing, executing, and triggering automated workflows.

## Overview

The workflow module provides:
- **Workflow Definition**: Create and manage workflow versions with triggers and steps
- **Workflow Execution**: Execute workflows with step-by-step processing, variable resolution, and error handling
- **Workflow Triggers**: Database events, manual triggers, cron schedules, webhooks
- **Workflow Actions**: Record CRUD, code execution, filtering, iteration, conditionals, delays, email sending, form submission
- **Workflow State Management**: Track workflow run status, step execution, and step outputs

---

## workflow-common (Common Utilities & Entities)

### workspace-services/workflow-common.workspace-service.ts

**getWorkflowVersionOrFail**
- `file:path:line` workflow-common.workspace-service.ts:53
- Signature: `(workspaceId: string, workflowVersionId: string) => Promise<WorkflowVersionWorkspaceEntity>`
- Fetches a workflow version by ID or throws if not found. Validates the version exists and has trigger data attached.

**getValidWorkflowVersionOrFail**
- `file:path:line` workflow-common.workspace-service.ts:90
- Signature: `(workflowVersion: WorkflowVersionWorkspaceEntity | null) => Promise<WorkflowVersionWorkspaceEntity>`
- Ensures a workflow version is non-null and returns it with trigger data spread for type safety.

**getFlatEntityMaps**
- `file:path:line` workflow-common.workspace-service.ts:103
- Signature: `(workspaceId: string) => Promise<{ flatObjectMetadataMaps, flatFieldMetadataMaps, objectIdByNameSingular }>`
- Retrieves cached metadata for all objects and fields in the workspace to support schema operations.

**getObjectMetadataInfo**
- `file:path:line` workflow-common.workspace-service.ts:127
- Signature: `(objectNameSingular: string, workspaceId: string) => Promise<ObjectMetadataInfo>`
- Gets metadata for a specific object including its fields. Used to validate record operations in workflow actions.

**handleWorkflowSubEntities**
- `file:path:line` workflow-common.workspace-service.ts:165
- Signature: `(workflowIds: string[], workspaceId: string, operation: 'restore' | 'delete' | 'destroy') => Promise<void>`
- Cascades delete/restore operations to workflow versions, runs, and automated triggers. Handles deactivation and logic function cleanup.

**deactivateVersionOnDelete**
- `file:path:line` workflow-common.workspace-service.ts:247
- Signature: `(workflowVersionRepository, workflowId, workspaceId, operation) => Promise<void>` (private)
- Deactivates active versions and removes command menu items when a workflow is deleted. Uses transaction for consistency.

**cleanupCommandMenuItemForVersion**
- `file:path:line` workflow-common.workspace-service.ts:337
- Signature: `(workflowVersionId: string, workspaceId: string) => Promise<void>` (private)
- Removes the command menu item associated with a workflow version if it exists.

**handleLogicFunctionSubEntities**
- `file:path:line` workflow-common.workspace-service.ts:355
- Signature: `(workflowVersionRepository, workflowId, workspaceId, operation) => Promise<void>` (private)
- Deletes logic function sources for code steps when a workflow is destroyed (not soft-deleted).

### workspace-services/workflow-version-validation.workspace-service.ts

**validateWorkflowVersionForCreateOne**
- `file:path:line` workflow-version-validation.workspace-service.ts:32
- Signature: `(workspaceId: string, payload: CreateOneResolverArgs<WorkflowVersionWorkspaceEntity>) => Promise<void>`
- Ensures new versions are created as DRAFT and that workflows don't have multiple draft versions simultaneously.

**validateWorkflowVersionForUpdateOne**
- `file:path:line` workflow-version-validation.workspace-service.ts:80
- Signature: `(workspaceId: string, payload: UpdateOneResolverArgs<WorkflowVersionWorkspaceEntity>) => Promise<void>`
- Prevents status updates and direct step modifications. Only allows name updates on non-draft versions.

**validateWorkflowVersionForDeleteOne**
- `file:path:line` workflow-version-validation.workspace-service.ts:116
- Signature: `(workspaceId: string, payload: DeleteOneResolverArgs) => Promise<void>`
- Ensures only draft versions are deleted and that at least one version remains (initial version cannot be deleted).

### utils/assert-workflow-version-is-draft.util.ts

**assertWorkflowVersionIsDraft**
- `file:path:line` assert-workflow-version-is-draft.util.ts:12
- Signature: `(workflowVersion: WorkflowVersionWorkspaceEntity) => void`
- Throws exception if workflow version is not in DRAFT status. Guards operations that modify workflow structure.

---

## workflow-executor (Execution Engine)

### workspace-services/workflow-executor.workspace-service.ts

**executeFromSteps**
- `file:path:line` workflow-executor.workspace-service.ts:71
- Signature: `(stepIds: string[], workflowRunId: string, workspaceId: string, shouldComputeWorkflowRunStatus?: boolean, executedStepsCount?: number) => Promise<void>`
- Entry point for workflow execution. Executes multiple initial steps in parallel, then computes final workflow status.

**executeFromStep** (private)
- `file:path:line` workflow-executor.workspace-service.ts:97
- Signature: `(stepId: string, workflowRunId: string, workspaceId: string, executedStepsCount: number) => Promise<void>`
- Executes a single step, evaluates conditions (should execute, should fail safely, should skip), processes result, and queues next steps.

### services/workflow-execution-context.service.ts

**getExecutionContext**
- `file:path:line` workflow-execution-context.service.ts:31
- Signature: `(runInfo: { workflowRunId: string; workspaceId: string }) => Promise<WorkflowExecutionContext>`
- Builds execution context (auth, role, actor info) for a workflow run based on who created it (user vs system).

**buildUserExecutionContext** (private)
- `file:path:line` workflow-execution-context.service.ts:54
- Signature: `(workflowRun, workspaceId) => Promise<WorkflowExecutionContext>`
- Creates auth context for workflows triggered by users, preserving user identity and role permissions.

**buildApplicationExecutionContext** (private)
- `file:path:line` workflow-execution-context.service.ts:92
- Signature: `(workflowRun, workspaceId) => Promise<WorkflowExecutionContext>`
- Creates auth context for system-triggered workflows, using standard role permissions.

### utils (Decision & Helper Functions)

**buildWorkflowActorMetadata** (util)
- `file:path:line` build-workflow-actor-metadata.util.ts:5
- Signature: `(executionContext: WorkflowExecutionContext) => ActorMetadata`
- Determines actor metadata (source, name, workspace member ID) for record operations based on execution context.

**shouldExecuteStep** (util)
- `file:path:line` should-execute-step.util.ts:11
- Signature: `(step, steps, stepInfos, workflowRunStatus) => boolean`
- Decides if a step should execute: checks run status, whether step has started, and parent step completion.

**shouldFailSafely** (util)
- `file:path:line` should-fail-safely.util.ts:9
- Signature: `(step, steps, stepInfos) => boolean`
- Determines if a failed step should be treated as fail-safe (parent failed safely, step not yet started).

**shouldSkipStepExecution** (util)
- `file:path:line` should-skip-step-execution.util.ts` (not shown but referenced)
- Checks if step should be skipped due to parent failures or conditional logic.

**workflowShouldFail** (util)
- `file:path:line` workflow-should-fail.util.ts:5
- Signature: `(stepInfos, steps) => boolean`
- Returns true if any step has failed status (workflow should stop).

**workflowShouldKeepRunning** (util)
- `file:path:line` workflow-should-keep-running.util.ts` (referenced)
- Checks if workflow should continue executing (has pending/running steps).

**findStepOrThrow** (util)
- `file:path:line` find-step-or-throw.util.ts:7
- Signature: `(stepId: string, steps: WorkflowAction[]) => WorkflowAction`
- Finds step by ID or throws STEP_NOT_FOUND exception. Used by all action implementations.

**filterValidFieldsInRecord** (util)
- `file:path:line` filter-valid-fields-in-record.util.ts:8
- Signature: `(record: Record<string, unknown>, flatObjectMetadata, flatFieldMetadataMaps) => Record<string, unknown>`
- Removes record fields that don't exist in object metadata, preventing validation errors on create/update.

**formatWorkflowRecordRelationFields** (util)
- `file:path:line` format-workflow-record-relation-fields.util.ts` (referenced)
- Transforms relation field references to proper GraphQL format for record operations.

**resolveRichTextFieldsInRecord** (util)
- `file:path:line` resolve-rich-text-fields-in-record.util.ts` (referenced)
- Resolves rich text field variables before passing to record operations.

### workflow-actions (Step Implementations)

#### Record CRUD Actions

**CreateRecordWorkflowAction**
- `file:path:line` record-crud/create-record.workflow-action.ts:20
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Creates a record in specified object. Resolves variables, filters valid fields, applies actor metadata, returns created record.

**FindRecordsWorkflowAction**
- `file:path:line` record-crud/find-records.workflow-action.ts:26
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Queries records with filters, ordering, and limit. Validates filter values are resolved. Returns matching records array.

**UpdateRecordWorkflowAction**
- `file:path:line` record-crud/update-record.workflow-action.ts:25
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Updates a record by ID. Validates ID, resolves rich text, filters valid fields, applies selective updates.

**DeleteRecordWorkflowAction**
- `file:path:line` record-crud/delete-record.workflow-action.ts:20
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Soft-deletes a record by ID. Validates ID and object name are present.

**UpsertRecordWorkflowAction**
- `file:path:line` record-crud/upsert-record.workflow-action.ts:24
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Upserts a record (create if not found, update if found). Uses upsert criteria from step settings.

#### Control Flow Actions

**IteratorWorkflowAction**
- `file:path:line` iterator/iterator.workflow-action.ts:26
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Loops through array items. Returns current item index, item data, and hasProcessedAllItems flag. Max 10,000 iterations.

**IfElseWorkflowAction**
- `file:path:line` if-else/if-else.workflow-action.ts:18
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Evaluates filter conditions and returns matching branch ID. Requires at least one branch and defined filters.

**FilterWorkflowAction**
- `file:path:line` filter/filter.workflow-action.ts:18
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Evaluates conditions and ends workflow if filter doesn't match. Returns shouldEndWorkflowRun flag.

#### Code & Logic Actions

**CodeWorkflowAction**
- `file:path:line` code/code.workflow-action.ts:19
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Executes a logic function with resolved input. Returns logic function output or error message.

**LogicFunctionWorkflowAction**
- `file:path:line` logic-function/logic-function.workflow-action.ts:21
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Similar to code action but validates logic function is exposed as workflow action before executing.

#### Async/Delay Actions

**DelayWorkflowAction**
- `file:path:line` delay/delay.workflow-action.ts:23
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Schedules workflow resumption after delay (by duration or scheduled date). Queues resume job with delay, returns pendingEvent.

**FormWorkflowAction**
- `file:path:line` form/form.workflow-action.ts:15
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Waits for form submission. Returns pendingEvent=true to pause workflow until user responds.

#### Other Actions

**EmptyWorkflowAction**
- `file:path:line` empty/empty.workflow-action.ts:15
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- No-op step. Returns empty result object.

**AiAgentWorkflowAction**
- `file:path:line` ai-agent/ai-agent.workflow-action.ts:24
- Signature: `execute(WorkflowActionInput) => Promise<WorkflowActionOutput>`
- Executes an AI agent with prompt. Returns agent result or error if credits exhausted.

---

## workflow-builder (Workflow Definition)

### workflow-version/workflow-version.workspace-service.ts

**createDraftFromWorkflowVersion**
- `file:path:line` workflow-version.workspace-service.ts:42
- Signature: `(workspaceId, workflowId, workflowVersionIdToCopy) => Promise<WorkflowVersionWorkspaceEntity>`
- Duplicates a workflow version as a new DRAFT. Updates existing draft if present, otherwise creates new version. Uses lock for atomicity.

**duplicateWorkflow**
- `file:path:line` workflow-version.workspace-service.ts:154
- Signature: `(workspaceId, workflowIdToDuplicate, workflowVersionIdToCopy) => Promise<WorkflowVersionWorkspaceEntity>`
- Creates a new workflow with duplicated steps and trigger. Remaps step IDs in edges and iterator loop steps.

**updateWorkflowVersionPositions**
- `file:path:line` workflow-version.workspace-service.ts:326
- Signature: `(workflowVersionId, positions, workspaceId) => Promise<void>`
- Updates trigger and step positions for UI layout. Only works on DRAFT versions.

### workflow-version-step/workflow-version-step.workspace-service.ts

**createWorkflowVersionStep**
- `file:path:line` workflow-version-step.workspace-service.ts:19
- Signature: `(workspaceId, input: CreateWorkflowVersionStepInput) => Promise<WorkflowVersionStepChangesDTO>`
- Delegates to creation service to create and insert step.

**updateWorkflowVersionStep**
- `file:path:line` workflow-version-step.workspace-service.ts:34
- Signature: `(workspaceId, workflowVersionId, step: WorkflowAction) => Promise<WorkflowActionDTO>`
- Delegates to update service to modify step settings.

**deleteWorkflowVersionStep**
- `file:path:line` workflow-version-step.workspace-service.ts:52
- Signature: `(workspaceId, workflowVersionId, stepIdToDelete) => Promise<WorkflowVersionStepChangesDTO>`
- Delegates to deletion service to remove step and cleanup edges.

**duplicateWorkflowVersionStep**
- `file:path:line` workflow-version-step.workspace-service.ts:70
- Signature: `(workspaceId, workflowVersionId, stepId) => Promise<WorkflowVersionStepChangesDTO>`
- Clones a step and inserts it into workflow version. Delegates to creation service.

**createDraftStep**
- `file:path:line` workflow-version-step.workspace-service.ts:88
- Signature: `(step: WorkflowAction, workspaceId) => Promise<WorkflowAction>`
- Duplicates a step for draft creation. Delegates to creation service.

### workflow-version-step/workflow-version-step-creation.workspace-service.ts

**createWorkflowVersionStep**
- `file:path:line` workflow-version-step-creation.workspace-service.ts:26
- Signature: `(workspaceId, input) => Promise<WorkflowVersionStepChangesDTO>`
- Validates draft version, runs side effects (code step building), inserts step with edges, updates version. Returns changes.

**duplicateWorkflowVersionStep**
- `file:path:line` workflow-version-step-creation.workspace-service.ts:104
- Signature: `(workspaceId, workflowVersionId, stepId) => Promise<WorkflowVersionStepChangesDTO>`
- Finds step, clones it (runs side effects), marks as duplicate, inserts into version. Returns changes.

**createDraftStep**
- `file:path:line` workflow-version-step-creation.workspace-service.ts` (referenced, delegates to operations service)
- Clones a step for version duplication without inserting.

### workflow-version-edge/workflow-version-edge.workspace-service.ts

**createWorkflowVersionEdge**
- `file:path:line` workflow-version-edge.workspace-service.ts:32
- Signature: `(source, target, workflowVersionId, workspaceId, sourceConnectionOptions) => Promise<WorkflowVersionStepChangesDTO>`
- Creates edge from trigger or step to target step. Validates target exists, delegates to createTriggerEdge or createStepEdge.

### workflow-schema/workflow-schema.workspace-service.ts

**computeStepOutputSchema**
- `file:path:line` workflow-schema.workspace-service.ts:47
- Signature: `(step: WorkflowTrigger | WorkflowAction, workspaceId, workflowVersionId) => Promise<OutputSchema>`
- Generates fake output schema for a step based on its type. Used by frontend for variable suggestions.

**enrichOutputSchema**
- `file:path:line` workflow-schema.workspace-service.ts` (referenced)
- Adds output schema to step after creation/duplication.

---

## workflow-runner (Execution Control)

### workspace-services/workflow-runner.workspace-service.ts

**run**
- `file:path:line` workflow-runner.workspace-service.ts:52
- Signature: `(workspaceId, workflowVersionId, payload, source, workflowRunId) => Promise<WorkflowRunId>`
- Entry point for manual trigger execution. Checks billing, throttle limits, creates run (enqueued or not-started).

**resume**
- `file:path:line` workflow-runner.workspace-service.ts:115
- Signature: `(workspaceId, workflowRunId, lastExecutedStepId) => Promise<void>`
- Resumes workflow after delay/form completion. Queues run-workflow job with last executed step ID.

**submitFormStep**
- `file:path:line` workflow-runner.workspace-service.ts:134
- Signature: `(workspaceId, stepId, workflowRunId, response) => Promise<void>`
- Records form response and resumes workflow execution from form step.

**stopWorkflowRun**
- `file:path:line` workflow-runner.workspace-service.ts` (referenced)
- Marks workflow run as stopped/aborted.

**checkHardThrottleLimit** (private)
- `file:path:line` workflow-runner.workspace-service.ts` (referenced)
- Returns true if workspace has exceeded hard throttle limit (prevents queueing).

**createFailedWorkflowRun** (private)
- `file:path:line` workflow-runner.workspace-service.ts` (referenced)
- Creates a workflow run in FAILED status immediately (throttled or error state).

**enqueueWorkflowRun** (private)
- `file:path:line` workflow-runner.workspace-service.ts` (referenced)
- Creates ENQUEUED workflow run for manual trigger.

**createNotStartedWorkflowRunAndTriggerEnqueueJob** (private)
- `file:path:line` workflow-runner.workspace-service.ts` (referenced)
- Creates NOT_STARTED run and enqueues later via cron/job.

### workflow-run/workflow-run.workspace-service.ts

**createWorkflowRun**
- `file:path:line` workflow-run.workspace-service.ts:37
- Signature: `(workflowVersionId, createdBy, status, triggerPayload, workflowRunId?, error?, workspaceId) => Promise<string>`
- Creates workflow run record with initial state. Increments run counter, builds run name, stores trigger payload.

**startWorkflowRun**
- `file:path:line` workflow-run.workspace-service.ts:142
- Signature: `(workflowRunId, workspaceId) => Promise<void>`
- Marks run as RUNNING, initializes trigger step info. Uses lock for atomicity.

**getWorkflowRunOrFail**
- `file:path:line` workflow-run.workspace-service.ts` (referenced)
- Fetches run by ID or throws exception.

**endWorkflowRun**
- `file:path:line` workflow-run.workspace-service.ts` (referenced)
- Marks run as COMPLETED, FAILED, or STOPPED with optional error message.

**getInitState** (private)
- `file:path:line` workflow-run.workspace-service.ts` (referenced)
- Builds initial workflow run state from version definition.

### jobs/run-workflow.job.ts

**handle** (@Process)
- `file:path:line` run-workflow.job.ts:38
- Signature: `(workflowRunId, lastExecutedStepId, workspaceId) => Promise<void>`
- Job handler for executing/resuming workflows. Calls startWorkflowExecution or resumeWorkflowExecution.

**startWorkflowExecution** (private)
- `file:path:line` run-workflow.job.ts:77
- Starts fresh workflow: validates run status, builds code steps, executes from trigger.

**resumeWorkflowExecution** (private)
- `file:path:line` run-workflow.job.ts` (referenced)
- Resumes from a specific step (after delay/form).

### workflow-run-queue/workspace-services/workflow-run-enqueue.workspace-service.ts

**enqueueRunsForWorkspace**
- `file:path:line` workflow-run-enqueue.workspace-service.ts:32
- Signature: `(workspaceId, isCacheMode) => Promise<void>`
- Acquires lock, finds NOT_STARTED runs (in batches), queues them for execution. Updates throttle cache.

### workflow-run-queue/workspace-services/workflow-handle-staled-runs.workspace-service.ts

**handleStaledRuns**
- `file:path:line` workflow-handle-staled-runs.workspace-service.ts` (referenced)
- Finds runs stuck in RUNNING status beyond timeout, marks them as FAILED.

### workflow-run-queue/workspace-services/workflow-throttling.workspace-service.ts

**acquireWorkflowEnqueueLock**
- `file:path:line` workflow-throttling.workspace-service.ts` (referenced)
- Acquires distributed lock for enqueue operation. Returns false if already locked.

**getNotStartedRunsCountFromCache / getNotStartedRunsCountFromDatabase**
- `file:path:line` workflow-throttling.workspace-service.ts` (referenced)
- Gets count of NOT_STARTED runs from cache or DB for throttle decisions.

**getRemainingRunsToEnqueueCount**
- `file:path:line` workflow-throttling.workspace-service.ts` (referenced)
- Calculates how many more runs can be enqueued based on throttle limits.

---

## workflow-trigger (Trigger Management)

### workspace-services/workflow-trigger.workspace-service.ts

**runWorkflowVersion**
- `file:path:line` workflow-trigger.workspace-service.ts:61
- Signature: `(workflowVersionId, payload, createdBy, workflowRunId?, workspaceId) => Promise<WorkflowRunId>`
- Delegates to workflow-runner to execute workflow with given payload and creator.

**activateWorkflowVersion**
- `file:path:line` workflow-trigger.workspace-service.ts:88
- Signature: `(workflowVersionId, workspaceId) => Promise<boolean>`
- Activates workflow version: validates version, builds code steps, deactivates previous version, sets up triggers (cron/database events).

**deactivateWorkflowVersion**
- `file:path:line` workflow-trigger.workspace-service.ts:153
- Signature: `(workflowVersionId, workspaceId) => Promise<boolean>`
- Deactivates workflow version: removes automated triggers, clears cron cache, removes command menu item.

**stopWorkflowRun**
- `file:path:line` workflow-trigger.workspace-service.ts:180
- Signature: `(workflowRunId, workspaceId) => Promise<void>`
- Delegates to workflow-runner to stop a running workflow.

**performActivationSteps** (private)
- `file:path:line` workflow-trigger.workspace-service.ts:187
- Deactivates previous version, sets up automated triggers, creates command menu item if applicable.

**performDeactivationSteps** (private)
- `file:path:line` workflow-trigger.workspace-service.ts` (referenced)
- Removes automated triggers and clears cron cache.

### automated-trigger/automated-trigger.workspace-service.ts

**addAutomatedTrigger**
- `file:path:line` automated-trigger.workspace-service.ts:19
- Signature: `(workflowId, type, settings, workspaceId, entityManager?) => Promise<void>`
- Creates workflowAutomatedTrigger record for database event or cron trigger.

**deleteAutomatedTrigger**
- `file:path:line` automated-trigger.workspace-service.ts:58
- Signature: `(workflowId, workspaceId, entityManager?) => Promise<void>`
- Removes automated trigger records for workflow.

### jobs/workflow-trigger.job.ts

**handle** (@Process)
- `file:path:line` workflow-trigger.job.ts:35
- Signature: `(workspaceId, workflowId, payload) => Promise<void>`
- Job handler for trigger events (database events, cron, webhooks). Fetches active version and runs workflow.

---

## workflow-tools (AI Agent Tools)

### services/workflow-tool.workspace-service.ts

**generateWorkflowTools**
- `file:path:line` workflow-tool.workspace-service.ts:64
- Signature: `(workspaceId, rolePermissionConfig) => ToolSet`
- Returns set of AI tools for workflow operations: create, update, delete steps/edges, activate/deactivate versions, compute schemas, etc.

### Individual Tool Creators (in workflow-tools/tools/)

Each tool factory function creates an AI tool definition:

- `createCreateCompleteWorkflowTool` - Create workflow with version and initial steps
- `createCreateWorkflowVersionStepTool` - Add step to workflow version
- `createUpdateWorkflowVersionStepTool` - Modify step settings
- `createUpdateWorkflowVersionTriggerTool` - Change trigger type and settings
- `createDeleteWorkflowVersionStepTool` - Remove step
- `createCreateWorkflowVersionEdgeTool` - Connect steps/trigger
- `createDeleteWorkflowVersionEdgeTool` - Disconnect steps
- `createCreateDraftFromWorkflowVersionTool` - Duplicate version as draft
- `createUpdateWorkflowVersionPositionsTool` - Update UI positions
- `createActivateWorkflowVersionTool` - Activate workflow
- `createDeactivateWorkflowVersionTool` - Deactivate workflow
- `createComputeStepOutputSchemaTool` - Get output schema for step
- `createGetWorkflowCurrentVersionTool` - Fetch active/draft version
- `createUpdateLogicFunctionSourceTool` - Update code function
- `createListLogicFunctionToolsTool` - List available logic functions

---

## workflow-status (Status Updates)

### listeners/workflow-version-status.listener.ts

**onWorkflowVersionStatusUpdate**
- `file:path:line` workflow-version-status.listener.ts` (referenced)
- Listens for WORKFLOW_VERSION_STATUS_UPDATED event and triggers job to update related workflow status.

### jobs/workflow-statuses-update.job.ts

**handle** (@Process)
- `file:path:line` workflow-statuses-update.job.ts` (referenced)
- Updates parent workflow status based on its versions' statuses (ACTIVE, DRAFT, DEACTIVATED).

---

## Common Exceptions

### workflow-common.exception.ts
- `WorkflowCommonException` with code `OBJECT_METADATA_NOT_FOUND`

### workflow-version-validation.exception.ts
- `WorkflowQueryValidationException` with codes for validation failures

### workflow-version-step.exception.ts
- `WorkflowVersionStepException` with codes `NOT_FOUND`, `INVALID_INPUT`

### workflow-version-edge.exception.ts
- `WorkflowVersionEdgeException` with code `NOT_FOUND`

### workflow-step-executor.exception.ts
- `WorkflowStepExecutorException` with codes `STEP_NOT_FOUND`, `INVALID_STEP_TYPE`, `INVALID_STEP_INPUT`, `INTERNAL_ERROR`

### workflow-trigger.exception.ts
- `WorkflowTriggerException` with codes `INVALID_INPUT`, `INVALID_WORKFLOW_VERSION`, `NOT_FOUND`, `INTERNAL_ERROR`

### workflow-run.exception.ts
- `WorkflowRunException` with code `WORKFLOW_RUN_INVALID`

---

## workflow-version-step (Step Operations, Helpers, Deletion — full coverage)

### workflow-version-step-operations.workspace-service.ts (WorkflowVersionStepOperationsWorkspaceService)

### runWorkflowVersionStepDeletionSideEffects
- `file:path:line` workflow-version-step-operations.workspace-service.ts:85
- Signature: `({ step: WorkflowAction, workspaceId: string }) => Promise<void>`
- Cleans external resources when a step is deleted: for CODE steps deletes the logic function with source; for AI_AGENT steps deletes the agent and, if it had an agent-only role target, deletes that role if now unused.

### runStepCreationSideEffectsAndBuildStep
- `file:path:line` workflow-version-step-operations.workspace-service.ts:131
- Signature: `({ type, workspaceId, workflowVersionId, position?, id?, defaultSettings? }) => Promise<{ builtStep: WorkflowAction; additionalCreatedSteps?: WorkflowAction[] }>`
- Big switch over WorkflowActionType that builds the default step skeleton (BASE_STEP_DEFINITION + per-type default input). CODE creates a new logic function; LOGIC_FUNCTION resolves output schema from a flat logic function; AI_AGENT creates a default agent; ITERATOR and IF_ELSE create extra empty child nodes (returned as `additionalCreatedSteps`). Record steps default `objectName` to first active non-system object. Throws INVALID_REQUEST for unknown types.

### enrichFormStepResponse
- `file:path:line` workflow-version-step-operations.workspace-service.ts:610
- Signature: `({ workspaceId, step: WorkflowFormAction, response: object }) => Promise<object>`
- Runs in system workspace context; for each form RECORD field whose response value has a valid UUID id, fetches the full record (with relations) so the workflow gets the hydrated record instead of just an id. Other values pass through unchanged.

### cloneStep
- `file:path:line` workflow-version-step-operations.workspace-service.ts:690
- Signature: `({ step: WorkflowAction, workspaceId }) => Promise<WorkflowAction>`
- Deep-clones a step with a fresh id, cleared nextStepIds, same position. CODE clones the logic function source; AI_AGENT clones the underlying agent; ITERATOR clears initialLoopStepIds; default just copies.

### markStepAsDuplicate
- `file:path:line` workflow-version-step-operations.workspace-service.ts:795
- Signature: `({ step }) => WorkflowAction`
- Appends " (Duplicate)" to the name and offsets position by DUPLICATED_STEP_POSITION_OFFSET (50,50).

### createEmptyNodeForIteratorStep
- `file:path:line` workflow-version-step-operations.workspace-service.ts:806
- Signature: `({ iteratorStepId, workflowVersionId, workspaceId, iteratorPosition? }) => Promise<WorkflowAction>`
- Creates an EMPTY "Add an Action" node positioned relative to the iterator, sets its nextStepIds back to the iterator (loop-back), and appends it to the version's steps in workspace context.

### createEmptyNodesForIfElseStep
- `file:path:line` workflow-version-step-operations.workspace-service.ts:873
- Signature: `({ workflowVersionId, workspaceId, ifElsePosition? }) => Promise<{ ifEmptyNode, elseEmptyNode, ifFilterGroupId, branches }>`
- Creates two EMPTY nodes (IF and ELSE positions from IF_ELSE_BRANCH_POSITION_OFFSETS), appends them to the version, and returns the two branches (IF branch tied to a new filterGroupId, ELSE branch without filter).

### createDraftStep
- `file:path:line` workflow-version-step-operations.workspace-service.ts:974
- Signature: `({ step, workspaceId }) => Promise<WorkflowAction>`
- Used when duplicating a version: for CODE steps duplicates the logic function source and rewrites logicFunctionId; otherwise returns the step unchanged.

### workflow-version-step-helpers.workspace-service.ts (WorkflowVersionStepHelpersWorkspaceService)

### getValidatedDraftWorkflowVersion
- `file:path:line` workflow-version-step-helpers.workspace-service.ts:18
- Signature: `({ workflowVersionId, workspaceId }) => Promise<WorkflowVersionWorkspaceEntity>`
- Fetches the version (or throws) and asserts it is DRAFT before any structural mutation.

### updateWorkflowVersionStepsAndTrigger
- `file:path:line` workflow-version-step-helpers.workspace-service.ts:36
- Signature: `({ workspaceId, workflowVersionId, steps?, trigger? }) => Promise<void>`
- Persists steps and/or trigger to the workflowVersion row inside workspace context (only fields that are not `undefined` are written).

### workflow-version-step-creation.workspace-service.ts (WorkflowVersionStepCreationWorkspaceService)

### createWorkflowVersionStep
- `file:path:line` workflow-version-step-creation.workspace-service.ts:26
- Signature: `({ workspaceId, input: CreateWorkflowVersionStepInput }) => Promise<WorkflowVersionStepChangesDTO>`
- Validates draft, builds the step (creation side effects), enriches output schema, inserts it via `insertStep` (wiring parent/next edges + any additional created steps), persists, and returns the trigger/steps diff.

### duplicateWorkflowVersionStep
- `file:path:line` workflow-version-step-creation.workspace-service.ts:104
- Signature: `({ workspaceId, workflowVersionId, stepId }) => Promise<WorkflowVersionStepChangesDTO>`
- Finds the step, clones it, marks it as duplicate, inserts it (no parent wiring), persists, returns diff.

### createDraftStep
- `file:path:line` workflow-version-step-creation.workspace-service.ts:166
- Signature: `({ step, workspaceId }) => Promise<WorkflowAction>`
- Thin delegate to operations service's createDraftStep.

### workflow-version-step-update.workspace-service.ts (WorkflowVersionStepUpdateWorkspaceService)

### updateWorkflowVersionStep
- `file:path:line` workflow-version-step-update.workspace-service.ts:23
- Signature: `({ workspaceId, workflowVersionId, step }) => Promise<WorkflowActionDTO>`
- Validates draft and that the step exists. If the step's TYPE changed, runs deletion side effects on the old type and creation side effects on the new (preserving id/position/nextStepIds); otherwise just re-enriches the output schema. Persists merged steps and returns the updated step.

### updateWorkflowVersionStepType (private)
- `file:path:line` workflow-version-step-update.workspace-service.ts:99
- Runs deletion side effects for the old step, builds a new step of the new type, then enriches its output schema while keeping the existing id/nextStepIds/position.

### updateWorkflowVersionStepSettings (private)
- `file:path:line` workflow-version-step-update.workspace-service.ts:146
- Re-enriches output schema for a settings-only change.

### workflow-version-step-deletion.workspace-service.ts (WorkflowVersionStepDeletionWorkspaceService)

### deleteWorkflowVersionStep
- `file:path:line` workflow-version-step-deletion.workspace-service.ts:23
- Signature: `({ workspaceId, workflowVersionId, stepIdToDelete }) => Promise<WorkflowVersionStepChangesDTO>`
- Validates draft; supports deleting the trigger (TRIGGER_STEP_ID) or a step. Re-wires parent→child edges via `removeStep`, persists, runs deletion side effects for every removed step, returns diff.

### code-step/services/code-step-build.service.ts (CodeStepBuildService)

### createCodeStepLogicFunction
- `file:path:line` code-step-build.service.ts:21
- Signature: `({ logicFunctionId, workspaceId }) => Promise<LogicFunction>`
- Creates a "A Code Step" logic function from source seeded with SEED_WORKFLOW_ACTION_TRIGGER_SETTINGS.

### duplicateCodeStepLogicFunction
- `file:path:line` code-step-build.service.ts:39
- Signature: `({ existingLogicFunctionId, workspaceId }) => Promise<{ id: string }>`
- Duplicates an existing logic function (with its source).

### buildCodeStepsFromSourceForSteps
- `file:path:line` code-step-build.service.ts:52
- Signature: `({ workspaceId, steps }) => Promise<void>`
- Called before execution/activation. Filters CODE steps, looks each logic function up in flat maps, and rebuilds from source any that are not deleted, not already up to date, and belong to a known application. Skips others.

---

## workflow-builder utils (full coverage)

### insertStep (util)
- `file:path:line` workflow-version-step/utils/insert-step.ts:16
- Signature: `({ existingSteps, existingTrigger, insertedStep, nextStepId?, parentStepId?, parentStepConnectionOptions? }) => { updatedSteps, updatedInsertedStep, updatedTrigger }`
- Wires a new step into the graph. If parentStepId is given, updates the parent (trigger or step) nextStepIds (or, with iterator connection options, the iterator's initialLoopStepIds) to point at the new step, removing the old nextStepId edge. The inserted step's nextStepIds become `[nextStepId]` when reconnecting in the middle.

### updateParentStep / updateParentStepNextStepIds / updateStepsWithOptions (private)
- `file:path:line` workflow-version-step/utils/insert-step.ts:61,99,160
- Helpers for insertStep: route to connection-option handling vs plain nextStepId update; TRIGGER_STEP_ID updates trigger.nextStepIds; iterator option path mutates initialLoopStepIds.

### removeStep (util)
- `file:path:line` workflow-version-step/utils/remove-step.ts:229
- Signature: `({ existingTrigger, existingSteps, stepIdToDelete, stepToDeleteChildrenIds? }) => { updatedSteps, updatedTrigger, removedStepIds }`
- Removes a step and reconnects its parents to its children. Deleting TRIGGER_STEP_ID nulls the trigger. For IF_ELSE deletions, also removes orphan EMPTY branch nodes and inserts replacement EMPTY nodes so IF/ELSE branches never become empty; prunes empty else-if branches. Iterator initialLoopStepIds and trigger.nextStepIds are likewise rewired.

### getEmptyChildStepIdsForIfElse (util)
- `file:path:line` workflow-version-step/utils/remove-step.ts:40
- Returns the IDs of branch child steps that are EMPTY nodes (to be cleaned up when their if-else is deleted).

### computeWorkflowVersionStepChanges (util)
- `file:path:line` workflow-builder/utils/compute-workflow-version-step-updates.util.ts:7
- Signature: `({ existingTrigger, existingSteps, updatedTrigger?, updatedSteps? }) => { triggerDiff: Difference[]; stepsDiff: Difference[] }`
- Uses `microdiff` to compute a minimal diff of trigger and steps so the frontend can patch its local cache instead of refetching.

---

## workflow-executor utils (full coverage)

### formatWorkflowRecordRelationFields (util)
- `file:path:line` workflow-executor/utils/format-workflow-record-relation-fields.util.ts:24
- Signature: `(record, objectMetadataInfo) => Record<string, unknown>`
- For MANY_TO_ONE relation/morph-relation fields whose value is a legacy `{ id }` object, rewrites it to the proper join column (e.g. `companyId`) so record CRUD actions persist correctly.

### resolveRichTextFieldsInRecord (util)
- `file:path:line` workflow-executor/utils/resolve-rich-text-fields-in-record.util.ts:8
- Signature: `(objectRecord, objectMetadataInfo, context) => Record<string, unknown>`
- For each RICH_TEXT field with a `blocknote` string, resolves `{{variable}}` references against the execution context before saving.

### stepHasBeenStarted (util)
- `file:path:line` workflow-executor/utils/step-has-been-started.util.ts:4
- Signature: `(stepId, stepInfos) => boolean`
- True when the step's status exists and is not NOT_STARTED. Used by should-execute/should-fail decisions.

### evaluateFilterConditions (util)
- `file:path:line` workflow-executor/workflow-actions/filter/utils/evaluate-filter-conditions.util.ts:476
- Signature: `({ filterGroups?, filters? }) => boolean`
- Recursively evaluates a tree of StepFilterGroups (AND/OR) and individual filters. Empty config → true. Validates every filter references a known group. Internally dispatches per field type (number, date, text/array, select, boolean, uuid, rating, relation, currency, actor, default) with type-specific operand handling (CONTAINS, IS, IS_EMPTY, IS_RELATIVE date, rating-rank comparison, relation id-only comparison, etc.).

### findMatchingBranch (util)
- `file:path:line` workflow-executor/workflow-actions/if-else/utils/find-matching-branch.util.ts:40
- Signature: `({ branches, stepFilterGroups, resolvedFilters }) => StepIfElseBranch`
- Returns the first branch whose filter group (and all descendant groups) evaluate true; a branch without a filterGroupId is the catch-all ELSE. Throws INTERNAL_ERROR if none match.

### getAllStepIdsInLoop (util)
- `file:path:line` workflow-executor/workflow-actions/iterator/utils/get-all-step-ids-in-loop.util.ts:84
- Signature: `({ iteratorStepId, initialLoopStepIds, steps }) => string[]`
- DFS from the iterator's loop-start nodes, collecting every step inside the loop body. Recurses into nested iterators and if-else branches, stops at edges that connect back to the iterator (loop boundary). Used to scope per-iteration step resets and failure handling.

---

## workflow-trigger utils & cron (full coverage)

### computeCronPatternFromSchedule (util)
- `file:path:line` workflow-trigger/utils/compute-cron-pattern-from-schedule.ts:24
- Signature: `(trigger: WorkflowCronTrigger) => string`
- Converts a structured cron schedule (CUSTOM/DAYS/HOURS/MINUTES) into a 5-field cron string and validates it with cron-parser, throwing WorkflowTriggerException on invalid patterns.

### assertFormStepIsValid (util)
- `file:path:line` workflow-trigger/utils/assert-form-step-is-valid.util.ts:10
- Signature: `(settings: WorkflowFormActionSettings) => void`
- Ensures a form step has at least one field, unique field names, and that every field has a label and type.

### assertVersionCanBeActivated (util)
- `file:path:line` workflow-trigger/utils/assert-version-can-be-activated.util.ts:19
- Signature: `(workflowVersion, workflow) => void`
- Validates the version (has trigger with type, has steps, trigger settings valid per type, each step valid) and that only a DRAFT or the last-published-but-deactivated version may be activated.

### WorkflowCronTriggerCronJob.handle (@Process, every minute)
- `file:path:line` workflow-trigger/automated-trigger/crons/jobs/workflow-cron-trigger-cron.job.ts:54
- Runs every minute. Reads cached cron triggers from Redis; on cache hit enqueues WorkflowTriggerJob for any whose pattern matches `now` (via `shouldRunNow`). On cache miss scans all ACTIVE workspaces' `workflowAutomatedTrigger` rows of type CRON, enqueues matching ones, and rebuilds the cache with a TTL.

---

## workflow-runner jobs & crons (full coverage)

### WorkflowTriggerJob.handle (@Process)
- `file:path:line` workflow-trigger/jobs/workflow-trigger.job.ts:36
- Signature: `(data: { workspaceId, workflowId, payload }) => Promise<void>`
- Loads the workflow, verifies it has a lastPublishedVersionId and that version is ACTIVE, then calls workflow-runner `run()` with the payload and a WORKFLOW actor source named after the workflow.

### ResumeDelayedWorkflowJob.handle (@Process, delayedJobsQueue)
- `file:path:line` workflow-executor/workflow-actions/delay/jobs/resume-delayed-workflow.job.ts:37
- Signature: `(data: ResumeDelayedWorkflowJobData) => Promise<void>`
- Fired after a delay elapses. Verifies the run is RUNNING and the delay step is PENDING, marks the delay step SUCCESS, then enqueues RunWorkflowJob with lastExecutedStepId to resume. On error ends the run as FAILED (system error).

### WorkflowRunEnqueueJob.handle / WorkflowHandleStaledRunsJob.handle / WorkflowCleanWorkflowRunsJob.handle (@Process)
- `file:path:line` workflow-run-queue/jobs/workflow-run-enqueue.job.ts:20, workflow-handle-staled-runs.job.ts:19, workflow-clean-workflow-runs.job.ts:31
- Thin delegators to their respective workspace services (`enqueueRunsForWorkspace`, `handleStaledRunsForWorkspace`) except clean, which inlines deletion.

### WorkflowCleanWorkflowRunsJob.deleteOldRuns / deleteExcessRunsPerWorkflow (private)
- `file:path:line` workflow-run-queue/jobs/workflow-clean-workflow-runs.job.ts:65,103
- Batch (200/loop) raw-SQL deletes: removes COMPLETED/FAILED runs older than RUNS_TO_CLEAN_THRESHOLD_DAYS, and trims each workflow's COMPLETED/FAILED runs beyond NUMBER_OF_WORKFLOW_RUNS_TO_KEEP using a ROW_NUMBER window partitioned by workflowId.

### WorkflowRunEnqueueCronJob.handle (@Process, every minute)
- `file:path:line` workflow-run-queue/cron/jobs/workflow-run-enqueue.cron.job.ts:51
- Partitions ACTIVE workspaces into 10 buckets (round-robin via a cached partition counter), and for the current bucket checks (raw SQL) whether each workspace has NOT_STARTED runs; if so enqueues WorkflowRunEnqueueJob. Processes in batches of 10 with Promise.allSettled and Sentry capture on failures.

### WorkflowHandleStaledRunsCronJob.handle (@Process, every 10 min)
- `file:path:line` workflow-run-queue/cron/jobs/workflow-handle-staled-runs.cron.job.ts:52
- Same partition/batch pattern; checks for ENQUEUED runs older than STALED_RUNS_THRESHOLD_MS (or null enqueuedAt) and enqueues WorkflowHandleStaledRunsJob per affected workspace.

### WorkflowCleanWorkflowRunsCronJob.handle (@Process, every 3 hours)
- `file:path:line` workflow-run-queue/cron/jobs/workflow-clean-workflow-runs.cron.job.ts:57
- Same partition/batch pattern; uses ORM (`getRunsToCleanFindOptions`) to detect old runs or workspaces over the keep-count, then enqueues WorkflowCleanWorkflowRunsJob.

---

## workflow-status jobs & listeners (full coverage)

### WorkflowStatusesUpdateJob.handle (@Process)
- `file:path:line` workflow-status/jobs/workflow-statuses-update.job.ts:67
- Signature: `(event: WorkflowVersionBatchEvent) => Promise<void>`
- For CREATE/DELETE/STATUS_UPDATE batch events, recomputes the parent workflow's `statuses` array from its versions and writes it only if changed.

### handleWorkflowVersionCreatedOrDeleted / handleWorkflowVersionStatusUpdated / getWorkflowStatuses (private)
- `file:path:line` workflow-status/jobs/workflow-statuses-update.job.ts:99,146,192
- `getWorkflowStatuses` derives [DRAFT?, ACTIVE?, DEACTIVATED?] from the workflow's versions (DEACTIVATED only added when there's no ACTIVE version). The two handlers fetch the workflow, recompute, and update if different.

### WorkflowVersionStatusListener
- `file:path:line` workflow-status/listeners/workflow-version-status.listener.ts:29
- `handleWorkflowVersionCreated` (@OnDatabaseBatchEvent workflowVersion CREATED:35), `handleWorkflowVersionUpdated` (@OnCustomBatchEvent WORKFLOW_VERSION_STATUS_UPDATED:67), `handleWorkflowVersionDeleted` (@OnDatabaseBatchEvent workflowVersion DELETED:85) — each filters relevant DRAFT/status events and enqueues a WorkflowStatusesUpdateJob with the appropriate event type and workflowIds/statusUpdates.

---

## workflow-trigger database-event listener (full coverage)

### WorkflowDatabaseEventTriggerListener
- `file:path:line` workflow-trigger/automated-trigger/listeners/workflow-database-event-trigger.listener.ts:44
- Subscribes via `@OnDatabaseBatchEvent('*', …)` to CREATED/UPDATED/DELETED/DESTROYED/UPSERTED (handlers at lines 56,73,91,108,125). Each clones the payload, enriches records with related (join) records, then `handleEvent` looks up `workflowAutomatedTrigger` rows of type DATABASE_EVENT whose `settings.eventName` matches, and for each matching listener+event enqueues a WorkflowTriggerJob (retryLimit 3).
- `enrich{Created,Updated,Deleted,Destroyed}Event` (141-234): hydrate before/after records with relations.
- `enrichRecordsWithRelations` (236): for each join column, batch-loads related records and attaches them under the relation field name.
- `shouldTriggerJob` (385): for UPDATED/UPSERTED, only triggers if the listener's `settings.fields` is empty or intersects the event's `updatedFields`; otherwise always triggers.

---

## NOT YET COVERED

Only genuinely trivial leftovers remain:
- Single-line type guards (`is-workflow-*-action.guard.ts`) — each is `step.type === WorkflowActionType.X`.
- `.type.ts` / `.constants.ts` files (data shapes and config values such as cache keys, TTLs, thresholds, partition counts).
- Per-type fake-value generators under `workflow-schema/utils/` (generate-fake-*), used only to produce sample output schemas for the builder UI.
- Query hooks under `common/query-hooks/*` (thin pre/post hooks delegating to the common/validation services already documented above).
- `*.spec.ts` test files and `create-mock-workflow-steps.util.ts` (test mock).

