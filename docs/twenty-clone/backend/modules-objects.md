# Twenty-Server Backend Modules - Objects & Functions

Complete documentation of all exported functions, services, resolvers, and utilities across the twenty-server backend modules: company, person, opportunity, note, task, attachment, blocklist, connected-account, contact-creation-manager, match-participant, and workspace-member.

---

## Company

### standard-objects/company.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_COMPANY` - Array of field metadata for full-text search on company name and domain
- `CompanyWorkspaceEntity` - TypeORM entity class representing company objects in workspace with relations to people, opportunities, tasks, notes, and attachments

---

## Person

### standard-objects/person.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_PERSON` - Array of field metadata for full-text search on person name, emails, phones, and job title
- `PersonWorkspaceEntity` - TypeORM entity class extending BaseWorkspaceEntity with email/phone metadata, company relation, and relations to tasks, notes, messages, calendar events

---

## Opportunity

### standard-objects/opportunity.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_OPPORTUNITY` - Array of field metadata for full-text search on opportunity name
- `OpportunityWorkspaceEntity` - TypeORM entity class with currency amount, close date, stage, point of contact person, company relation, and relations to tasks, notes, attachments

---

## Attachment

### standard-objects/attachment.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_ATTACHMENT` - Array of field metadata for full-text search on attachment name
- `AttachmentWorkspaceEntity` - TypeORM entity class with file metadata, relations to multiple target objects (task, note, person, company, opportunity, dashboard, workflow)

---

## Blocklist

### standard-objects/blocklist.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_BLOCKLIST` - Array of field metadata for full-text search on blocklist handle/email
- `BlocklistWorkspaceEntity` - Entity representing email/domain blocklist entries with relation to workspace member

### blocklist-validation-manager/services/blocklist-validation.service.ts

**Service Methods:**

### `validateBlocklistForCreateMany`
`file:blocklist-validation.service.ts:41-48`
`(payload: CreateManyResolverArgs<BlocklistItem>, userId: string, workspaceId: string) => Promise<void>`
Validates schema and uniqueness for bulk blocklist creation. Ensures handles are valid emails or domains (@domain format) and don't duplicate existing entries for the current user.

### `validateBlocklistForUpdateOne`
`file:blocklist-validation.service.ts:50-59`
`(payload: UpdateOneResolverArgs<BlocklistItem>, userId: string, workspaceId: string) => Promise<void>`
Validates schema and uniqueness for single blocklist item update. Prevents changing workspace member association and enforces uniqueness.

### `validateSchema`
`file:blocklist-validation.service.ts:61-94`
`(blocklist: BlocklistItem[]) => Promise<void>`
Uses Zod schema to ensure each handle is either a valid email or a domain (prefixed with @). Throws CommonQueryRunnerException on validation failure.

### `validateUniquenessForCreateMany`
`file:blocklist-validation.service.ts:96-155`
`(payload: CreateManyResolverArgs<BlocklistItem>, userId: string, workspaceId: string) => Promise<void>`
Verifies new blocklist entries don't already exist for the current user and prevents creating entries for other workspace members.

### `validateUniquenessForUpdateOne`
`file:blocklist-validation.service.ts:157-223`
`(payload: UpdateOneResolverArgs<BlocklistItem>, userId: string, workspaceId: string) => Promise<void>`
Ensures updated handle doesn't duplicate existing handles and validates workspace member cannot be changed. Uses system auth context to bypass permissions.

### repositories/blocklist.repository.ts

**Repository Methods:**

### `getById`
`file:blocklist.repository.ts:13-36`
`(id: string, workspaceId: string) => Promise<BlocklistWorkspaceEntity | null>`
Retrieves a single blocklist entry by ID within workspace context using system auth. Bypasses permission checks.

### `getByWorkspaceMemberId`
`file:blocklist.repository.ts:38-60`
`(workspaceMemberId: string, workspaceId: string) => Promise<BlocklistWorkspaceEntity[]>`
Finds all blocklist entries for a given workspace member. Used to check for duplicates during validation.

### query-hooks/blocklist-create-one.pre-query.hook.ts

**Hook Class:** `BlocklistCreateOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:blocklist-create-one.pre-query.hook.ts:24-46`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: CreateOneResolverArgs<BlocklistItem>) => Promise<CreateOneResolverArgs<BlocklistItem>>`
Pre-query hook for single blocklist creation. Validates user auth context and calls validation service with wrapped payload array.

### query-hooks/blocklist-create-many.pre-query.hook.ts

**Hook Class:** `BlocklistCreateManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:blocklist-create-many.pre-query.hook.ts:24-44`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: CreateManyResolverArgs<BlocklistItem>) => Promise<CreateManyResolverArgs<BlocklistItem>>`
Pre-query hook for bulk blocklist creation. Validates user auth and delegates to validation service.

### query-hooks/blocklist-update-one.pre-query.hook.ts

