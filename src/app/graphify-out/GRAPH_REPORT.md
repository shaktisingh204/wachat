# Graph Report - app  (2026-05-06)

## Corpus Check
- 1346 files · ~776,026 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4520 nodes · 6129 edges · 55 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 1130 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 89|Community 89]]

## God Nodes (most connected - your core abstractions)
1. `getSession()` - 341 edges
2. `GET()` - 333 edges
3. `handleDelete()` - 133 edges
4. `POST()` - 130 edges
5. `requireToken()` - 90 edges
6. `serialize()` - 52 edges
7. `set()` - 51 edges
8. `requireBot()` - 44 edges
9. `graph()` - 43 edges
10. `withActPrefix()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `toggleCell()` --calls--> `GET()`  [INFERRED]
  dashboard/crm/settings/roles/[id]/page.tsx → api/cron/sync-local-templates/route.ts
- `handleManualFacebookPageSetup()` --calls--> `GET()`  [INFERRED]
  actions/facebook.actions.ts → api/cron/sync-local-templates/route.ts
- `handleUpdatePageDetails()` --calls--> `GET()`  [INFERRED]
  actions/facebook.actions.ts → api/cron/sync-local-templates/route.ts
- `handleCreateFacebookPost()` --calls--> `GET()`  [INFERRED]
  actions/facebook.actions.ts → api/cron/sync-local-templates/route.ts
- `handleUpdatePost()` --calls--> `GET()`  [INFERRED]
  actions/facebook.actions.ts → api/cron/sync-local-templates/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (327): getActivityLogs(), logActivity(), getAdAccounts(), getTransactions(), handleCreatePayuCreditOrder(), handlePlanChange(), fmtDate(), getCommandCenterData() (+319 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (142): getFacebookPagesForAdCreation(), getInstagramAccountsForPage(), getInstagramBusinessAccount(), listApplications(), listBrandedContentHandles(), listInstantExperiences(), listOffers(), listPagePromotablePosts() (+134 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (79): updateContactTags(), toggleWidgetVisibility(), deleteEmergencyContact(), deleteEmployeeDocument(), deleteEmployeeLeaveQuota(), deleteEmployeeSkill(), deleteSkill(), deleteVisaDetail() (+71 more)

### Community 3 - "Community 3"
Cohesion: 0.01
Nodes (38): addRandomizerPost(), createFacebookAgent(), getFacebookKanbanData(), handleAddVideoThumbnail(), handleCreateFacebookPost(), handleCrosspostVideo(), handleManualFacebookPageSetup(), handleScheduleLiveStream() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (86): convertProposalToContract(), convertInvoiceToCreditNote(), unpinItem(), addDiscussionReply(), approveLeave(), computeDaysCount(), daysInclusive(), deleteLeave() (+78 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (83): buildTree(), genericSave(), getCompanyProfile(), getDepartmentsExt(), getDepartmentTree(), getDesignationsExt(), getDesignationTree(), getGlobalSettings() (+75 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (115): addUsersToCustomAudience(), attachAdLabel(), batchUpdateStatus(), browseTargeting(), compareInsights(), createAd(), createAdLabel(), createAdRule() (+107 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (87): getProjectById(), getEcommShops(), deleteEcommFlow(), getEcommFlowById(), getEcommFlows(), saveEcommFlow(), createRazorpayPaymentLink(), handlePaymentRequest() (+79 more)

### Community 8 - "Community 8"
Cohesion: 0.02
Nodes (33): addRow(), buildPayload(), clusterKeywords(), compact(), downloadCsv(), exportCsv(), FilterPill(), generateDataString() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (56): getEcommShopBySlug(), getPublicEcommProducts(), activateWorkflow(), createSabFlow(), createWorkflow(), deactivateWorkflow(), deepSanitize(), deleteSabFlow() (+48 more)

### Community 10 - "Community 10"
Cohesion: 0.03
Nodes (28): moveTask(), genericSave(), saveWsGanttLink(), saveWsIssue(), saveWsPinned(), saveWsProject(), saveWsProjectActivity(), saveWsProjectCategory() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.03
Nodes (15): deleteDiscussionReply(), clearFilters(), DataRow(), fmt(), format(), formatCurrency(), formatDate(), handleAnalyze() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.03
Nodes (29): genericSave(), saveAnnouncement(), saveAsset(), saveAssetAssignment(), saveCandidate(), saveCareersPageConfig(), saveCertification(), saveCompensationBand() (+21 more)

### Community 13 - "Community 13"
Cohesion: 0.02
Nodes (19): searchFacebookConversations(), cycleStatus(), handleCancel(), handleSend(), handleTransfer(), addContactNote(), cancelScheduledBroadcast(), cancelScheduledMessage() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.03
Nodes (8): AddRoleDialog(), fetchProjectData(), formAction(), handleStatusToggle(), InfoRow(), PageSkeleton(), statusVariant(), SubmitButton()

### Community 15 - "Community 15"
Cohesion: 0.03
Nodes (30): deleteAdAccount(), authenticateApiKey(), generateApiKey(), getApiKeysForUser(), revokeApiKey(), handleCreate(), handleRevoke(), loadKeys() (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (41): applyFilters(), emptyAdminStats(), getAdminDashboardStats(), getWebhookProcessingStatus(), handleAdminLogin(), handleDeleteProjectByAdmin(), impersonateUser(), setAppLogo() (+33 more)

### Community 17 - "Community 17"
Cohesion: 0.04
Nodes (42): acceptInvitation(), daysFromNow(), deleteChat(), deleteInvitation(), generateToken(), getChatFiles(), getConversationWith(), getMentionsForMe() (+34 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (17): genericSave(), saveClientCategory(), saveClientContact(), saveClientDetails(), saveClientDocument(), saveClientNote(), saveClientSubCategory(), saveLeadAgent() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.04
Nodes (29): addMember(), avatarColor(), buildTree(), initials(), OrgNode(), removeMember(), resolveManagerId(), toggleCell() (+21 more)

### Community 20 - "Community 20"
Cohesion: 0.05
Nodes (34): applyEcommShopTheme(), applyTheme(), createEcommShop(), deleteEcommPage(), deleteEcommProduct(), deleteEcommShopTheme(), getEcommOrders(), getEcommPages() (+26 more)

### Community 21 - "Community 21"
Cohesion: 0.05
Nodes (30): deleteCrmAutomation(), getCrmAutomationById(), getCrmAutomations(), saveCrmAutomation(), addRow(), handleDelete(), makeEmptyRow(), parseInitial() (+22 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (26): deleteEvent(), deleteKnowledgeBase(), deleteNotice(), deleteStickyNote(), genericSave(), getDiscussionReplies(), getEventAttendees(), getKnowledgeBaseById() (+18 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (10): getPromotions(), async(), checkAll(), checkOne(), copy(), estimateCpc(), groupKeywords(), hash() (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (17): asBool(), deleteCustomField(), genericSave(), getCustomFieldsFor(), getCustomFieldValues(), getIssueById(), saveCustomField(), saveCustomFieldGroup() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (22): addInterval(), computeItemsTotals(), generateOrderNumber(), getCart(), getOrderItems(), parseJsonField(), pauseRecurringExpense(), pauseRecurringInvoice() (+14 more)

### Community 26 - "Community 26"
Cohesion: 0.1
Nodes (24): setValue(), submit(), PublicGdprPage(), PublicLeadFormPage(), PublicTicketFormPage(), acceptEstimatePublic(), clientMeta(), consumeValidToken() (+16 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (27): genericSingletonSave(), getEmailNotificationSetting(), getGoogleCalendarSetting(), getMessageSetting(), getPusherSetting(), getPushNotificationSetting(), getQuickBooksSetting(), getSingleton() (+19 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (11): deleteTicketType(), genericSave(), saveTicketActivity(), saveTicketAgentGroup(), saveTicketChannel(), saveTicketCustomForm(), saveTicketGroup(), saveTicketReply() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.19
Nodes (28): approveShiftChange(), assignShiftToEmployee(), deleteAutomateShift(), deleteEmployeeShift(), deleteRotationSequence(), deleteShiftChangeRequest(), deleteShiftRotation(), deleteShiftSchedule() (+20 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (6): fetchInvoices(), handleAddItem(), handleClientChange(), handleItemChange(), handleRemoveItem(), SaveButton()

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (16): approveRemovalRequest(), completeRemovalRequest(), deleteRemovalRequest(), deleteRemovalRequestLead(), genericSave(), getGdprSettings(), getLeadConsents(), getRequestMeta() (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.1
Nodes (9): saveFacebookFlow(), deleteFlow(), saveFlow(), createMetaFlow(), deleteMetaFlow(), publishMetaFlow(), saveMetaFlow(), saveMetaFlowDraft() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (15): coerceBool(), coerceNumber(), getAttendanceSettings(), getInvoiceSettings(), getProjectSettings(), getSingleton(), getTaskSettings(), parseIpList() (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (10): deleteContract(), deleteTicket(), save(), saveContract(), saveProject(), saveProjectTask(), saveTicket(), signContract() (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (8): deleteContractTemplate(), genericSave(), saveContractDiscussion(), saveContractFile(), saveContractRenewal(), saveContractSign(), saveContractTemplate(), saveContractType()

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (8): handleBulkCreateTemplate(), handleCreateFlowTemplate(), handleCreateTemplate(), handleEditTemplate(), jsonField(), listField(), saveLibraryTemplate(), strField()

### Community 37 - "Community 37"
Cohesion: 0.21
Nodes (10): getAccountPreferences(), getActiveSessions(), getAppearancePrefs(), getNotificationPrefs(), requireUserId(), setAppearancePrefs(), setLoginAlerts(), setNotificationPrefs() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (8): handleBulkBroadcast(), handleRequeueBroadcast(), handleStartApiBroadcast(), handleStartBroadcast(), handleStopBroadcast(), parseContactFile(), toErrorResponse(), uploadMediaToMeta()

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (11): completeOnboarding(), getOnboardingPlans(), getOnboardingState(), requireUserId(), rewindOnboardingTo(), saveOnboardingBusiness(), saveOnboardingProfile(), saveOnboardingRequirements() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.2
Nodes (2): statusColor(), StatusPill()

### Community 41 - "Community 41"
Cohesion: 0.24
Nodes (2): onTest(), v()

### Community 42 - "Community 42"
Cohesion: 0.2
Nodes (1): createInstagramImagePost()

### Community 43 - "Community 43"
Cohesion: 0.44
Nodes (9): clockIn(), clockOut(), deleteAttendanceExt(), getAttendanceExt(), getAttendanceExtById(), requireTenant(), saveAttendanceExt(), toPlain() (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.31
Nodes (7): createLeadForApi(), deleteLeadForApi(), getLeadByIdForApi(), getLeadsForApi(), updateLeadForApi(), handler(), wrapper()

### Community 45 - "Community 45"
Cohesion: 0.44
Nodes (8): deleteLibraryFile(), getLibraryFile(), listLibraryFiles(), renameLibraryFile(), requireUserId(), tagFor(), toLibraryFile(), uploadLibraryFile()

### Community 46 - "Community 46"
Cohesion: 0.32
Nodes (3): extractRequiredVariables(), validateAndExtract(), validateFileContent()

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (2): handleManage(), setActive()

### Community 58 - "Community 58"
Cohesion: 0.4
Nodes (1): Field()

### Community 60 - "Community 60"
Cohesion: 0.6
Nodes (4): difficultyFor(), hashString(), KeywordDifficultyPage(), label()

### Community 64 - "Community 64"
Cohesion: 0.4
Nodes (1): parseBody()

### Community 71 - "Community 71"
Cohesion: 0.5
Nodes (1): value()

### Community 80 - "Community 80"
Cohesion: 0.67
Nodes (2): BuilderPage(), getPageData()

### Community 86 - "Community 86"
Cohesion: 0.67
Nodes (1): getDatesFromFy()

### Community 89 - "Community 89"
Cohesion: 0.67
Nodes (1): getStatusVariant()

## Knowledge Gaps
- **Thin community `Community 40`** (11 nodes): `page.tsx`, `campaignsOnDay()`, `daysInMonth()`, `entityIcon()`, `handleSetPin()`, `nextMonth()`, `prevMonth()`, `startDayOfMonth()`, `statusColor()`, `StatusPill()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (10 nodes): `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `onTest()`, `v()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (10 nodes): `instagram.actions.ts`, `createInstagramImagePost()`, `discoverInstagramAccount()`, `getHashtagRecentMedia()`, `getInstagramAccountForPage()`, `getInstagramComments()`, `getInstagramMedia()`, `getInstagramMediaDetails()`, `getInstagramStories()`, `searchHashtagId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (5 nodes): `page.tsx`, `page.tsx`, `page.tsx`, `handleManage()`, `setActive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (5 nodes): `page.tsx`, `page.tsx`, `Field()`, `SectionHeader()`, `TeamSettingsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (5 nodes): `route.ts`, `route.ts`, `route.ts`, `route.ts`, `parseBody()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (4 nodes): `page.tsx`, `page.tsx`, `boolValue()`, `value()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (4 nodes): `page.tsx`, `page.tsx`, `BuilderPage()`, `getPageData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (3 nodes): `page.tsx`, `page.tsx`, `getDatesFromFy()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (3 nodes): `page.tsx`, `page.tsx`, `getStatusVariant()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 11`, `Community 13`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 22`, `Community 23`, `Community 26`, `Community 31`, `Community 32`, `Community 36`, `Community 38`, `Community 42`, `Community 44`, `Community 45`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `getSession()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 37`, `Community 6`, `Community 39`, `Community 7`, `Community 9`, `Community 8`, `Community 43`, `Community 5`, `Community 45`, `Community 15`, `Community 17`, `Community 20`, `Community 21`, `Community 29`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `handleDelete()` connect `Community 2` to `Community 0`, `Community 1`, `Community 34`, `Community 35`, `Community 4`, `Community 5`, `Community 6`, `Community 9`, `Community 11`, `Community 14`, `Community 15`, `Community 19`, `Community 22`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 336 inferred relationships involving `getSession()` (e.g. with `fetchData()` and `ConversationPage()`) actually correct?**
  _`getSession()` has 336 INFERRED edges - model-reasoned connections that need verification._
- **Are the 234 inferred relationships involving `GET()` (e.g. with `set()` and `toggleCell()`) actually correct?**
  _`GET()` has 234 INFERRED edges - model-reasoned connections that need verification._
- **Are the 45 inferred relationships involving `handleDelete()` (e.g. with `deleteSmsCampaign()` and `deleteDashboardWidget()`) actually correct?**
  _`handleDelete()` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `POST()` (e.g. with `syncProductsToMetaCatalog()` and `createAutomatedRule()`) actually correct?**
  _`POST()` has 22 INFERRED edges - model-reasoned connections that need verification._