I have everything. Here is the compact inventory.

# WaChat rust-client backend inventory

All files in `src/lib/rust-client/`. Each module exports a namespaced `*Api` object whose methods shim `rustFetch` (adds Rust engine base URL + auth). Endpoints below are relative to the Rust crate base shown per file. Use these before rebuilding any backend.

## Contacts
- **wachat-contacts.ts** → `wachatContactsApi` (BASE `/v1/contacts`)
  - `add` POST `/` create contact · `list` GET `/` paginated list · `importContacts` POST `/import` bulk import · `updateDetails` PATCH `/{id}` edit fields · `updateStatus` PATCH status · `updateTags` PATCH tags · `delete` DELETE `/{id}`

## Broadcast
- **wachat-broadcast.ts** → `wachatBroadcastApi` (BASE `/v1/wachat/broadcast`)
  - `adminList` GET `/` all broadcasts · `listForProject` GET project broadcasts · `getById` GET one · `listAttempts` GET `/{id}/attempts` · `exportAttempts` GET attempts export · `listLogs` GET `/{id}/logs` · `start` POST `/start` · `bulkStart` POST `/bulk-start` · `apiStart` POST `/api-start` · `requeue` POST `/{id}/requeue` · `stop` POST `/{id}/stop` · `requeueStuck` POST `/admin/requeue-stuck` (cron) · plus a multipart upload helper returning `{id}`

## Templates
- **wachat-templates-actions.ts** → `wachatTemplatesActionsApi` (BASE `/v1/wachat/templates-actions`)
  - `list` GET `/list` · `sync` POST `/sync` from Meta · `create` POST `/create` · `bulkCreate` POST `/bulk-create` · `createFlow` POST `/create-flow` · `edit` POST `/edit` · `deleteByName` / `deleteById` POST · `libraryList` GET `/library/list` · `librarySave` POST · `libraryDelete` POST `/library/{id}/delete` · `libraryApply` POST apply library template to project

## Flows
- **wachat-flows.ts** → `wachatFlowsApi` (BASE `/v1/flows`)
  - `listFlows` GET `/?project_id` · `getFlow` GET `/{id}` · `saveFlow` POST `/` create/update · `deleteFlow` DELETE `/{id}` · `builderData` GET `/builder-data` (builder bootstrap data)

## Pay (WhatsApp Pay configs / transactions)
- **wachat-pay.ts** → `wachatPayApi` (BASE `/v1/wachat/pay`)
  - `listConfigurations` / `getConfiguration` GET · `createConfiguration` POST · `updateDataEndpoint` POST data-endpoint URL · `regenerateOauth` POST oauth · `deleteConfiguration` DELETE · `syncLocal` POST resync local · `listTransactions` GET · `refundTransaction` POST refund (idempotency key)

## Calling
- **wachat-calling.ts** → `wachatCallingApi` (BASE `/v1/wachat/calling`)
  - `getSettings` GET per phone-number · `saveSettings` POST calling settings · `listLogs` GET call logs

## Analytics
- **wachat-analytics.ts** → `wachatAnalyticsApi` (BASE `/v1/wachat/analytics`)
  - `conversationAnalytics` POST · `templateAnalytics` POST · `messagingLimitTier` POST tier · `localMessageAnalytics` POST (local Mongo agg) · `broadcastAnalytics` POST

## Messaging / Send (WhatsApp Cloud send + inbox)
- **whatsapp-send.ts** → `whatsappSendApi` (BASE `/v1/wachat`)
  - Sends: `send` POST `/messages/send` (text/media/template/interactive — dispatches on `kind`) · `sendCatalog` · `sendCtaUrl` · `sendLocationRequest` · `sendAddress` · `sendOrderDetails` · `sendOrderStatus` (all POST `/messages/*`)
  - Inbox: `resolveContact` POST `/contacts/resolve` · `initialChatData` GET bootstrap · `getConversation` GET `/conversations/{contactId}` · `markConversationAsRead` / `markConversationAsUnread` POST
  - Pay: `sendPaymentRequest` POST `/payment-requests/send` · `getPaymentRequestStatus` GET · `listPaymentRequests` GET

## Config (project / WABA / phone-number provisioning)
- **wachat-config.ts** → `wachatConfigApi` (BASE `/v1/wachat/config`)
  - Project: `getPublicProject` GET `/projects/{id}/public` · `manualSetup` POST `/projects/manual-setup` · `getProjectByWaba` GET `/projects/by-waba/{wabaId}`
  - Phone numbers: `syncPhoneNumbers` POST · `updatePhoneProfile` POST profile · `registerPhone` · `requestVerificationCode` · `verifyCode` · `deregisterPhone` · `setTwoStepPin` (all under `/projects/{id}/phone-numbers/{pnId}/...`)
  - Webhooks: `getWebhookSubscription` GET · `subscribeAllWebhooks` POST `/webhooks/subscribe-all` · `subscribeWebhook` POST
  - QR codes: `listQrCodes` GET · `createQrCode` POST · `updateQrCode` POST · `deleteQrCode` DELETE
  - Widget/Graph: `saveWidgetSettings` POST · `getMeBusinesses` GET (token) · `getWabaDetails` GET · `updateWabaName` POST