**Hook Class:** `BlocklistUpdateOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:blocklist-update-one.pre-query.hook.ts:24-46`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: UpdateOneResolverArgs<BlocklistItem>) => Promise<UpdateOneResolverArgs<BlocklistItem>>`
Pre-query hook for single blocklist update. Validates user context and calls validation service to ensure uniqueness.

### query-hooks/blocklist-update-many.pre-query.hook.ts

**Hook Class:** `BlocklistUpdateManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:blocklist-update-many.pre-query.hook.ts:17-25`
`() => Promise<UpdateManyResolverArgs<BlocklistItem>>`
Pre-query hook that always throws exception since bulk update of blocklist is not permitted.

### utils/is-email-blocklisted.util.ts

### `isEmailBlocklisted`
`file:is-email-blocklisted.util.ts:1-19`
`(channelHandle: string[], email: string | null | undefined, blocklist: string[]) => boolean`
Checks if an email is in the blocklist. Returns false if email is the channel handle itself or undefined. Supports domain-based blocking (entries starting with @).

---

## Note

### standard-objects/note.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_NOTES` - Array of field metadata for full-text search on note title and rich text body
- `NoteWorkspaceEntity` - Entity with position, title, rich-text body, and relations to note targets and attachments

### standard-objects/note-target.workspace-entity.ts

**Exports:**
- `NoteTargetWorkspaceEntity` - Join entity linking notes to target objects (person, company, opportunity) with custom entity support

### query-hooks/note-post-query-hook.service.ts

**Service Methods:**

### `handleNoteTargetsDelete`
`file:note-post-query-hook.service.ts:18-41`
`(authContext: WorkspaceAuthContext, payload: NoteWorkspaceEntity[]) => Promise<void>`
Soft-deletes all note target records associated with deleted notes using In(noteIds) filter in a workspace context transaction.

### `handleNoteTargetsRestore`
`file:note-post-query-hook.service.ts:43-66`
`(authContext: WorkspaceAuthContext, payload: NoteWorkspaceEntity[]) => Promise<void>`
Restores soft-deleted note target records for restored notes. Performs inverse operation of delete via restore() method.

### query-hooks/note-delete-one.post-query.hook.ts

**Hook Class:** `NoteDeleteOnePostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:note-delete-one.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: NoteWorkspaceEntity[]) => Promise<void>`
Post-query hook that cascades deletion to associated note targets when a single note is deleted.

### query-hooks/note-delete-many.post-query.hook.ts

**Hook Class:** `NoteDeleteManyPostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:note-delete-many.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: NoteWorkspaceEntity[]) => Promise<void>`
Post-query hook cascading deletion to note targets for bulk note deletion.

### query-hooks/note-restore-one.post-query.hook.ts

**Hook Class:** `NoteRestoreOnePostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:note-restore-one.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: NoteWorkspaceEntity[]) => Promise<void>`
Post-query hook that restores associated note targets when a single note is restored from soft-delete.

### query-hooks/note-restore-many.post-query.hook.ts

**Hook Class:** `NoteRestoreManyPostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:note-restore-many.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: NoteWorkspaceEntity[]) => Promise<void>`
Post-query hook cascading restore to note targets for bulk note restoration.

---

## Task

### standard-objects/task.workspace-entity.ts

**Exports:**
- `SEARCH_FIELDS_FOR_TASKS` - Array of field metadata for full-text search on task title and rich text body
- `TaskWorkspaceEntity` - Entity with title, rich-text body, due date, status, assignee workspace member, and relations to task targets and attachments

### standard-objects/task-target.workspace-entity.ts

**Exports:**
- `TaskTargetWorkspaceEntity` - Join entity linking tasks to target objects (person, company, opportunity) with custom entity support

### query-hooks/task-post-query-hook.service.ts

**Service Methods:**

### `handleTaskTargetsDelete`
`file:task-post-query-hook.service.ts:18-41`
`(authContext: WorkspaceAuthContext, payload: TaskWorkspaceEntity[]) => Promise<void>`
Soft-deletes all task target records associated with deleted tasks using In(taskIds) filter.

### `handleTaskTargetsRestore`
`file:task-post-query-hook.service.ts:43-66`
`(authContext: WorkspaceAuthContext, payload: TaskWorkspaceEntity[]) => Promise<void>`
Restores soft-deleted task target records for restored tasks.

### query-hooks/task-delete-one.post-query.hook.ts

**Hook Class:** `TaskDeleteOnePostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:task-delete-one.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: TaskWorkspaceEntity[]) => Promise<void>`
Post-query hook cascading deletion to task targets for single task deletion.

### query-hooks/task-delete-many.post-query.hook.ts

**Hook Class:** `TaskDeleteManyPostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:task-delete-many.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: TaskWorkspaceEntity[]) => Promise<void>`
Post-query hook cascading deletion to task targets for bulk task deletion.

### query-hooks/task-restore-one.post-query.hook.ts

**Hook Class:** `TaskRestoreOnePostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:task-restore-one.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: TaskWorkspaceEntity[]) => Promise<void>`
Post-query hook restoring task targets when a single task is restored.

### query-hooks/task-restore-many.post-query.hook.ts

