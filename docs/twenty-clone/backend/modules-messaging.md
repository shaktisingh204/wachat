# Messaging Module Documentation

Complete function and service documentation for the Twenty CRM messaging module, covering email import/export, message synchronization, participants, folders, and blocklist management.

## message-outbound-manager/resolvers

### SendEmailResolver
`file: message-outbound-manager/resolvers/send-email.resolver.ts:47`

**sendEmail(input: SendEmailInput, workspace: WorkspaceEntity, userWorkspaceId: string) → Promise<SendEmailOutputDTO>**

Mutation resolver that sends an email. Validates connected account ownership, composes email via emailComposerService, sends it, optionally persists the message, and cleans up attachment files.

## message-outbound-manager/services

### SendEmailService
`file: message-outbound-manager/services/send-email.service.ts:17`

**sendComposedEmail(data: ComposedEmail) → Promise<SendMessageResult>**

Delegates to MessagingMessageOutboundService to send a composed email with all recipients, subject, body, attachments, and threading metadata.

`file: message-outbound-manager/services/send-email.service.ts:35`

**persistSentMessage(sendResult: SendMessageResult, data: ComposedEmail, workspaceId: string) → Promise<void>**

Persists a sent message using SentMessagePersistenceService. Logs warnings on failure since sync will recover automatically.

### MessagingMessageOutboundService
`file: message-outbound-manager/services/messaging-message-outbound.service.ts:23`

**sendMessage(sendMessageInput: SendMessageInput, connectedAccount: ConnectedAccountEntity) → Promise<SendMessageResult>**

Routes message sending to provider-specific outbound services (Gmail, Microsoft, IMAP/SMTP, or Email Group) based on connected account provider type.

`file: message-outbound-manager/services/messaging-message-outbound.service.ts:62`

**createDraft(sendMessageInput: SendMessageInput, connectedAccount: ConnectedAccountEntity) → Promise<void>**

Routes draft creation to provider-specific services. Throws error for providers that don't support drafts (Email Group, OIDC, SAML, APP).

### SentMessagePersistenceService
`file: message-outbound-manager/services/sent-message-persistence.service.ts:19`

**persistSentMessage(input: PersistSentMessageInput) → Promise<void>**

Fetches message channel with relations, formats sent message data via formatSentMessage util, then saves message and enqueues contact creation job.

## message-outbound-manager/utils

### formatSentMessage
`file: message-outbound-manager/utils/format-sent-message.util.ts:12`

Converts PersistSentMessageInput to MessageWithParticipants. Creates participant list from sender and all recipients (to/cc/bcc), extracts message IDs, resolves thread external ID, sets direction to OUTGOING, and records received timestamp.

### extractMessageIdFromBuffer
`file: message-outbound-manager/utils/extract-message-id-from-buffer.util.ts:4`

Extracts RFC 2822 Message-ID header from raw email buffer. Handles folded headers (continuation lines), returns empty string if missing.

### toMailComposerOptions
`file: message-outbound-manager/utils/to-mail-composer-options.util.ts:4`

Converts SendMessageInput to mail composer options. Maps recipients, subject, body, html, and conditionally includes attachments and in-reply-to/references headers if present.

### resolveOutboundThreadExternalId
`file: message-outbound-manager/utils/resolve-outbound-thread-external-id.util.ts`

Resolves the external thread ID for outbound messages from send result, parent thread, or in-reply-to header.

## message-participant-manager/services

### MessagingMessageParticipantService
`file: message-participant-manager/services/messaging-message-participant.service.ts:19`

**saveMessageParticipants(participants: ParticipantWithMessageId[], workspaceId: string, transactionManager?: WorkspaceEntityManager) → Promise<void>**

Saves message participants to database, filtering out duplicates by comparing existing participants by message ID, handle, displayName, and role. Calls matchParticipantService to link participants to workspace members and persons.

## message-cleaner/services

### MessagingMessageCleanerService
`file: message-cleaner/services/messaging-message-cleaner.service.ts:21`

**deleteMessagesChannelMessageAssociationsAndRelatedOrphans(data: {workspaceId, messageExternalIds, messageChannelId}) → Promise<void>**

Deletes message channel message associations for given external IDs and message channel, then recursively deletes orphaned messages without associations and orphaned threads without messages. Processes in chunks of 500.