## Features (Phase-6 inbox/CRM extras — large surface)
- **wachat-features.ts** → `wachatFeaturesApi` (BASE `/v1/wachat/features`)
  - Labels: `getChatLabels`/`saveChatLabel`/`deleteChatLabel`/`assignLabelToContact`
  - Notes: `getContactNotes`/`addContactNote`/`deleteContactNote`
  - Ratings: `getChatRatings`/`submitChatRating`
  - Conversations: `searchConversations`/`getContactTimeline`/`transferConversation`/`getTransferHistory`/`getUnassignedConversations`/`assignConversation`/`exportChatHistory`
  - Agents: `getAgentStatuses`/`setAgentStatus`/`getAgentPerformance`
  - Scheduling: `getScheduledMessages`/`scheduleMessage`/`cancelScheduledMessage`/`getScheduledBroadcasts`/`scheduleBroadcast`/`cancelScheduledBroadcast`
  - Automation: `getAutoReplyRules`/`saveAutoReplyRule`/`deleteAutoReplyRule`/`getChatbotResponses`/`saveChatbotResponse`/`deleteChatbotResponse`
  - Canned content: `getSavedReplies`/`saveSavedReply`/`deleteSavedReply`/`getQuickReplyCategories`(+save/delete)/`getMessageTags`(+save/delete)
  - Bulk/groups/opt-out: `sendBulkMessages`/`getContactGroups`(+save/delete)/`getOptOutList`(+add/remove)/`getBlockedContacts`(+block/unblock)/`getBlacklist`(+add/bulkAdd/remove)
  - Segments: `getConversationTags`/`getBroadcastSegments`(+save/delete)
  - Analytics: `getTemplateAnalytics`/`getMessageAnalytics`/`getDeliveryReport`/`getMessageStatistics`/`getCreditUsage`/`getLinkClicks`
  - Hours/messages: `getBusinessHours`(+save)/`getGreetingMessage`(+save)/`getAwayMessage`(+save)/`getNotificationPreferences`(+save)
  - Misc: `getPhoneNumberProfiles`/`updatePhoneProfile` · `getMediaLibrary`(+save/delete) · `getApiKeys`/`createApiKey`/`revokeApiKey` · `getWebhookLogs`/`getImportHistory` · `getConversationFilters`(+save/delete) · `getWabaHealth`/`getPhoneNumberHealth` · `getConversationalAutomation`(+update/delete) · `getCommerceSettings`(+update)

## Webhooks (admin/ops)
- **wachat-webhook.ts** → `wachatWebhookApi` (BASE `/v1/wachat/webhook/admin`): `listLogs` · `getPayload` · `reprocess` · `clearProcessed`
- **wachat-webhook-actions.ts** → `wachatWebhookActionsApi` (BASE `/v1/wachat/webhook-actions`): `listLogs` GET `/logs` · `getPayload` · `reprocess` · `clearProcessed` (action-pipeline logs, separate from legacy admin)
- **wachat-webhook-status.ts** → `wachatWebhookStatusApi` (BASE `/v1/wachat/webhook-status`): `broadcastStatuses` POST batch message-status lookup

## API keys (public-API admin)
- **wachat-api-keys-admin.ts** → `wachatApiKeysAdminApi` (BASE `/v1/api-keys`, no trailing slash): `generate` POST · `list` GET · `revoke` POST `/{id}/revoke`

## Ads (Meta Ad Manager)
- **wachat-ads-accounts.ts** → `wachatAdsAccountsApi` (BASE `/v1/ads/accounts`): `getAdAccounts`/`syncAdAccounts`/`getAdAccountDetails`/`deleteAdAccount`/`getAdAccountSpend`/`getAdAccountCapabilities`/`getAdAccountActivities`/`listAdAccountUsers`/`listAdAccountAgencies`/`listBusinessInvoices`/`listBusinessUsers`/`listBusinessPartners`/`listExtendedCredits`/`getFacebookPagesForAdCreation`/`getInstagramAccountsForPage`/`getInstagramBusinessAccount`
- **wachat-ads-audiences.ts** → `wachatAdsAudiencesApi` (BASE `/v1/ads/audiences`): custom audiences (`get/create/delete/addUsers/removeUsers/share/listShared`), `createLookalikeAudience`, `createWebsiteRetargetingAudience`, saved audiences (`get/create/delete`), targeting (`search/browse/suggest/validate/getTargetingSentenceLines`), estimates (`getReachEstimate/getDeliveryEstimate`), reach-frequency predictions (`list/create`)
- **wachat-ads-pixels.ts** → `wachatAdsPixelsApi` (BASE `/v1/ads/pixels`): `listPixels`/`createPixel`/`getPixelStats`/`sharePixelWithAdAccount` · custom conversions (`list/create`) · `sendConversionApiEvent` (CAPI) · offline events (`listOfflineEventSets`/`uploadOfflineEvents`) · lead-gen (`listLeadGenForms`/`getLeadsFromForm`) · catalogs (`listCatalogs`/`listProductSets`/`createProductSet`)