**Hook Class:** `TaskRestoreManyPostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:task-restore-many.post-query.hook.ts:21-30`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: TaskWorkspaceEntity[]) => Promise<void>`
Post-query hook cascading restore to task targets for bulk task restoration.

---

## Workspace Member

### standard-objects/workspace-member.workspace-entity.ts

**Exports:**
- `WorkspaceMemberDateFormatEnum` - Enum for date format preferences (SYSTEM, MONTH_FIRST, DAY_FIRST, YEAR_FIRST)
- `WorkspaceMemberTimeFormatEnum` - Enum for time format preferences (SYSTEM, HOUR_12, HOUR_24)
- `WorkspaceMemberNumberFormatEnum` - Enum for number format preferences (COMMAS_AND_DOT, SPACES_AND_COMMA, DOTS_AND_COMMA, APOSTROPHE_AND_DOT)
- `SEARCH_FIELDS_FOR_WORKSPACE_MEMBER` - Array of field metadata for full-text search on member name and email
- `WorkspaceMemberWorkspaceEntity` - Entity with locale, timezone, date/time/number formats, avatar URL, color scheme, and relations to tasks, companies, attachments, blocklist

### query-hooks/workspace-member-create-one.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberCreateOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-create-one.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<CreateOneResolverArgs>`
Pre-query hook that always denies single workspace member creation. Used to enforce that members are created through dedicated user management endpoints.

### query-hooks/workspace-member-create-many.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberCreateManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-create-many.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<CreateManyResolverArgs>`
Pre-query hook denying bulk workspace member creation. Ensures members are created through designated workflows.

### query-hooks/workspace-member-delete-one.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberDeleteOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-delete-one.pre-query.hook.ts:17-27`
`(_authContext: WorkspaceAuthContext) => Promise<RestoreOneResolverArgs>`
Pre-query hook preventing direct deletion. Directs users to use Settings or /deleteUserFromWorkspace endpoint instead.

### query-hooks/workspace-member-delete-one.post-query.hook.ts

**Hook Class:** `WorkspaceMemberDeleteOnePostQueryHook` (implements WorkspacePostQueryHookInstance)

### `execute`
`file:workspace-member-delete-one.post-query.hook.ts:33-93`
`(authContext: WorkspaceAuthContext, _objectName: string, payload: WorkspaceMemberWorkspaceEntity[]) => Promise<void>`
Post-query hook that finds the deleted member's user ID and calls userWorkspaceService.deleteUserWorkspace() to cascade cleanup of associated user-workspace relationships.

### query-hooks/workspace-member-delete-many.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberDeleteManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-delete-many.pre-query.hook.ts:17-27`
`(_authContext: WorkspaceAuthContext) => Promise<DeleteManyResolverArgs>`
Pre-query hook preventing bulk deletion. Directs to Settings or designated deletion endpoint.

### query-hooks/workspace-member-destroy-one.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberDestroyOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-destroy-one.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<DeleteOneResolverArgs>`
Pre-query hook denying permanent destruction of single workspace member record.

### query-hooks/workspace-member-destroy-many.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberDestroyManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-destroy-many.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<DeleteManyResolverArgs>`
Pre-query hook denying permanent bulk destruction of workspace member records.

### query-hooks/workspace-member-restore-one.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberRestoreOnePreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-restore-one.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<RestoreOneResolverArgs>`
Pre-query hook preventing single workspace member restoration. Enforces member management through designated endpoints.

### query-hooks/workspace-member-restore-many.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberRestoreManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-restore-many.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<RestoreManyResolverArgs>`
Pre-query hook preventing bulk workspace member restoration.

### query-hooks/workspace-member-update-many.pre-query.hook.ts

**Hook Class:** `WorkspaceMemberUpdateManyPreQueryHook` (implements WorkspacePreQueryHookInstance)

### `execute`
`file:workspace-member-update-many.pre-query.hook.ts:19-30`
`(authContext: WorkspaceAuthContext) => Promise<UpdateManyResolverArgs>`
Pre-query hook denying bulk updates to workspace members. Forces individual update operations.

### listeners/workspace-member-avatar-file-deletion.listener.ts

**Listener Class:** `WorkspaceMemberAvatarFileDeletionListener`

### `handleUpdate`
`file:workspace-member-avatar-file-deletion.listener.ts:27-35`
`(payload: WorkspaceEventBatch<ObjectRecordUpdateEvent<WorkspaceMemberWorkspaceEntity>>) => Promise<void>`
Listens for workspace member update events and deletes old avatar files when avatarUrl changes.

### `handleDestroyOrDeleteEvent`
`file:workspace-member-avatar-file-deletion.listener.ts:37-49`
`(payload: WorkspaceEventBatch<ObjectRecordDestroyEvent | ObjectRecordDeleteEvent>) => Promise<void>`
Listens for workspace member destruction/deletion and removes associated avatar files.

### `deleteCorePictures` (private)
`file:workspace-member-avatar-file-deletion.listener.ts:51-68`
`(fileIds: string[], workspaceId: string) => Promise<void>`
Calls fileCorePictureService.deleteCorePicture for each file ID. Catches EntityNotFoundError gracefully and continues.

### `getFileIdsToDeleteFromUpdateEvent` (private)
`file:workspace-member-avatar-file-deletion.listener.ts:70-95`
`(payload: WorkspaceEventBatch<ObjectRecordUpdateEvent>) => string[]`
Extracts file IDs where avatarUrl changed from update events by comparing before/after values.

### `getFileIdsToDeleteFromDestroyOrDeleteEvent` (private)
`file:workspace-member-avatar-file-deletion.listener.ts:97-116`
`(payload: WorkspaceEventBatch<ObjectRecordDestroyEvent | ObjectRecordDeleteEvent>) => string[]`
Extracts file IDs from the before avatar URLs in destroy/delete events.