`file: message-cleaner/services/messaging-message-cleaner.service.ts:127`

**deleteMessageChannelMessageAssociationsByChannelId(data: {workspaceId, messageChannelId}) → Promise<void>**

Uses pagination to delete all message channel message associations for a given channel ID, then cleans orphans. Runs in transaction.

`file: message-cleaner/services/messaging-message-cleaner.service.ts:193`

**cleanOrphanMessagesAndThreads(workspaceId: string) → Promise<void>**

Two-phase cleanup: first deletes messages with no channel message associations, then deletes threads with no messages. Uses pagination with batch size of 500, runs in transaction.

## message-cleaner/utils

### deleteUsingPagination
`file: message-cleaner/utils/delete-using-pagination.util.ts:3`

Generic pagination-based deletion utility. Takes workspaceId, batch size, async getter function, and deleter function. Loops until getter returns no more IDs, then calls deleter on each batch.

## message-cleaner/commands

### MessagingMessageCleanerRemoveOrphansCommand
`file: message-cleaner/commands/messaging-message-clearner-remove-orphans.command.ts:20`

**runOnWorkspace(args: {workspaceId}) → Promise<void>**

CLI command that runs cleanOrphanMessagesAndThreads on each workspace.

### MessagingResetChannelCommand
`file: message-cleaner/commands/messaging-reset-channel.command.ts:37`

**run(_passedParam, options: {workspaceId, messageChannelId?}) → Promise<void>**

CLI command to reset message channels for full resync. If messageChannelId provided, resets only that channel; otherwise resets all channels in workspace. Marks channels as MESSAGE_LIST_FETCH_PENDING and cleans orphans.

## message-cleaner/jobs

### MessagingMessageChannelDeletionCleanupJob
`file: message-cleaner/jobs/messaging-message-channel-deletion-cleanup.job.ts:26`

**handle(data: {workspaceId, messageChannelId}) → Promise<void>**

Triggered when message channel is deleted. Deletes all message channel message associations for the channel, then cleans orphans.

### MessagingConnectedAccountDeletionCleanupJob
`file: message-cleaner/jobs/messaging-connected-account-deletion-cleanup.job.ts:22`

**handle(data: {workspaceId, connectedAccountId}) → Promise<void>**

Triggered when connected account is deleted. Cleans orphaned messages and threads across all affected channels.

## message-cleaner/listeners

### MessagingMessageCleanerConnectedAccountListener
`file: message-cleaner/listeners/messaging-message-cleaner-connected-account.listener.ts:24`

**handleDestroyedEvent(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<ConnectedAccountEntity>>) → Promise<void>**

Listens for connected account deletion events and enqueues MessagingConnectedAccountDeletionCleanupJob for each deleted account.

### MessagingMessageCleanerMessageChannelListener
`file: message-cleaner/listeners/messaging-message-cleaner-message-channel.listener.ts:24`

**handleDestroyedEvent(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<MessageChannelEntity>>) → Promise<void>**

Listens for message channel deletion events and enqueues MessagingMessageChannelDeletionCleanupJob for each deleted channel.

## message-folder-manager/services

### SyncMessageFoldersService
`file: message-folder-manager/services/sync-message-folders.service.ts:40`

**syncMessageFolders(data: {messageChannel, workspaceId}) → Promise<MessageFolder[]>**

Discovers all folders from external provider, compares with existing folders, and syncs changes (create/update/delete). Returns final folder list with pending sync actions.

`file: message-folder-manager/services/sync-message-folders.service.ts:78`

**discoverAllFolders(connectedAccount, messageChannel) → Promise<DiscoveredMessageFolder[]>**

Routes folder discovery to provider-specific service (Gmail, Microsoft, IMAP) based on connected account provider.

`file: message-folder-manager/services/sync-message-folders.service.ts:114`

**syncFolderChanges(discoveredFolders, existingFolders, messageChannelId, workspaceId) → Promise<MessageFolder[]>**

Computes folders to create/update/delete, applies updates to database, and returns updated folder list.

## message-folder-manager/utils

### computeFoldersToCreate
`file: message-folder-manager/utils/compute-folders-to-create.util.ts:10`