## Facebook (Pages platform)
- **wachat-facebook-pages.ts** → `wachatFacebookPagesApi` (BASE `/v1/facebook/pages`): `handleFacebookPageSetup`/`handleFacebookOAuthCallback`(live onboarding)/`handleManualFacebookPageSetup` · `getFacebookPages`/`getPageDetails`/`handleUpdatePageDetails` · insights (`getPageInsights`/`getDetailedPageInsights`/`getPageFanDemographics`) · `getPageSettings`/`getPageLocations`/`getPageTabs`/`getPageRoles` · CTA (`getPageCallToAction`/`setPageCallToAction`) · tokens (`debugAccessToken`/`refreshLongLivedToken`) · live video (`getPageLiveVideos`/`createLiveVideo`/`endLiveVideo`/`getLiveVideoComments`)
- **wachat-facebook-content.ts** → `wachatFacebookContentApi` (BASE `/v1/facebook/content`): posts (`get/create/bulkCreate/update/delete/publishScheduled/getInsights`), crossposting (`getEligibleCrosspostPages`/`crosspostVideo`), `getScheduledPosts`/`getPublishedPosts`, visitor posts (`get/hide/markSpam`), `getTaggedPosts`, photos/albums (`getPagePhotos/getPageAlbums/createPhotoAlbum/getAlbumPhotos/getPhotoDetails/getPhotoInsights`), videos (`getPageVideos/getVideoDetails/getVideoInsights/addVideoThumbnail/getVideoPlaylists/getPlaylistVideos`), reels (`getPageReels/publishPageReel`), stories (`getPageStories/publishPhotoStory/publishVideoStory`), `getPageRatings`
- **wachat-facebook-messaging.ts** → `wachatFacebookMessagingApi` (BASE `/v1/facebook/messaging`): Messenger inbox (`getConversations/searchConversations/getChatInitialData/getConversationMessages/markConversationAsRead`), sends (`sendTextMessage/sendMediaMessage/sendButtonTemplate/sendGenericTemplate/sendQuickReplies`), handover protocol (`passThreadControl/takeThreadControl/requestThreadControl/getSecondaryReceivers`), notifications (`sendOneTimeNotifRequest/sendOneTimeNotification/sendRecurringNotifOptIn/sendRecurringNotification`)
- **wachat-facebook-messenger-profile.ts** → `wachatFacebookMessengerProfileApi` (BASE `/v1/facebook/messenger-profile`): `getMessengerProfile`, `setMessengerGreeting/setMessengerGetStarted/setMessengerIceBreakers/setWhitelistedDomains/deleteMessengerProfileFields/savePersistentMenu`, personas (`get/create/delete`), saved responses (`get/create/update/delete`), `uploadReusableAttachment`
- **wachat-facebook-comments.ts** → `wachatFacebookCommentsApi` (BASE `/v1/facebook/comments`): `handlePostComment/handleDeleteComment/handleLikeObject/getPostComments/getCommentReplies/getObjectReactions/sendPrivateReply`
- **wachat-facebook-agents.ts** → `wachatFacebookAgentsApi` (BASE `/v1/facebook/agents`): AI agents (`get/create/update/delete`), knowledge docs (`get/upload/delete`), moderation rules (`get/save/delete`), `handleUpdateCommentAutoReply`, audience segments (`get/save/delete`)
- **wachat-facebook-automation.ts** → `wachatFacebookAutomationApi` (BASE `/v1/facebook/automation`): `updateAutomationSettings`, randomizer (`saveRandomizerSettings/getRandomizerPosts/addRandomizerPost/deleteRandomizerPost`), FB broadcasts (`getFacebookBroadcasts/sendFacebookBroadcast`), live streams (`getScheduledLiveStreams/scheduleLiveStream`)
- **wachat-facebook-business.ts** → `wachatFacebookBusinessApi` (BASE `/v1/facebook/business`): BM details + owned assets (`getBusinessDetails/getBusinessOwnedPages/getBusinessOwnedAdAccounts/getBusinessOwnedInstagramAccounts`), users (`getBusinessSystemUsers/getBusinessUsers/getBusinessPendingUsers/inviteBusinessUser`), commerce orders (`getCommerceMerchantSettings/getFacebookOrders/fulfillOrder/cancelOrder/refundOrder`)
- **wachat-facebook-crm.ts** → `wachatFacebookCrmApi` (BASE `/v1/facebook/crm`): Messenger CRM — `listSubscribers/updateSubscriberStatus`, kanban (`getKanbanData/saveKanbanStatuses`), labels (`getCustomLabels/createCustomLabel/deleteCustomLabel/getLabelsForUser/assignLabelToUser/removeLabelFromUser`), `blockProfile/unblockProfile`
- **wachat-facebook-events.ts** → `wachatFacebookEventsApi` (BASE `/v1/facebook/events`): `getFacebookEvents/getEventDetails/handleCreateFacebookEvent/handleUpdateFacebookEvent/deleteFacebookEvent/getEventAttendees`
- **wachat-facebook-lead-gen.ts** → `wachatFacebookLeadGenApi` (BASE `/v1/facebook/lead-gen`): `getLeadGenForms/getLeadsForForm/getLeadById`
- **wachat-facebook-leadgen-config.ts** → bare exported functions (no Api object): `getLeadGenConfig` GET `/v1/facebook/lead-gen/config` · `saveLeadGenConfig` POST · `deleteLeadGenForm` DELETE `/config/{formId}` · `getLeadGenConfigForms` GET `/config/forms` · `getLeadGenActivity` GET `/activity`
- **wachat-facebook-misc.ts** → `wachatFacebookMiscApi` (BASE `/v1/facebook/misc`): `getBlockedProfiles/getSubscribedApps/updateWebhookSubscription/unsubscribeApp/getMessagingFeatureReview/getPublishingAuthStatus`, competitors (`getTrackedCompetitors/addCompetitor/removeCompetitor/syncCompetitorData`)

## Instagram
- **wachat-instagram.ts** → `wachatInstagramApi` (BASE `/v1/instagram`, all under `/projects/{id}/...`): `getAccount/listMedia/getMediaDetails/getComments/getStories/discoverAccount/createImagePost/searchHashtagId/getHashtagRecentMedia/getHashtagTopMedia/getReels/getMediaInsights/getConversations/getConversationMessages`

---
Notes: every fn routes through the Rust engine via `rustFetch` (`./fetcher`) — these are NOT Next.js Mongo writes; the persistence/Graph-API calls happen Rust-side. `whatsapp-send.ts` is the canonical WhatsApp Cloud send path. `wachat-facebook-pages.handleFacebookOAuthCallback` is the live onboarding entry point.

========================================

I now have everything I need. All three hand-written routes hit real backends (server actions/Mongo, Redis pub/sub, Mongo + crypto). The codegen'd routes are all thin Rust proxies. Here is the inventory.

---

# WaChat API Route Inventory

**Total:** 95 `route.ts` files. **92 are codegen'd thin proxies** (`@generated by tools/api-codegen`) using `withApiV1(...)` → `rustFetchAsUser(ctx.tenantId, path, ...)` → `NextResponse.json(data)`. They are real-backend (Rust) but contain **zero business logic** — pure pass-through to the Rust crates at the same `/v1/wachat/*` path, scope-gated via api-platform. **3 are hand-written** under `src/app/api/wachat/`.

**Backend legend:** RUST = Rust engine via `rustFetchAsUser`; MONGO = direct Mongo; ACTIONS = Next server actions; REDIS = ioredis pub/sub.

## Hand-written routes (`/api/wachat/*`) — real logic

| Path | Methods | What it does | Backend |
|---|---|---|---|
| `/api/wachat/dashboard` | GET | Aggregates dashboard stats + chart + latest 5 broadcasts for `?projectId`. 400 if missing, 500 on error. | ACTIONS (`dashboard.actions`, `broadcast.actions`) |
| `/api/wachat/stream` | GET | SSE endpoint; subscribes to Redis channel `sabnode:wachat:realtime:<projectId>`, streams messages + 30s heartbeats. 400 no projectId, **503 if no `REDIS_URL`**. | REDIS |
| `/api/wachat/flows/endpoint/[phoneNumberId]` | POST | WhatsApp Flows data-exchange webhook. Verifies Meta HMAC sig, looks up RSA private key from project, decrypts/encrypts payload, dispatches `handleFlowAction` (ping/INIT/BACK/data_exchange). NOTE: `handleFlowAction` is a **deliberately minimal default** (echoes data / acks) — needs project-specific logic for concrete flows. | MONGO + crypto + Meta Graph |