---

## Connected Account

### channel-sync/channel-sync.resolver.ts

**Resolver Class:** `ChannelSyncResolver`

### `startChannelSync` (GraphQL Mutation)
`file:channel-sync.resolver.ts:31-49`
`(connectedAccountId: UUIDScalarType, workspace: WorkspaceEntity, userWorkspaceId: string) => Promise<ChannelSyncSuccessDTO>`
GraphQL mutation that verifies connected account ownership and initiates channel sync for both messaging and calendar channels. Requires CONNECTED_ACCOUNTS permission.

### channel-sync/services/channel-sync.service.ts

**Service Methods:**

### `startChannelSync`
`file:channel-sync.service.ts:49-54`
`(input: StartChannelSyncInput) => Promise<void>`
Orchestrates channel sync by delegating to message and calendar sync methods sequentially.

### `startMessageChannelSync` (private)
`file:channel-sync.service.ts:56-87`
`(connectedAccountId: string, workspaceId: string) => Promise<void>`
Finds pending message channels for the account, marks them as scheduled, and enqueues MessagingMessageListFetchJob for each.

### `startCalendarChannelSync` (private)
`file:channel-sync.service.ts:89-123`
`(connectedAccountId: string, workspaceId: string) => Promise<void>`
Finds pending calendar channels, updates their sync stage/status, and enqueues CalendarEventListFetchJob for processing.

### email-alias-manager/services/email-alias-manager.service.ts

**Service Methods:**

### `refreshHandleAliases`
`file:email-alias-manager.service.ts:24-69`
`(connectedAccount: ConnectedAccountEntity, workspaceId: string) => Promise<string[]>`
Routes to provider-specific alias manager (Google or Microsoft), fetches aliases, updates connected account record, and returns the list. Returns empty array for non-OAuth providers.

### email-alias-manager/drivers/google/services/google-email-alias-manager.service.ts

**Service Methods:**

### `getHandleAliases`
`file:google-email-alias-manager.service.ts:16-38`
`(connectedAccount: ConnectedAccountEntity) => Promise<string[]>`
Calls Gmail API sendAs.list endpoint to fetch all non-primary send-as addresses (aliases). Filters out primary address and empty entries.

### email-alias-manager/drivers/google/services/google-email-alias-error-handler.service.ts

**Service Methods:**

### `handleError`
`file:google-email-alias-error-handler.service.ts:18-36`
`(error: unknown) => void`
Logs error and routes to Gmail-specific error parsers. Throws MessageImportDriverException for unrecognized errors.

### email-alias-manager/drivers/microsoft/services/microsoft-email-alias-manager.service.ts

**Service Methods:**

### `getHandleAliases`
`file:microsoft-email-alias-manager.service.ts:14-44`
`(connectedAccount: ConnectedAccountEntity) => Promise<string[]>`
Calls Microsoft Graph /me?$select=proxyAddresses endpoint. Filters SMTP: entries (primary) and normalizes smtp: entries. Returns lowercase, non-empty addresses.

### services/accounts-to-reconnect.service.ts

**Service Methods:**

### `removeAccountToReconnect`
`file:accounts-to-reconnect.service.ts:15-28`
`(userId: string, workspaceId: string, connectedAccountId: string) => Promise<void>`
Iterates over all AccountsToReconnectKeys and removes the account ID from each stored list using userVarsService.

### `removeAccountToReconnectByKey` (private)
`file:accounts-to-reconnect.service.ts:30-66`
`(key: AccountsToReconnectKeys, userId: string, workspaceId: string, connectedAccountId: string) => Promise<void>`
Retrieves accounts list for key, filters out target account, updates or deletes the stored list depending on whether any remain.

### `addAccountToReconnectByKey`
`file:accounts-to-reconnect.service.ts:68-93`
`(key: AccountsToReconnectKeys, userId: string, workspaceId: string, connectedAccountId: string) => Promise<void>`
Retrieves existing accounts for key, appends account ID if not already present, and stores updated list via userVarsService.

### services/imap-smtp-caldav-apis.service.ts

**Service Methods:**

### `upsertConnectedAccount`
`file:imap-smtp-caldav-apis.service.ts:64-220`
`(input: { handle: string; userWorkspaceId: string; workspaceId: string; connectionParameters: PlaintextImapSmtpCaldavParams; existingAccount?: ConnectedAccountEntity | null }) => Promise<string>`
Creates or updates IMAP/SMTP/CalDAV connected account. Encrypts connection parameters, creates/updates message and calendar channels, syncs message folders, queues initial sync jobs, and removes account from reconnection list if re-authenticated.

### refresh-tokens-manager/services/connected-account-refresh-tokens.service.ts

**Service Methods:**

### `resolveTokens`
`file:connected-account-refresh-tokens.service.ts:55-88`
`(connectedAccount: ConnectedAccountEntity, workspaceId: string) => Promise<ConnectedAccountTokens>`
Returns cached encrypted tokens if access token is still valid (within 1-hour expiry with 5-min buffer), otherwise refreshes and re-encrypts tokens.

### `isAccessTokenStillValid` (private)
`file:connected-account-refresh-tokens.service.ts:148-180`
`(connectedAccount: ConnectedAccountEntity) => Promise<boolean>`
For OAuth providers, checks if lastCredentialsRefreshedAt is within expiry window. Returns true for non-OAuth providers.