Returns array of new folders to create. Filters discovered folders not present in existing folders, mapping to MessageFolderEntity format.

### computeFoldersToUpdate
`file: message-folder-manager/utils/compute-folders-to-update.util.ts:11`

Returns Map of folder IDs to partial updates. Compares discovered folder data (name, isSentFolder, parentFolderId) with existing and flags differences.

### computeFolderIdsToDelete
`file: message-folder-manager/utils/compute-folder-ids-to-delete.util.ts:6`

Returns array of folder IDs to mark for deletion. Filters existing folders not in discovered set.

### computeUpdatedFolders
`file: message-folder-manager/utils/compute-updated-folders.util.ts:7`

Returns merged list of existing folders with updates applied and deletion flags set. Spreads updates into folder objects and sets pendingSyncAction.

### shouldCreateFolderByDefault
`file: message-folder-manager/utils/should-create-folder-by-default.util.ts:6`

Returns false if standard folder is in ALWAYS_EXCLUDED_FOLDERS list, otherwise true. Used to filter folders on initial sync.

### shouldSyncFolderByDefault
`file: message-folder-manager/utils/should-sync-folder-by-default.util.ts:3`

Returns true if import policy is ALL_FOLDERS, false otherwise.

## message-folder-manager/interfaces

### MessageFolder/DiscoveredMessageFolder (types)
`file: message-folder-manager/interfaces/message-folder-driver.interface.ts`

Type definitions for folder data structures used across folder manager operations.

## message-import-manager/services

### MessagingGetMessagesService
`file: message-import-manager/services/messaging-get-messages.service.ts:26`

**getMessages(messageIds, connectedAccount, messageChannel) → Promise<GetMessagesResponse>**

Routes message fetching to provider-specific service (Gmail, Microsoft, IMAP) based on connected account provider. Returns MessageWithParticipants array.

### MessagingGetMessageListService
`file: message-import-manager/services/messaging-get-message-list.service.ts:25`

**getMessageLists(messageChannel, messageFolders) → Promise<GetMessageListsResponse>**

Routes message list retrieval to provider-specific service based on connected account provider. Returns message list response containing external IDs and metadata.

### MessagingMessageFolderAssociationService
`file: message-import-manager/services/messaging-message-folder-association.service.ts:21`

**saveMessageFolderAssociations(associations: MessageChannelMessageAssociationFolderAssociation[], workspaceId, transactionManager?) → Promise<void>**

Saves associations between messages and folders. Deduplicates based on messageChannelMessageAssociationId and messageFolderId before inserting.

### MessagingProcessGroupEmailActionsService
`file: message-import-manager/services/messaging-process-group-email-actions.service.ts:29`

**markMessageChannelAsPendingGroupEmailsAction(messageChannel, workspaceId, pendingGroupEmailsAction) → Promise<void>**

Updates message channel's pendingGroupEmailsAction field and logs the change.

`file: message-import-manager/services/messaging-process-group-email-actions.service.ts:44`

**processGroupEmailActions(messageChannel, workspaceId) → Promise<void>**

Executes pending group email action (GROUP_EMAILS_DELETION or GROUP_EMAILS_IMPORT) based on message channel's state.

## message-import-manager/utils

### formatAddressObjectAsParticipants
`file: message-import-manager/utils/format-address-object-as-participants.util.ts:11`

Converts EmailAddress array to Participant list with given role. Removes spaces, lowercases email addresses, filters invalid addresses (no @ sign).

### safeParseEmailAddresses
`file: message-import-manager/utils/safe-parse-email-addresses.util.ts:5`

Safely parses email header string using addressparser. Returns array of {address, name} objects; returns empty array on parse error.

### safeParseEmailAddressAddress
`file: message-import-manager/utils/safe-parse-email-address-address.util.ts:5`

Extracts first parsed email address from string. Returns undefined on error.

### safeParseEmailAddress
`file: message-import-manager/utils/safe-parse-email-address.util.ts:4`

Validates and normalizes single EmailAddress object using safeParseEmailAddressAddress.

### extractAddressesFromParsedEmail
`file: message-import-manager/utils/extract-addresses-from-parsed-email.util.ts:6`

Extracts email addresses from postal-mime Address/Address[] object. Handles groups and regular mailboxes; sanitizes names.