## Codegen'd Rust proxies (`/api/v1/wachat/*`) — all RUST-backed, no local logic

### Core / chat / messaging
| Path | Methods | Scope |
|---|---|---|
| `/v1/wachat/config` | GET, PATCH | read / write |
| `/v1/wachat/features` | GET | read |
| `/v1/wachat/analytics/summary` | GET | read |
| `/v1/wachat/calling` | GET | read |
| `/v1/wachat/calling/initiate` | POST | write |
| `/v1/wachat/chat/initial` | GET | read |
| `/v1/wachat/chat/conversation/[contactId]` | GET | read |
| `/v1/wachat/chat/mark-read/[contactId]` | POST | write |
| `/v1/wachat/contacts/resolve` | POST | read |
| `/v1/wachat/messages/send` | POST | write |
| `/v1/wachat/messages/catalog` | POST | write |
| `/v1/wachat/messages/cta-url` | POST | write |
| `/v1/wachat/messages/location-request` | POST | write |
| `/v1/wachat/messages/order-details` | POST | write |
| `/v1/wachat/messages/order-status` | POST | write |
| `/v1/wachat/pay/request` | POST | write |
| `/v1/wachat/pay/transactions` | GET | read |
| `/v1/wachat/templates` | GET (`/list`), POST (`/create`) | read / write |
| `/v1/wachat/templates/[templateId]` | GET, DELETE | read / write |
| `/v1/wachat/templates/send` | POST | write |

(Scopes shown as `[]` in my scan for chat/messages/projects/templates are multi-line in source but follow the same read=GET / write=mutation convention.)

### Flows CRUD scaffold (`/v1/wachat/flows/*`) — full generic object surface
| Path | Methods |
|---|---|
| `/flows` | GET, POST |
| `/flows/[flowId]` | GET, PUT, PATCH, DELETE |
| `/flows/count`, `/search`, `/autocomplete`, `/export` | GET |
| `/flows/import`, `/sync` | POST |
| `/flows/[flowId]/status`, `/activity`, `/history`, `/audit-log`, `/related` | GET |
| `/flows/[flowId]/activate`, `/deactivate`, `/archive`, `/restore`, `/duplicate`, `/lock`, `/unlock`, `/transfer`, `/validate` | POST |
| `/flows/[flowId]/comments` | GET, POST · `/comments/[commentId]` DELETE |
| `/flows/[flowId]/notes` | GET, POST · `/notes/[noteId]` DELETE |
| `/flows/[flowId]/tags` | GET, POST · `/tags/[tagId]` DELETE |
| `/flows/[flowId]/shares` | GET, POST · `/shares/[shareId]` DELETE |
| `/flows/[flowId]/attachments` | GET, POST · `/attachments/[attachmentId]` DELETE |
| `/flows/bulk` | POST, PATCH, DELETE · `/bulk/archive`, `/bulk/restore`, `/bulk/tag` POST |

### Projects CRUD scaffold (`/v1/wachat/projects/*`) — identical shape to flows
| Path | Methods |
|---|---|
| `/projects` | GET, POST |
| `/projects/[projectId]` | GET, PUT, PATCH, DELETE |
| `/projects/count`, `/search`, `/autocomplete`, `/export` | GET |
| `/projects/import`, `/sync` | POST |
| `/projects/[projectId]/status`, `/activity`, `/history`, `/audit-log`, `/related` | GET |
| `/projects/[projectId]/activate`, `/deactivate`, `/archive`, `/restore`, `/duplicate`, `/lock`, `/unlock`, `/transfer`, `/validate` | POST |
| `/projects/[projectId]/comments` | GET, POST · `/comments/[commentId]` DELETE |
| `/projects/[projectId]/notes` | GET, POST · `/notes/[noteId]` DELETE |
| `/projects/[projectId]/tags` | GET, POST · `/tags/[tagId]` DELETE |
| `/projects/[projectId]/shares` | GET, POST · `/shares/[shareId]` DELETE |
| `/projects/[projectId]/attachments` | GET, POST · `/attachments/[attachmentId]` DELETE |
| `/projects/bulk` | POST, PATCH, DELETE · `/bulk/archive`, `/bulk/restore`, `/bulk/tag` POST |

## Key takeaways for page-wiring
- **No stub/501/empty routes** exist — every route hits a real backend (Rust, Mongo, Redis, or server actions).
- The **flows** and **projects** trees are auto-generated generic-object CRUD scaffolds (count/search/bulk/tags/notes/comments/shares/attachments/lock/transfer/audit). They are wired to Rust but may expose more surface than any current page uses.
- **Real WhatsApp send** for app pages: `POST /v1/wachat/messages/send` and `/templates/send` (Rust-backed), distinct from the personal-WhatsApp engine-client path.
- **Live data feed** for chat/inbox pages: SSE at `/api/wachat/stream` (requires `REDIS_URL`, else 503).
- **One genuine gap:** `/api/wachat/flows/endpoint/[phoneNumberId]`'s `handleFlowAction` is a placeholder default (acks/echoes); concrete flow business logic is not implemented there.

========================================

I have everything needed. Producing the inventory.

# WaChat Server Actions Inventory

All `*.actions.ts` files are `'use server'`. Most WaChat actions delegate to the **Rust engine** via `rustClient` (`@/lib/rust-client`) — real persistence happens in the Rust crates over Mongo, NOT local mock state. A few use native Mongo (`clientPromise` / `.collection()`). All are production-grade backends.

## src/app/actions/*.actions.ts