### `refreshTokens`
`file:connected-account-refresh-tokens.service.ts:182-223`
`(connectedAccount: ConnectedAccountEntity, refreshToken: PlaintextString, workspaceId: string) => Promise<ConnectedAccountPlaintextTokens>`
Routes to provider-specific refresh handler (Google, Microsoft, or App OAuth). Logs errors and re-throws. Throws exception for unsupported providers.

### `getExistingEncryptedTokens` (private)
`file:connected-account-refresh-tokens.service.ts:90-105`
`(connectedAccount: ConnectedAccountEntity, workspaceId: string) => ConnectedAccountTokens`
Returns existing encrypted tokens. Throws exception if accessToken is missing.

### `performRefreshAndSave` (private)
`file:connected-account-refresh-tokens.service.ts:107-146`
`(connectedAccount: ConnectedAccountEntity, encryptedRefreshToken: EncryptedString, workspaceId: string) => Promise<ConnectedAccountTokens>`
Decrypts refresh token, calls refreshTokens, re-encrypts both tokens, updates database with new tokens and lastCredentialsRefreshedAt timestamp, returns encrypted pair.

### refresh-tokens-manager/drivers/google/services/google-api-refresh-tokens.service.ts

**Service Methods:**

### `refreshTokens`
`file:google-api-refresh-tokens.service.ts:19-51`
`(refreshToken: PlaintextString) => Promise<ConnectedAccountPlaintextTokens>`
Uses Google OAuth2 client to refresh access token via getAccessToken(). Returns new access token with original refresh token unchanged.

### refresh-tokens-manager/drivers/microsoft/services/microsoft-api-refresh-tokens.service.ts

**Service Methods:**

### `refreshTokens`
`file:microsoft-api-refresh-tokens.service.ts:18-54`
`(refreshToken: PlaintextString) => Promise<ConnectedAccountPlaintextTokens>`
Uses MSAL ConfidentialClientApplication.acquireTokenByRefreshToken() to refresh. Extracts new refresh token from token cache and returns both tokens.

### `extractRefreshTokenFromCache` (private)
`file:microsoft-api-refresh-tokens.service.ts:56-63`
`(msalClient: ConfidentialClientApplication) => PlaintextString`
Parses MSAL token cache JSON and extracts the refresh token secret from the first entry in RefreshToken collection.

### listeners/connected-account.listener.ts

**Listener Class:** `ConnectedAccountListener`

### `handleDestroyedEvent`
`file:connected-account.listener.ts:26-57`
`(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<ConnectedAccountEntity>>) => Promise<void>`
Listens for connected account destruction events and calls accountsToReconnectService to clean up user preferences for removed accounts.

### listeners/connected-account-workspace-member.listener.ts

**Listener Class:** `ConnectedAccountWorkspaceMemberListener`

### `handleWorkspaceMemberRemovalEvent`
`file:connected-account-workspace-member.listener.ts:29-46`
`(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent | ObjectRecordDestroyEvent>) => Promise<void>`
Listens for workspace member destruction/deletion and enqueues DeleteWorkspaceMemberConnectedAccountsCleanupJob for cascade cleanup.

### jobs/delete-workspace-member-connected-accounts.job.ts

**Job Processor:** `DeleteWorkspaceMemberConnectedAccountsCleanupJob`

### `handle`
`file:delete-workspace-member-connected-accounts.job.ts:30-66`
`(data: DeleteWorkspaceMemberConnectedAccountsCleanupJobData) => Promise<void>`
Finds the workspace member and associated user workspace, then deletes all connected accounts for that user workspace within the workspace.

### oauth2-client-manager/drivers/google/google-oauth2-client.provider.ts

**Provider Methods:**

### `getClient`
`file:google-oauth2-client.provider.ts:29-85`
`(connectedAccountId: string) => Promise<Auth.OAuth2Client>`
Retrieves connected account, validates it's a Google provider, resolves tokens (refreshing if needed), decrypts refresh token, creates OAuth2Client with refresh token set, and returns ready-to-use client.

### oauth2-client-manager/drivers/microsoft/microsoft-oauth2-client.provider.ts

**Provider Methods:**

### `getClient`
`file:microsoft-oauth2-client.provider.ts:27-74`
`(connectedAccountId: string) => Promise<Client>`
Retrieves connected account, validates it's a Microsoft provider, resolves tokens, decrypts access token, creates MicrosoftOAuth2ClientAuthProvider with access token, and initializes Microsoft Graph Client.

### oauth2-client-manager/drivers/microsoft/microsoft-oauth2-client-auth-provider.ts

**Auth Provider Class:** `MicrosoftOAuth2ClientAuthProvider` (implements AuthenticationProvider)

### `getAccessToken`
`file:microsoft-oauth2-client-auth-provider.ts:6-8`
`() => Promise<string>`
Returns the stored access token as a resolved promise. Implements AuthenticationProvider interface for Microsoft Graph Client.

### refresh-tokens-manager/drivers/google/utils/parse-google-oauth-error.util.ts