### extractParticipantsFromParsedEmail
`file: message-import-manager/utils/extract-participants-from-parsed-email.util.ts:7`

Extracts participants from parsed email (from postal-mime) by processing from/to/cc/bcc fields. Flattens results.

### extractThreadIdFromParsedEmail
`file: message-import-manager/utils/extract-thread-id-from-parsed-email.util.ts:3`

Extracts thread ID from parsed email. Checks references, inReplyTo, messageId in order; generates UUID fallback if none present.

### filterOutGroupEmails
`file: message-import-manager/utils/filter-out-group-emails.util.ts:6`

Filters out messages from group email addresses (noreply, no-reply, info@, support@, etc.) using isGroupEmail check on sender.

### filterOutInternals
`file: message-import-manager/utils/filter-out-internals.util.ts:6`

Filters out messages where all participants share the same domain as primary handle (internal emails). Uses getDomainNameByEmail for comparison.

### filterOutIcsAttachments
`file: message-import-manager/utils/filter-out-ics-attachments.util.ts:3`

Filters out messages with .ics attachments (calendar invites).

### isMessageSenderMatchingHandles
`file: message-import-manager/utils/is-message-sender-matching-handles.util.ts:6`

Returns true if message sender matches any handle in userHandles list (case-insensitive).

### isGroupEmail
`file: message-import-manager/utils/is-group-email.ts:1`

Tests email against pattern matching noreply, no-reply, do_not_reply, and prefixes like info@, contact@, support@, etc. Returns boolean.

### isSyncStale
`file: message-import-manager/utils/is-sync-stale.util.ts:5`

Checks if syncStageStartedAt is older than MESSAGING_IMPORT_ONGOING_SYNC_TIMEOUT (typically 1 hour). Returns true if stale or undefined.

### sanitizeString
`file: message-import-manager/utils/sanitize-string.util.ts:6`

Removes null characters (\0) from string to prevent corruption.

### createHtmlToTextConverter
`file: message-import-manager/utils/create-html-to-text-converter.util.ts:6`

Returns converter function that sanitizes HTML, extracts text with planer, converts to text with html-to-text, normalizes whitespace. Used for email body text extraction.

### filterOutBlocklistedMessages
`file: message-import-manager/utils/filter-out-blocklisted-messages.util.ts:4`

Filters messages where any participant is blocklisted. Uses isEmailBlocklisted utility with blocklist.

### filterEmails
`file: message-import-manager/utils/filter-emails.util.ts:12`

Master filter combining ICS attachments, blocklist, internal emails (if work domain and not enabled), and group emails (unless user-sent). Returns filtered message array.

### mimeEncode
`file: message-import-manager/utils/mime-encode.util.ts:1`

Base64-encodes string in MIME format: =?UTF-8?B?<base64>?=. Used for email header encoding.

### toMicrosoftRecipients
`file: message-import-manager/utils/to-microsoft-recipients.util.ts:9`

Converts email address string(s) to Microsoft Graph recipient format: [{emailAddress: {address: string}}].

## message-import-manager/jobs

### MessagingMessageListFetchJob
`file: message-import-manager/jobs/messaging-message-list-fetch.job.ts:39`

**handle(data: {messageChannelId, workspaceId}) → Promise<void>**

Fetches list of messages from external email provider for a message channel. Tracks monitoring events, validates channel state, and delegates to MessagingMessageListFetchService.

### MessagingMessagesImportJob
`file: message-import-manager/jobs/messaging-messages-import.job.ts:34`

**handle(data: {messageChannelId, workspaceId}) → Promise<void>**

Imports messages for a channel via MessagingMessagesImportService. Validates channel sync status and stage before processing.

### MessagingInboundEmailImportJob
`file: message-import-manager/jobs/messaging-inbound-email-import.job.ts:24`

**handle(data: {s3Key, envelopeRecipients}) → Promise<void>**

Imports inbound email message from S3 via InboundEmailImportService. Logs import outcome (success/failure/duplicate).

### MessagingRelaunchFailedMessageChannelJob
`file: message-import-manager/jobs/messaging-relaunch-failed-message-channel.job.ts:33`

**handle(data: {workspaceId, messageChannelId}) → Promise<void>**