### whatsapp.actions.ts (god file, ~50 actions → `rustClient`)
Namespaces: `wachatConfig`, `whatsappSend`, `wachatPay`. `revalidatePath` on mutations.
- **Setup/config** (`wachatConfig`): `getPublicProjectById`, `_createProjectFromWaba` (1 `insertOne`), `handleManualWachatSetup`, `handleSyncPhoneNumbers`, `handleUpdatePhoneNumberProfile`, `registerPhoneNumber`, `handleRequestVerificationCode`, `handleVerifyCode`, `deregisterPhoneNumber`, `handleSetTwoStepVerificationPin`.
- **Webhook subscribe**: `getWebhookSubscriptionStatus`, `handleSubscribeAllProjects`, `handleSubscribeProjectWebhook`.
- **Messaging/chat** (`whatsappSend`): `handleSendMessage`, `findOrCreateContact`, `getInitialChatData`, `getConversation`, `markConversationAsRead/Unread`, `handleSendCatalogMessage`, `handleSendCtaUrlMessage`, `handleSendLocationRequestMessage`, `handleSendAddressMessage`, `handleSendOrderDetailsMessage`, `handleSendOrderStatusMessage`.
- **Payments** (`wachatPay`): `handleRequestWhatsAppPayment`, `getPaymentRequestStatus`, `getPaymentRequests`, `getPaymentConfigurations`, `handleCreate/Update/Delete PaymentConfiguration`, `handleUpdateDataEndpoint`, `handleRegenerateOauthLink`, `getPaymentConfigurationByName`, `getTransactionsForProject`, `refundTransaction`.
- **QR codes**: `getQrCodes`, `handleCreate/Update/Delete QrCode`.
- **Health**: `getWabaHealthStatus`, `getPhoneNumberHealthStatus`.
- **Automation/commerce**: `getConversationalAutomation`, `handleUpdate/Delete ConversationalAutomation`, `getCommerceSettings`, `handleUpdateCommerceSettings`.

### broadcast.actions.ts → `rustClient.wachatBroadcast` (+`templates`, `metaFlows`)
- Reads: `getAllBroadcasts` (adminList), `getBroadcasts` (listForProject), `getBroadcastById`, `getBroadcastAttempts`, `getBroadcastAttemptsForExport`, `getBroadcastLogs`.
- Mutations (persist + send via Rust): `handleStartBroadcast`, `handleBulkBroadcast`, `handleStartApiBroadcast`, `handleRequeueBroadcast`, `handleStopBroadcast`, `startCronBroadcast`. Uses `uploadMedia`, `getFlow` for previews.

### template.actions.ts → `rustClient.wachatTemplatesActions`
- Reads: `getTemplates` (list), `getLibraryTemplates` (libraryList).
- Mutations: `handleSyncTemplates` (sync from Meta), `handleCreateTemplate`, `handleBulkCreateTemplate`, `handleCreateFlowTemplate`, `handleEditTemplate`, `handleDeleteTemplate`/`handleDeleteTemplateById`, `saveLibraryTemplate`, `deleteLibraryTemplate`, `handleApplyTemplateToProjects` (libraryApply).

### contact.actions.ts → `rustClient.wachatContacts`
`handleAddNewContact` (add), `handleImportContacts` (importContacts, CSV FormData), `getContactsPageData` (list), `handleUpdateContactDetails`, `handleUpdateContactStatus`, `updateContactTags`, `deleteContact`.

### send-template.actions.ts → `rustClient.templates.send`
- `handleSendTemplateMessage` — single template send via Rust.

### wachat-features.actions.ts (~60 actions → `rustClient.wachatFeatures`)
The big shared feature backend (all persist in Rust). Groups:
- **Labels**: get/save/delete ChatLabel, `assignLabelToContact`.
- **Scheduled msgs**: `getScheduledMessages`, `scheduleMessage`, `cancelScheduledMessage`.
- **Notes**: get/add/delete ContactNote; `exportChatHistory`.
- **Auto-reply**: get/save/delete AutoReplyRule.
- **Segments**: get/save/delete BroadcastSegment.
- **Analytics**: `getTemplateAnalytics`, `getMessageAnalytics`, `getAgentPerformance`, `getChatRatings`, `getLinkClicks`.
- **Groups**: get/save/delete ContactGroup.
- **Opt-out/Block/Blacklist**: get/add/remove OptOut, block/unblockContact, get/add/remove/bulkAdd Blacklist.
- **Quick replies / Saved replies / Chatbot responses**: get/save/delete each category & response.
- **Business hours / Greeting / Away / Notification prefs**: get/save each.
- **Routing**: `getUnassignedConversations`, `assignConversation`, `autoRouteConversations` (round-robin/skill-based), agent statuses.
- **Media**: `getMediaLibrary`, `saveMediaItem`, `deleteMediaItem`.
- `submitChatRating`, `getConversationTags`. (1 stray `fetch(`.)

### whatsapp-pay.actions.ts → `rustClient.wachatPay`
`getPaymentConfigurations`, `getPaymentConfigurationByName`, `handleCreate/Update(DataEndpoint)/Delete PaymentConfiguration`, `handleRegenerateOauthLink`, `handlePaymentConfigurationUpdate` (syncLocal). Overlaps the pay slice in whatsapp.actions.ts.

### whatsapp-analytics.actions.ts → `rustClient.wachatAnalytics`
`getConversationAnalytics`, `getTemplateAnalytics`, `getMessagingLimitTier`, `getLocalMessageAnalytics`, `getBroadcastAnalytics`. Read-only reporting.

### marketing/whatsapp-chatbots.actions.ts → **native Mongo** `.collection('whatsapp_bots')`
`getWhatsappBots`, `getWhatsappBot(id)`, `createWhatsappBot` (insertOne), `updateWhatsappBot` (updateOne), `deleteWhatsappBot` (deleteOne). `revalidatePath`. NOT Rust — direct Mongo CRUD.

## Per-page src/app/wachat/**/actions.ts

| File | Export(s) | Persists / Calls |
|---|---|---|
| `webhooks/actions.ts` | `pingWebhookUrl(url, secret)` | `fetch()` test-ping to webhook URL; no DB write |
| `whatsapp-link-generator/actions.ts` | `shortenUrlAction(originalUrl)` | `fetch()` to URL-shortener; returns short URL, no DB |
| `auto-reply-rules/actions.ts` | `updateAutoReplyRuleOrder(ruleIds)` | Native Mongo `.collection('wa_auto_reply_rules')` updateOne (reorder) + revalidate |
| `media-library/actions.ts` | `getPresignedUploadUrl`, `getMediaLibraryMeta`, `updateMediaMeta`, `renameMediaLocal`, `getMediaUsage` | R2 presign + native Mongo `.collection('wachat_media_meta')` updateOne (tags/folder/rename) |
| `settings/agents/actions.ts` | `getAgentOpenTickets`, `reassignAndRemoveAgent`, `updateProjectRoutingRules`, `updateAgentSkills` | Native Mongo `.collection('projects')`/`('contacts')` updateOne/updateMany (agent reassign, routing, skills) |
| `integrations/whatsapp-link-generator/actions.ts` | `saveGeneratedLink(projectId, url)` | Native Mongo `.collection('wa_link_clicks')` insertOne + revalidate |