### `parseGoogleOAuthError`
`file:parse-google-oauth-error.util.ts:9-82`
`(error: unknown) => ConnectedAccountRefreshAccessTokenException`
Maps Google OAuth2 error codes (400, 401, 403, 429, 5xx) to specific ConnectedAccountRefreshAccessTokenException codes. Returns INVALID_REFRESH_TOKEN for 400/401/403 and TEMPORARY_NETWORK_ERROR for 429/5xx.

### refresh-tokens-manager/drivers/microsoft/utils/parse-msal-error.util.ts

### `parseMsalError`
`file:parse-msal-error.util.ts:33-83`
`(error: unknown) => ConnectedAccountRefreshAccessTokenException`
Converts MSAL errors (InteractionRequiredAuthError, ServerError, AuthError) to appropriate exception codes. Maps transient errors to TEMPORARY_NETWORK_ERROR and permanent auth errors to INVALID_REFRESH_TOKEN.

### utils/is-throttled.ts

### `isThrottled`
`file:is-throttled.ts:6-38`
`(syncStageStartedAt: string | null, throttleFailureCount: number, throttleRetryAfter?: string | null) => boolean`
Returns true if retryAfter date is in future, or if exponential backoff (2^(count-1) * MESSAGING_THROTTLE_DURATION) period hasn't elapsed since syncStageStartedAt.

### `computeThrottlePauseUntil` (private)
`file:is-throttled.ts:40-48`
`(syncStageStartedAt: string, throttleFailureCount: number) => Date`
Calculates backoff deadline using exponential backoff formula based on failure count and throttle duration constant.

---

## Contact Creation Manager

### services/create-company-and-contact.service.ts

**Service Class:** `CreateCompanyAndPersonService`

### `createCompaniesAndPeople`
`file:create-company-and-contact.service.ts:49-171`
`(connectedAccount: ConnectedAccountEntity, contactsToCreate: Contact[], workspaceId: string, source: FieldActorSource, accountOwner: WorkspaceMemberWorkspaceEntity | null) => Promise<DeepPartial<PersonWorkspaceEntity>[]>`
Core contact creation logic. Filters self/workspace members, finds existing people, determines creates vs restores, creates companies, and persists people with enriched names. Returns created/restored people.

### `createCompaniesAndPeopleAndUpdateParticipants`
`file:create-company-and-contact.service.ts:173-230`
`(connectedAccount: ConnectedAccountEntity, contactsToCreate: Contact[], workspaceId: string, source: FieldActorSource) => Promise<void>`
Batches contacts and calls createCompaniesAndPeople for each batch with exception handling. Used by async job processing.

### `computeContactsThatNeedPersonCreateAndRestoreAndWorkDomainNamesToCreate`
`file:create-company-and-contact.service.ts:232-340`
`(...) => object`
Determines which contacts need creation vs restore vs enrichment. Builds map of existing people by email, identifies work domains for company creation.

### `computePeopleToEnrichNames` (private)
`file:create-company-and-contact.service.ts:346-421`
`(uniqueContacts: Contact[], map: Map<string, { existingPerson: PersonWorkspaceEntity }>) => { personId: string; name: FullNameMetadata }[]`
Extracts people created via EMAIL/CALENDAR sources with empty first/last names and stages enrichments. First non-empty value wins across contacts.

### `formatPeopleToCreateFromContacts`
`file:create-company-and-contact.service.ts:423-471`
`(...) => Partial<PersonWorkspaceEntity>[]`
Transforms contact objects into PersonWorkspaceEntity shape with parsed names, primary emails, company ID lookup, and createdBy metadata.

### `formatPeopleToRestoreFromContacts`
`file:create-company-and-contact.service.ts:473-509`
`(...) => { personId: string; companyId: string | undefined }[]`
Maps contacts to restore records with person ID and optional company ID from the company map.

### services/create-company.service.ts

**Service Class:** `CreateCompanyService`

### `createOrRestoreCompanies`
`file:create-company.service.ts:45-160`
`(companies: CompanyToCreate[], workspaceId: string) => Promise<{ [domainName: string]: string }>`
Deduplicates companies, searches for existing ones by domain, creates new companies with Clearbit data, restores soft-deleted ones, and returns map of domain -> company ID.

### `filterCompaniesToRestore` (private)
`file:create-company.service.ts:162-184`
`(uniqueCompanies: CompanyToCreate[], existingCompanies: CompanyWorkspaceEntity[]) => object[]`
Identifies soft-deleted companies that match domains in the input set and returns candidates for undelete.

### `prepareCompanyData` (private)
`file:create-company.service.ts:186-215`
`(company: CompanyToCreate, position: number) => Promise<DeepPartial<CompanyWorkspaceEntity>>`
Enriches company data with name/city from Clearbit API (with fallback), builds createdBy metadata, and returns formatted entity.

### `createCompanyMap` (private)
`file:create-company.service.ts:217-233`
`(companies: Pick<CompanyWorkspaceEntity, 'id' | 'domainName'>[]) => { [domainName: string]: string }`
Reduces company array to domain -> ID map by extracting domain from primaryLinkUrl.

### `getLastCompanyPosition` (private)
`file:create-company.service.ts:235-244`
`(companyRepository: WorkspaceRepository<CompanyWorkspaceEntity>) => Promise<number>`
Queries maximum position value. Used for ordering new companies after existing ones.