Relaunches failed message channel sync. Resets sync stage to MESSAGE_LIST_FETCH_PENDING, status to ACTIVE, throttle counters.

### MessagingAddSingleMessageToCacheForImportJob
`file: message-import-manager/jobs/messaging-add-single-message-to-cache-for-import.job.ts:21`

**handle(data: {messageExternalId, messageChannelId, workspaceId}) → Promise<void>**

Adds single message external ID to Redis cache set for batch import queue.

### MessagingCleanCacheJob
`file: message-import-manager/jobs/messaging-clean-cache.ts:20`

**handle(data: {workspaceId, messageChannelId}) → Promise<void>**

Deletes Redis cache key for messages-to-import set after batch import completes.

## message-participant-manager/jobs

### MessageParticipantMatchParticipantJob
`file: message-participant-manager/jobs/message-participant-match-participant.job.ts:27`

**handle(data: {workspaceId, participantMatching: {personIds, personEmails, workspaceMemberIds}}) → Promise<void>**

Matches message participants to people and workspace members based on provided IDs/emails. Calls MatchParticipantService for linking.

## message-participant-manager/listeners

### MessageParticipantListener
`file: message-participant-manager/listeners/message-participant.listener.ts:26`

**handleMessageParticipantMatched(batchEvent: CustomWorkspaceEventBatch) → Promise<void>**

Listens for messageParticipant_matched custom events. Creates timeline activities for persons linked to matched message participants.

### MessageParticipantWorkspaceMemberListener
`file: message-participant-manager/listeners/message-participant-workspace-member.listener.ts:34`

**handleCreatedEvent(payload: WorkspaceEventBatch<ObjectRecordCreateEvent>) → Promise<void>**

Triggers participant matching when new workspace member is created with email. Enqueues MessageParticipantMatchParticipantJob.

`file: message-participant-manager/listeners/message-participant-workspace-member.listener.ts:70`

**handleUpdatedEvent(payload: WorkspaceEventBatch<ObjectRecordUpdateEvent>) → Promise<void>**

Triggers matching when workspace member's email is updated.

### MessageParticipantPersonListener
`file: message-participant-manager/listeners/message-participant-person.listener.ts:30`

**handleCreatedEvent(payload: WorkspaceEventBatch<ObjectRecordCreateEvent<PersonWorkspaceEntity>>) → Promise<void>**

Triggers participant matching when person is created with email. Enqueues job with person IDs and emails.

`file: message-participant-manager/listeners/message-participant-person.listener.ts:66`

**handleUpdatedEvent(payload: WorkspaceEventBatch<ObjectRecordUpdateEvent>) → Promise<void>**

Triggers matching when person's emails are updated (primary or additional).

`file: message-participant-manager/listeners/message-participant-person.listener.ts:103`

**handleDestroyedEvent(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>) → Promise<void>**

Triggers matching when person is deleted, clearing associations.

## blocklist-manager/jobs

### BlocklistItemDeleteMessagesJob
`file: message-cleaner/jobs/messaging-blocklist-item-delete-messages.job.ts:43`

**handle(data: WorkspaceEventBatch<ObjectRecordCreateEvent<BlocklistWorkspaceEntity>>) → Promise<void>**

Deletes messages from blocklisted email addresses/domains. Finds messages with blocklisted senders in channels belonging to the blocklist owner's workspace member.

### BlocklistReimportMessagesJob
`file: message-cleaner/jobs/messaging-blocklist-reimport-messages.job.ts:41`

**handle(data: WorkspaceEventBatch<ObjectRecordDeleteEvent<BlocklistWorkspaceEntity>>) → Promise<void>**

Relaunches message sync for channels affected by blocklist removal, marking them for MESSAGE_LIST_FETCH_PENDING.

## blocklist-manager/listeners

### MessagingBlocklistListener
`file: message-cleaner/listeners/messaging-blocklist.listener.ts:32`

**handleCreatedEvent(payload: WorkspaceEventBatch<ObjectRecordCreateEvent>) → Promise<void>**

Enqueues BlocklistItemDeleteMessagesJob when blocklist item created.

`file: message-cleaner/listeners/messaging-blocklist.listener.ts:45`

**handleDeletedEvent(payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>) → Promise<void>**