## Notes for callers
- **Rust-backed** (real persistence, use freely): whatsapp, broadcast, template, contact, send-template, wachat-features, whatsapp-pay, whatsapp-analytics. Engine via `rustClient` → fails loud if Rust down (see "two-store gotcha" — must use Rust path, not native Mongo, or data silently vanishes).
- **Native-Mongo-backed** (also real, `clientPromise`/`@/lib/mongodb`): marketing/whatsapp-chatbots, auto-reply-rules, media-library, settings/agents, integrations/whatsapp-link-generator.
- **No-persist helpers** (fetch only, fine as-is): webhooks `pingWebhookUrl`, whatsapp-link-generator `shortenUrlAction`.
- **Overlap warning**: payment config actions exist in BOTH `whatsapp.actions.ts` and `whatsapp-pay.actions.ts`; template/message analytics exist in both `whatsapp-analytics.actions.ts` and `wachat-features.actions.ts` — prefer the dedicated file.

========================================

I have all the patterns confirmed. Producing the cheat-sheet.

# HOW TO WIRE A WACHAT FEATURE — canonical patterns

Copy these. Reference page: `src/app/wachat/contacts/page.tsx`. Shell: `src/app/wachat/_components/wachat-page.tsx`.

## 1. The page shell (every WaChat page)

Always render inside `<WachatPage>` from `@/app/wachat/_components/wachat-page`. It owns width, the one responsive gutter (the fix for uneven padding), breadcrumb, and the `PageHeader`. Wraps children in `.ui20` so `--st-*` tokens resolve.

```tsx
'use client';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Contacts' },          // last item: no href
];

<WachatPage breadcrumb={BREADCRUMB} title="Contacts" description="…"
  actions={<Button variant="primary">Add</Button>} width="wide">
  {/* body */}
</WachatPage>
```
`width`: `'default'` (1320px) | `'narrow'` (880px, forms) | `'wide'` (1560px, tables). `variant="app"` = full-bleed (inbox/kanban/canvas), children own the whole frame, no header.

## 2. Active project + phone-number-id (CLIENT)

There is **no server session for the active project** — it lives client-side in `@/context/project-context` (backed by `localStorage['activeProjectId']`). Every client page reads it via the hook:

```tsx
import { useProject } from '@/context/project-context';
const { activeProject, activeProjectId } = useProject();
// activeProject is WithId<Project>; tags live at activeProject.tags;
// phoneNumberId comes off the contact/record or activeProject's phone numbers.
if (!activeProjectId) return <WachatPage …><EmptyState title="No project selected" …/></WachatPage>;
```
Pass `activeProjectId` + `phoneNumberId` explicitly into every server action / fetch — the backend does not infer it.

## 3. Authenticated user (SERVER)

Two distinct auth paths — pick by entry point:

- **Server actions / RSC** → `import { getSession } from '@/app/actions/user.actions'`. It decodes the httpOnly `session` cookie (`cookies()`), then resolves the user via Rust (`/v1/session`) with a Mongo fallback. Returns `{ user } | null`.
  ```ts
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required.' };
  ```
- **Public API routes (`/api/v1/*`)** → wrap with `withApiV1(handler, { scope: 'wachat:read' })` from `@/lib/api-platform`. It does API-key auth, rate-limit, scope check, request-id, and a uniform error envelope. The handler gets `(req, { ctx, params })` where **`ctx.tenantId`** is the authenticated owner's hex id. Throw `ApiError` for failures.

## 4. Mongo access + collection naming

```ts
import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
const { db } = await connectToDatabase();           // pooled, cached singleton
const col = db.collection('api_contacts');           // see naming below
```
Naming convention observed: public-API surfaces use `api_*` (e.g. `api_contacts`); always scope every query by tenant — `{ tenantId: ctx.tenantId }`. Serialize `_id` to hex (`doc._id.toHexString()`) and `Date` to ISO before returning JSON.

## 5. Sample GET route (reads Mongo)

`src/app/api/v1/wachat/<feature>/route.ts`
```ts
import { NextResponse } from 'next/server';
import { withApiV1, ApiError } from '@/lib/api-platform';
import { connectToDatabase } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiV1(async (req, { ctx }) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 25));
  const { db } = await connectToDatabase();
  const rows = await db.collection('api_contacts')
    .find({ tenantId: ctx.tenantId }).sort({ _id: -1 }).limit(limit).toArray();
  return NextResponse.json({ items: rows.map(r => ({ id: r._id.toHexString(), name: r.name })) });
}, { scope: 'wachat:read' });
```

## 6. Sample POST route (delegates to Rust as the user)

`rustFetchAsUser(userId, path, init)` (`@/lib/api-platform/rust-as-user`) mints a short-lived JWT and forwards to the Rust BFF. This is how nearly all `api/v1/wachat/*` routes work (e.g. `analytics/summary`, `messages/send`).
```ts
import { NextResponse } from 'next/server';
import { withApiV1 } from '@/lib/api-platform';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';

export const POST = withApiV1(async (req, { ctx }) => {
  const body = await req.json();
  const data = await rustFetchAsUser(ctx.tenantId, '/v1/wachat/messages/send', {
    method: 'POST', body: JSON.stringify(body),
  });
  return NextResponse.json(data);
}, { scope: 'wachat:write' });
```

## 7. Sample server action (the dominant data path for pages)

Pages mostly call server actions, **not** fetch. Pattern in `src/app/actions/*.actions.ts` or per-page `src/app/wachat/<route>/actions.ts`:
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { rustClient, RustApiError } from '@/lib/rust-client';

export async function getContactsPageData(projectId: string, phoneNumberId: string | undefined,
  page: number, query: string, tagIds: string[]) {
  const session = await getSession();
  if (!session?.user) throw new Error('Authentication required.');
  return rustClient.wachatContacts.list({ projectId, phoneNumberId, page, query, tagIds });
}