### `getCompanyInfoFromDomainName` (private)
`file:create-company.service.ts:246-267`
`(domainName: string | undefined) => Promise<{ name: string; city: string }>`
HTTP GET to Clearbit API. Falls back to generateName on error and returns empty city.

### services/create-person.service.ts

**Service Class:** `CreatePersonService`

### `createPeople`
`file:create-person.service.ts:17-52`
`(peopleToCreate: Partial<PersonWorkspaceEntity>[], workspaceId: string) => Promise<DeepPartial<PersonWorkspaceEntity>[]>`
Inserts people records with position values (continuing from last) in workspace context. Returns created records.

### `restorePeople`
`file:create-person.service.ts:54-91`
`(people: { personId: string; companyId: string | undefined }[], workspaceId: string) => Promise<DeepPartial<PersonWorkspaceEntity>[]>`
Bulk updates soft-deleted people records, clearing deletedAt and setting company ID. Returns updated records.

### `enrichPeopleNames`
`file:create-person.service.ts:93-127`
`(peopleToEnrich: { personId: string; name: FullNameMetadata }[], workspaceId: string) => Promise<DeepPartial<PersonWorkspaceEntity>[]>`
Bulk updates person name fields for people created via auto-import with empty names.

### `getLastPersonPosition` (private)
`file:create-person.service.ts:129-139`
`(personRepository: WorkspaceRepository<PersonWorkspaceEntity>) => Promise<number>`
Queries maximum person position for ordering new records.

### jobs/create-company-and-contact.job.ts

**Job Processor:** `CreateCompanyAndContactJob`

### `handle`
`file:create-company-and-contact.job.ts:26-38`
`(data: CreateCompanyAndContactJobData) => Promise<void>`
Dequeues job data and calls createCompaniesAndPeopleAndUpdateParticipants with participants matching.

### utils/extract-domain-from-link.util.ts

### `extractDomainFromLink`
`file:extract-domain-from-link.util.ts:1-5`
`(link: string) => string`
Strips protocol, www, and path segments to extract domain from URL. Regex-based simple extraction.

### utils/get-company-name-from-domain-name.util.ts

### `getCompanyNameFromDomainName`
`file:get-company-name-from-domain-name.util.ts:6-14`
`(domainName: string) => string`
Uses psl library to parse domain and extract second-level domain (SLD), then capitalizes it. Returns empty string on error.

### utils/get-domain-name-from-handle.util.ts

### `getDomainNameFromHandle`
`file:get-domain-name-from-handle.util.ts:5-15`
`(handle: string) => string`
Extracts email domain, uses psl to parse it, and returns the full domain (e.g., "google.com" from "user@gmail.com"). Returns empty on parse error.

### utils/get-first-name-and-last-name-from-handle-and-display-name.util.ts

### `getFirstNameAndLastNameFromHandleAndDisplayName`
`file:get-first-name-and-last-name-from-handle-and-display-name.util.ts:7-18`
`(handle: string, displayName: string) => ParsedName`
Tries parsing displayName first, falls back to handle parsing. Capitalizes both first and last names. Returns { firstName, lastName }.

### utils/get-parsed-name-from-display-name.util.ts

### `getParsedNameFromDisplayName`
`file:get-parsed-name-from-display-name.util.ts:9-68`
`(displayName: string) => ParsedName`
Parses display name with support for comma-inverted ("Last, First") and space-separated formats. Strips quotes, handles group tags (e.g., "Group:Name"), splits on first comma or spaces. Delegates email local part parsing.

### utils/get-parsed-name-from-email-local-part.util.ts

### `getParsedNameFromEmailLocalPart`
`file:get-parsed-name-from-email-local-part.util.ts:5-15`
`(localPart: string) => ParsedName`
Splits on '+' (email tags) and '.' (name separators), returns first part as firstName and rest joined as lastName.

### utils/get-parsed-name-from-handle.util.ts

### `getParsedNameFromHandle`
`file:get-parsed-name-from-handle.util.ts:4-8`
`(handle: string) => ParsedName`
Extracts email local part and delegates to getParsedNameFromEmailLocalPart.

### utils/get-unique-contacts-and-handles.util.ts

### `getUniqueContactsAndHandles`
`file:get-unique-contacts-and-handles.util.ts:6-23`
`(contacts: Contact[]) => { uniqueContacts: Contact[]; uniqueHandles: string[] }`
Deduplicates contacts by lowercase handle using lodash uniq/uniqBy. Returns both contact list and handle list.

### utils/filter-out-contacts-that-belong-to-self-or-workspace-members.util.ts

### `filterOutContactsThatBelongToSelfOrWorkspaceMembers`
`file:filter-out-contacts-that-belong-to-self-or-workspace-members.util.ts:9-51`
`(contacts: Contact[], connectedAccount: ConnectedAccountEntity, workspaceMembers: WorkspaceMemberWorkspaceEntity[], isInternalMessagesImportEnabled?: boolean) => Contact[]`
Excludes contacts matching connected account handle/aliases, workspace member emails, or on the same work domain (unless internal import enabled).

### utils/has-primary-email-changed.ts

### `hasPrimaryEmailChanged`
`file:has-primary-email-changed.ts:5-12`
`(diff: Partial<ObjectRecordDiff<PersonWorkspaceEntity>>) => boolean`
Compares before/after primaryEmail (lowercase) from diff object. Returns true if different.

### utils/compute-changed-additional-emails.ts