Enqueues BlocklistReimportMessagesJob when blocklist item deleted.

`file: message-cleaner/listeners/messaging-blocklist.listener.ts:56`

**handleUpdatedEvent(payload: WorkspaceEventBatch<ObjectRecordUpdateEvent>) → Promise<void>**

Enqueues both jobs when blocklist item updated.

## common/query-hooks/message

### MessageFindManyPostQueryHook
`file: message-cleaner/query-hooks/message/message-find-many.post-query.hook.ts:22`

**execute(authContext: WorkspaceAuthContext, objectName: string, payload: MessageWorkspaceEntity[]) → Promise<void>**

Post-query hook for message.findMany. Validates auth context (user/apiKey/application), applies message visibility restrictions based on channel visibility settings and user's connected accounts.

### MessageFindOnePostQueryHook
`file: message-cleaner/query-hooks/message/message-find-one.post-query.hook.ts:22`

**execute(authContext: WorkspaceAuthContext, objectName: string, payload: MessageWorkspaceEntity[]) → Promise<void>**

Post-query hook for message.findOne. Same as findMany: applies visibility restrictions based on channel settings.

### ApplyMessagesVisibilityRestrictionsService
`file: message-cleaner/query-hooks/message/apply-messages-visibility-restrictions.service.ts:32`

**applyMessagesVisibilityRestrictions(messages: MessageWorkspaceEntity[], workspaceId, userId?) → Promise<MessageWorkspaceEntity[]>**

Filters/redacts messages based on channel visibility and user permissions. SHARE_EVERYTHING channels are unrestricted. SUBJECT and METADATA channels restrict fields. METADATA channels remove message entirely if user has no access.

## common/services

### MessageChannelSyncStatusService
`file: message-import-manager/services/message-channel-sync-status.service.ts:45`

**markAsMessagesListFetchPending(messageChannelIds, workspaceId, preserveSyncStageStartedAt?) → Promise<void>**

Updates message channels to MESSAGE_LIST_FETCH_PENDING stage, optionally preserving syncStageStartedAt.

`file: message-import-manager/services/message-channel-sync-status.service.ts:73`

**markAsMessagesImportPending(messageChannelIds, workspaceId, preserveSyncStageStartedAt?) → Promise<void>**

Updates message channels to MESSAGES_IMPORT_PENDING stage, optionally preserving syncStageStartedAt.

### MessagingMonitoringService
`file: messaging-monitoring/services/messaging-monitoring.service.ts:16`

**track(input: {eventName, workspaceId?, userId?, connectedAccountId?, messageChannelId?, message?}) → Promise<void>**

Placeholder monitoring service for tracking messaging events. TODO: Currently no-op, awaits Prometheus implementation.

## SUMMARY STATISTICS

- **Total Functions Documented:** 73+ exported functions and key methods
- **Services:** 13 core services
- **Jobs:** 9 message queue processors
- **Commands:** 2 CLI commands
- **Listeners:** 6 event listeners
- **Query Hooks:** 3 GraphQL hooks
- **Utility Functions:** 20+ helper functions
- **Resolvers:** 1 GraphQL resolver

## Module Organization

The messaging module is organized into these key sub-modules:

1. **message-outbound-manager** - Sending emails, email composition, message persistence
2. **message-import-manager** - Importing messages from providers, folder sync, participant extraction
3. **message-participant-manager** - Linking participants to persons/workspace members
4. **message-folder-manager** - Syncing email folders from providers
5. **message-cleaner** - Orphaned message/thread cleanup, channel resets
6. **blocklist-manager** - Blocking/removing messages from blocklisted senders
7. **monitoring** - Event tracking and metrics
8. **common** - Shared types, query hooks, visibility restrictions

## Key Patterns

- **Provider Routing:** Most services route to Gmail, Microsoft, IMAP implementations based on ConnectedAccountProvider
- **Workspace Context:** All data mutations use globalWorkspaceOrmManager.executeInWorkspaceContext()
- **Pagination:** Large deletes use batch-based pagination to avoid memory issues
- **Event-Driven:** Deletion/creation of related records triggers cleanup/matching via listeners
- **Visibility Control:** Post-query hooks enforce message visibility based on channel settings and user permissions