export async function deleteContact(id: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Auth required' };
  try { await rustClient.wachatContacts.remove(id); revalidatePath('/wachat/contacts');
        return { success: true }; }
  catch (e) { return { success: false, error: e instanceof RustApiError ? e.message : 'Failed' }; }
}
```
For NEW persistence with no Rust handler, swap the body for `connectToDatabase()` + a Mongo write, then `revalidatePath(...)`.

## 8. Sending WhatsApp

- **Business / Cloud API** → `import { whatsappSendApi } from '@/lib/rust-client/whatsapp-send'` (methods take `{ phoneNumberId, … }`, all POST), **or** the route `POST /api/v1/wachat/messages/send`.
- **Personal WhatsApp (Baileys)** → `import { engineFetch } from '@/lib/sabwa/engine-client'`; e.g. `engineFetch('/sessions/:id/send', { json: {...}, method: 'POST' })`. Talks to the `sabwa-node` service on :4001 via `X-Sabwa-Service-Token`; throws `SabwaEngineError`; pass `treatNotFoundAsEmpty: true` on maybe-unimplemented endpoints.

## 9. Client page data lifecycle (from contacts/page.tsx)

`useTransition` for `isLoading`; `useCallback` fetcher gated on `activeProjectId`; `useEffect(() => fetchData(), [fetchData])`; filters/pagination stored in URL via `useSearchParams` + `router.replace` (debounced with `use-debounce`); `useToast()` for feedback; after mutations, re-run `fetchData()` (+ optional `router.refresh()`). Three required states: **skeleton** (`isLoading && !data.length`), **empty** (`EmptyState`), **error** (toast).

## 10. 20ui components — import from `@/components/sabcrm/20ui`

Layout/header: `PageHeader, PageHeaderHeading, PageEyebrow, PageTitle, PageDescription, PageActions, Breadcrumb`. Data: `Table, THead, TBody, Tr, Th, Td, Pagination, StatCard, Card, Badge, EmptyState, Skeleton`. Inputs: `Input, Button, SelectField, MultiSelect, Combobox, Command(+Empty/Group/Input/Item/List), TagPicker, Slider, DatePicker, DateRange, ColorPicker, IconPicker`. Overlays: `Modal, Dialog, Drawer, Sheet, Popover(+Content/Trigger), AlertDialog(+Action/Cancel/Content/Description/Footer/Header/Title/Trigger), Tooltip, Menu, Dropdown`. Feedback: `useToast`/`ToastProvider`, `Progress`, loaders. Plus `Avatar, Tabs(TabsBar/TabPanel), Segmented, Chart, Sidebar, Disclosure, ScrollArea`. Token vars: `--st-text`, `--st-text-secondary`, `--st-border`, `--st-bg`, `--st-accent`, `--st-danger`, `--st-space-*` (all scoped under `.ui20`, auto light/dark).

Key files: page `/Users/harshkhandelwal/Downloads/sabnode/src/app/wachat/contacts/page.tsx`; shell `/Users/harshkhandelwal/Downloads/sabnode/src/app/wachat/_components/wachat-page.tsx` + `wachat-page.css`; session `/Users/harshkhandelwal/Downloads/sabnode/src/app/actions/user.actions.ts` (`getSession`); project ctx `/Users/harshkhandelwal/Downloads/sabnode/src/context/project-context.tsx`; mongo `/Users/harshkhandelwal/Downloads/sabnode/src/lib/mongodb.ts`; api wrapper `/Users/harshkhandelwal/Downloads/sabnode/src/lib/api-platform/handler.ts` + `rust-as-user.ts`; Mongo-direct route example `/Users/harshkhandelwal/Downloads/sabnode/src/app/api/v1/contacts/_handlers.ts`; Rust route example `/Users/harshkhandelwal/Downloads/sabnode/src/app/api/v1/wachat/analytics/summary/route.ts`; send `/Users/harshkhandelwal/Downloads/sabnode/src/lib/rust-client/whatsapp-send.ts` + `/Users/harshkhandelwal/Downloads/sabnode/src/lib/sabwa/engine-client.ts`; 20ui barrel `/Users/harshkhandelwal/Downloads/sabnode/src/components/sabcrm/20ui/index.ts`.

========================================

I have everything needed. Here is the data + gating map.

# WaChat Data + Gating Map

## 1. Mongo collections

**Important architecture note:** Almost all WaChat feature data lives in **Rust+Mongo behind the BFF** (`/v1/wachat/*` crates: `wachat-features`, `wachat-config`, etc.), reached via `rustClient.*` / `rustFetchAsUser` — those collections are owned by Rust and are NOT directly named in Next.js code. Only a handful of WaChat collections are touched **directly from Next.js** (`db.collection(...)` via `clientPromise`):

| Collection | Where used (Next.js) | Best-guess shape |
|---|---|---|
| `broadcasts` | `src/lib/broadcast-worker.js`, broadcast actions | `{ _id, projectId, name, status('pending'|'sending'|'completed'|'failed'), template, messages[], phone, projectMessagesPerSecond, sentAt, createdAt }` — one campaign run |
| `broadcast_contacts` | `broadcast-worker.js` | `{ _id, broadcastId, projectId, contactId, phone, status, sentAt }` — per-recipient row of a broadcast |
| `broadcast_logs` | `broadcast-worker.js` | `{ _id, broadcastId, contactId, status('sent'|'failed'), error?, eachMessage, sentAt }` — per-send audit log |
| `whatsapp_bots` | `src/app/actions/marketing/whatsapp-chatbots.actions.ts` | `{ _id, userId/projectId, name, trigger, flow/response, isActive, createdAt }` — chatbot definitions |
| `whatsapp_configs` | whatsapp actions / lib | `{ _id, projectId, wabaId, phoneNumberId, accessToken?, settings }` — per-project WA config |
| `projects` | `src/app/api/webhooks/meta/*` | shared SabNode project doc; webhook handler matches inbound events to a project (mirrors `PublicProject` below) |
| `webhook_logs` | `api/webhooks/meta`, replay action | `{ _id, projectId, payload, signature, receivedAt, status }` — raw Meta webhook payloads (used by Webhook Logs page + `replayWebhookLog`) |
| `meta_flows` | flows action/lib | `{ _id, projectId, flowId, name, status, json }` — Meta Flows |
| `incoming_messages` / `outgoing_messages` / `inbox_messages` | engine/inbox lib | per-message rows `{ _id, projectId, contactId/phone, direction, body, type, status, timestamp }` |
| `sabwa_statuses` | sabwa engine area | personal-WA (Baileys) session/status docs |

The **canonical project doc** (`PublicProject`, from `wachat-config.ts`, lives in Rust/Mongo): `{ _id, userId, name, wabaId, businessId, appId, phoneNumbers[{id, display_phone_number, verified_name, quality_rating, ...}], messagesPerSecond, credits, planId, reviewStatus, banState, createdAt }`. The `planId` + `credits` fields on this doc are the per-project plan/credit anchor.

Everything the `wachat-features` server actions touch (chat-labels, scheduled-messages, notes, auto-reply-rules, broadcast-segments, contact-groups, opt-out, blocked/blacklist, saved-replies, chatbot-responses, business-hours, ratings, media, api-keys, conversation-filters, transfer-history, etc.) is persisted **inside the Rust `wachat-features` crate's Mongo collections**, keyed by `projectId` — not named in TS.

## 2. Feature flags / plan-gating mechanism

Two distinct layers, neither is a classic per-feature flag table in Next.js:

**A. Public REST API (`/api/v1/wachat/*`) — scope + tier gating via `withApiV1`.**
- `src/app/api/v1/wachat/features/route.ts` is **codegen'd** (do not hand-edit; edit the manifest + `pnpm api:gen`). It is `GET = withApiV1(handler, { scope: 'wachat:read' })`, documented as **tier: FREE**.
- `withApiV1` (`src/lib/api-platform/handler.ts`) runs the pipeline: verify bearer API key (401) → per-tier token-bucket rate-limit `consumeToken(keyId, ctx.tier)` (429) → `requireScope(scope, ctx)` (403).
- `requireScope` (`auth.ts`): passes if the key's `scopes` includes `'*'` or the exact scope. **Tier** (`'FREE' | 'PRO' | 'ENTERPRISE'`, `RateLimitTier`) only drives **rate-limit buckets**, not access — the route's "tier: FREE" comment is informational.
- The route then calls `rustFetchAsUser(ctx.tenantId, '/v1/wachat/features', …)`. So **the actual list of "enabled features" is computed by the Rust BFF**, scoped to `tenantId`. Next.js does not compute the flag set.

**B. In-app (server actions / pages).** The `wachat-features.actions.ts` actions are thin `'use server'` shims over `rustClient.wachatFeatures.*` (all keyed by `projectId`). There is **no `hasFeature()`/`planFeatures`/feature-flag check in this layer** — gating that exists is enforced **Rust-side** (per-project `planId`/`credits` on the `PublicProject` doc, and credit metering via `getCreditUsage`). The Next.js side only does field validation + `revalidatePath`.

**Net:** "feature gating" for WaChat = (1) OAuth-scope + rate-tier on the public API surface, and (2) Rust-owned plan/credit checks against the project's `planId`/`credits`. The "features" endpoint returns the tenant's enabled-feature list from Rust; the app trusts it.

## 3. Sidebar group → pages map (`wachat-sidebar-config.ts`)

All hrefs under `/wachat/*`; group `defaultOpen=true` only for Overview & Inbox.

- **Overview**: `/wachat` (All Projects), `/wachat/overview`, `/wachat/analytics`, `/wachat/health`
- **Inbox**: `/wachat/chat`, `/wachat/conversation-kanban`, `/wachat/conversation-search`, `/wachat/conversation-filters`, `/wachat/assignments`, `/wachat/agent-availability`
- **Contacts**: `/wachat/contacts`, `/wachat/contact-groups`, `/wachat/contact-blacklist`, `/wachat/blocked-contacts`, `/wachat/contact-import-history`, `/wachat/contact-merge`, `/wachat/contact-notes`, `/wachat/contact-timeline`
- **Broadcasts**: `/wachat/broadcasts`, `/wachat/broadcast-history`, `/wachat/broadcast-scheduler`, `/wachat/broadcast-cron`, `/wachat/broadcast-segments`, `/wachat/campaign-ab-test`, `/wachat/scheduled-messages`, `/wachat/bulk`, `/wachat/bulk-messaging`
- **Templates & Messages**: `/wachat/templates`, `/wachat/message-templates-library`, `/wachat/template-builder`, `/wachat/template-analytics`, `/wachat/saved-replies`, `/wachat/canned-messages`, `/wachat/quick-reply-categories`, `/wachat/templates/interactive-message-builder`, `/wachat/message-tags`
- **Automation**: `/wachat/auto-reply`, `/wachat/auto-reply-rules`, `/wachat/automation` (Conversational AI), `/wachat/chatbot`, `/wachat/greeting-messages`, `/wachat/away-messages`, `/wachat/business-hours`, `/wachat/flow-builder`, `/wachat/flows` (Meta Flows)
- **Reports**: `/wachat/message-analytics`, `/wachat/message-statistics`, `/wachat/delivery-reports`, `/wachat/response-time-tracker`, `/wachat/customer-satisfaction`, `/wachat/team-performance`, `/wachat/link-tracking`
- **Growth Tools**: `/wachat/catalog`, `/wachat/whatsapp-pay`, `/wachat/qr-codes`, `/wachat/whatsapp-link-generator`, `/wachat/whatsapp-ads`, `/wachat/post-generator`
- **Calling & Numbers**: `/wachat/numbers`, `/wachat/phone-number-settings`, `/wachat/two-line`, `/wachat/calls`, `/wachat/media-library`
- **Engagement**: `/wachat/chat-export`, `/wachat/chat-labels`, `/wachat/chat-ratings`, `/wachat/chat-transfer`, `/wachat/conversation-summary`, `/wachat/opt-out`
- **Settings**: `/wachat/settings/general`, `/wachat/settings/agents`, `/wachat/settings/attributes`, `/wachat/settings/canned`, `/wachat/webhooks`, `/wachat/webhook-logs`, `/wachat/integrations`

**Key files:** `/Users/harshkhandelwal/Downloads/sabnode/src/app/wachat/_components/wachat-sidebar-config.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/app/actions/wachat-features.actions.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/lib/rust-client/wachat-features.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/lib/rust-client/wachat-config.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/app/api/v1/wachat/features/route.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/lib/api-platform/handler.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/lib/api-platform/auth.ts` · `/Users/harshkhandelwal/Downloads/sabnode/src/lib/broadcast-worker.js`