### `computeChangedAdditionalEmails`
`file:compute-changed-additional-emails.ts:5-32`
`(diff: Partial<ObjectRecordDiff<PersonWorkspaceEntity>>) => { addedAdditionalEmails: string[]; removedAdditionalEmails: string[] }`
Compares before/after additionalEmails arrays (lowercase), returns set differences.

### constants/contacts-creation-batch-size.constant.ts

### Export:
- `CONTACTS_CREATION_BATCH_SIZE` = 100

### types/contact.type.ts

### Export:
- `Contact` type - { handle: string; displayName: string }

### types/parsed-name.type.ts

### Export:
- `ParsedName` type - { firstName: string; lastName: string }

### types/is-psl-parsed-domain.type.ts

### `isParsedDomain` (type guard)
`file:is-psl-parsed-domain.type.ts:4-8`
`(result: ReturnType<typeof psl.parse>) => result is ParsedDomain`
Type guard checking that parse result has no error and sld property exists.

---

## Match Participant

### match-participant.service.ts

**Service Class:** `MatchParticipantService<ParticipantWorkspaceEntity>`

### `matchParticipants`
`file:match-participant.service.ts:83-207`
`(args: MatchParticipantsArgs<ParticipantWorkspaceEntity>) => Promise<void>`
Chunked batch matching (200 per chunk). Queries people and workspace members by email. Updates participant records with matched personId/workspaceMemberId based on matchWith strategy. Emits custom event for matched participants.

### `matchParticipantsForWorkspaceMembers`
`file:match-participant.service.ts:209-242`
`(args: MatchParticipantsForWorkspaceMembersArgs) => Promise<void>`
Finds participants linked to given workspace member IDs, clears workspaceMemberId, and rematch via matchWith: 'workspaceMemberOnly' strategy.

### `matchParticipantsForPeople`
`file:match-participant.service.ts:244-299`
`(args: MatchParticipantsForPeopleArgs) => Promise<void>`
Finds participants by personIds or personEmails, clears personId, and rematch via matchWith: 'personOnly' strategy.

### `getParticipantRepository` (private)
`file:match-participant.service.ts:66-81`
`(workspaceId: string, objectMetadataName: 'messageParticipant' | 'calendarEventParticipant') => Promise<Repository>`
Returns appropriate repository (message or calendar event participant) based on metadata name.

### utils/add-person-email-filters-to-query-builder.ts

### `addPersonEmailFiltersToQueryBuilder`
`file:add-person-email-filters-to-query-builder.ts:21-65`
`(options: AddPersonEmailFiltersToQueryBuilderOptions) => SelectQueryBuilder<PersonWorkspaceEntity>`
Builds query to find people by primary or additional emails. Uses LOWER() for case-insensitive primary email matching and PostgreSQL jsonb @> operator for additional emails array. Supports excluding person IDs.

### utils/find-person-by-primary-or-additional-email.ts

### `findPersonByPrimaryOrAdditionalEmail`
`file:find-person-by-primary-or-additional-email.ts:3-33`
`(args: { people: PersonWorkspaceEntity[]; email: string }) => PersonWorkspaceEntity | undefined`
Linear search through people array. Tries matching primary email first, then additional emails (case-insensitive). Returns first match or undefined.

---

## Connected Account - Additional

### channel-sync/dtos/channel-sync-success.dto.ts

### Export:
- `ChannelSyncSuccessDTO` - GraphQL ObjectType with single success boolean field

### oauth2-client-manager/drivers/microsoft/microsoft-oauth2-client-auth-provider.ts (already documented above)

### email-alias-manager/drivers/microsoft/mocks/microsoft-api-examples.ts

### Export:
- `microsoftGraphMeResponseWithProxyAddresses` - Mock response object showing SMTP/smtp format proxy addresses

### types/accounts-to-reconnect-key-value.type.ts

### Exports:
- `AccountsToReconnectKeys` enum - ACCOUNTS_TO_RECONNECT_INSUFFICIENT_PERMISSIONS, ACCOUNTS_TO_RECONNECT_EMAIL_ALIASES
- `AccountsToReconnectKeyValueType` - Type mapping enum keys to string[] values

---

## Summary

**Total Functions Documented:** 94

**Breakdown by Category:**
- Workspace Entities & Classes: 10
- GraphQL Resolvers: 1
- NestJS Services: 24
- Query Hooks (Pre/Post): 20
- Repository Methods: 2
- Listeners: 5
- Job Processors: 2
- OAuth2 Providers: 2
- Auth Providers: 1
- Utility Functions: 25
- Type Guards & Type Exports: 2

**Key Patterns:**
1. **Workspace Isolation:** Most services use GlobalWorkspaceOrmManager.executeInWorkspaceContext() with system auth context to operate within workspace boundaries
2. **Query Hooks:** Pre-query hooks validate/transform inputs; post-query hooks cascade operations (delete targets, cleanup files)
3. **Service Composition:** Higher-level services (CreateCompanyAndPersonService) orchestrate lower-level services (CreateCompanyService, CreatePersonService)
4. **Error Handling:** Custom exceptions with specific codes for different failure modes (e.g., ConnectedAccountRefreshAccessTokenException codes)
5. **Batch Processing:** Large operations chunked (200-1000) to manage memory and database load
