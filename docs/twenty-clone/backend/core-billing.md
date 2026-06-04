# Billing and Usage Core Modules

Core billing system and usage analytics for Twenty CRM. Manages Stripe subscriptions, resource credits, entitlements, and metered billing with ClickHouse integration for usage analytics.

## Billing Resolver

### billingPortalSession
`engine/core-modules/billing/billing.resolver.ts:72`
`Query() → BillingSessionDTO`
Computes and returns the Stripe customer portal URL for workspace billing management. Allows users to manage payment methods and view invoices.

### checkoutSession
`engine/core-modules/billing/billing.resolver.ts:86`
`Mutation(workspace, user, input) → BillingSessionDTO`
Creates checkout session or direct subscription for trial periods. Routes to checkout flow for paid trials (requirePaymentMethod=true) or direct subscription for free trials (requirePaymentMethod=false).

### switchSubscriptionInterval
`engine/core-modules/billing/billing.resolver.ts:150`
`Mutation(workspace) → BillingUpdateDTO`
Switches subscription interval between monthly and yearly billing. Triggers async update via BillingSubscriptionUpdateService and returns updated subscription state.

### switchBillingPlan
`engine/core-modules/billing/billing.resolver.ts:172`
`Mutation(workspace) → BillingUpdateDTO`
Upgrades/downgrades between PRO and ENTERPRISE plans. Manages plan switching logic with prorations handled by Stripe subscription schedule.

### cancelSwitchBillingPlan
`engine/core-modules/billing/billing.resolver.ts:192`
`Mutation(workspace) → BillingUpdateDTO`
Cancels pending plan change and reverts to current plan. Resets subscription schedule phase changes.

### cancelSwitchBillingInterval
`engine/core-modules/billing/billing.resolver.ts:212`
`Mutation(workspace) → BillingUpdateDTO`
Cancels pending interval change and keeps current billing frequency. Reverts subscription schedule update.

### setResourceCreditSubscriptionPrice
`engine/core-modules/billing/billing.resolver.ts:236`
`Mutation(workspace, priceId) → BillingUpdateDTO`
Updates resource credit tier for the subscription. Initiates async subscription item price change with prorations.

### listPlans
`engine/core-modules/billing/billing.resolver.ts:259`
`Query() → [BillingPlanDTO]`
Returns all available billing plans (PRO, ENTERPRISE) with pricing details and entitlements. Formatted for GraphQL consumption.

### endSubscriptionTrialPeriod
`engine/core-modules/billing/billing.resolver.ts:270`
`Mutation(workspace) → BillingEndTrialPeriodDTO`
Ends trial period immediately. Checks for payment method; if missing, returns billing portal URL to add one before subscription becomes active.

### getResourceCreditUsage
`engine/core-modules/billing/billing.resolver.ts:302`
`Query(workspace) → [BillingResourceCreditUsageDTO]`
Returns resource credit usage for current billing period. Includes used credits, granted credits, rollover balance, and unit pricing in display format.

### cancelSwitchResourceCreditPrice
`engine/core-modules/billing/billing.resolver.ts:323`
`Mutation(workspace) → BillingUpdateDTO`
Cancels pending resource credit price change and reverts to current price. Resets subscription schedule phase.

### validateCanCheckoutSessionPermissionOrThrow
`engine/core-modules/billing/billing.resolver.ts:342` (private)
Validates user has BILLING permission for checkout unless workspace is in onboarding. Throws PermissionsException if unauthorized.

## Billing Service

### isBillingEnabled
`engine/core-modules/billing/services/billing.service.ts:25`
`() → boolean`
Returns IS_BILLING_ENABLED config value. Used throughout system to conditionally enable/disable billing features.

### hasWorkspaceAnySubscription
`engine/core-modules/billing/services/billing.service.ts:29`
`(workspaceId) → Promise<boolean>`
Checks if workspace has any active subscription. Returns true if billing disabled or subscription exists.

### hasEntitlement
`engine/core-modules/billing/services/billing.service.ts:44`
`(workspaceId, entitlementKey) → Promise<boolean>`
Checks if workspace has specific entitlement (e.g., SSO, custom fields). Returns true if billing disabled, enterprise plan valid, or entitlement enabled.

### isSubscriptionIncompleteOnboardingStatus
`engine/core-modules/billing/services/billing.service.ts:60`
`(workspaceId) → Promise<boolean>`
Returns true if workspace has no subscription (onboarding phase). Used to allow free trial creation.

## Billing Subscription Service

### getBillingSubscriptions
`engine/core-modules/billing/services/billing-subscription.service.ts:67`
`(workspaceId) → Promise<BillingSubscriptionEntity[]>`
Retrieves all subscriptions for workspace. Includes subscription items with product relations.

### getCurrentBillingSubscription
`engine/core-modules/billing/services/billing-subscription.service.ts:71`
`(criteria) → Promise<BillingSubscriptionEntity | undefined>`
Finds the current active (non-canceled) subscription by workspaceId or stripeCustomerId. Returns undefined if none found.

### getCurrentBillingSubscriptionOrThrow
`engine/core-modules/billing/services/billing-subscription.service.ts:102`
`(criteria) → Promise<BillingSubscriptionEntity>`
Like getCurrentBillingSubscription but throws BillingException if not found.

### getBaseProductCurrentBillingSubscriptionItemOrThrow
`engine/core-modules/billing/services/billing-subscription.service.ts:120`
`(workspaceId) → Promise<BillingSubscriptionItemEntity>`
Returns the base plan subscription item (seat-licensed product). Used to extract plan key and seat count.

### cancelSubscription
`engine/core-modules/billing/services/billing-subscription.service.ts:156`
`(workspaceId) → Promise<void>`
Cancels active subscription in Stripe. Allows workspace deletion to proceed.

### assertSubscriptionCanceledOrNone
`engine/core-modules/billing/services/billing-subscription.service.ts:168`
`(workspaceId) → Promise<void>`
Throws if active subscription exists. Prevents workspace deletion without canceling subscription.

### handleUnpaidInvoices
`engine/core-modules/billing/services/billing-subscription.service.ts:181`
`(stripeEventData) → Promise<{ handleUnpaidInvoiceStripeSubscriptionId }>`
Responds to setup_intent.succeeded events to collect unpaid invoices. Updates subscription if status is UNPAID.

### getWorkspaceEntitlements
`engine/core-modules/billing/services/billing-subscription.service.ts:198`
`(workspaceId) → Promise<BillingEntitlementDTO[]>`
Returns all entitlements for workspace with current values. Respects enterprise plan override (enables all if valid).

### getWorkspaceEntitlementByKey
`engine/core-modules/billing/services/billing-subscription.service.ts:225`
`(workspaceId, key) → Promise<boolean>`
Checks single entitlement. Returns true if billing disabled, enterprise valid, or entitlement.value=true.

### endTrialPeriod
`engine/core-modules/billing/services/billing-subscription.service.ts:237`
`(workspace) → Promise<{ hasPaymentMethod, status?, stripeCustomerId? }>`
Ends trial immediately by setting trial_end='now' in Stripe. Returns whether payment method exists; if not, returns customer ID for portal redirect.

### syncSubscriptionToDatabase
`engine/core-modules/billing/services/billing-subscription.service.ts:280`
`(workspaceId, stripeSubscriptionId) → Promise<BillingSubscriptionEntity>`
Syncs Stripe subscription to database. Upserts customer, subscription, and subscription items with conflict resolution. Cleans up stale meter items for V2 subscriptions.

### getTrialPeriodFreeWorkflowCredits
`engine/core-modules/billing/services/billing-subscription.service.ts:375`
`(billingSubscription) → number`
Calculates free workflow credits during trial. Returns 7-day credits if no payment required, 30-day credits otherwise (from config).

## Billing Subscription Update Service

### changeResourceCreditPrice
`engine/core-modules/billing/services/billing-subscription-update.service.ts:68`
`(workspaceId, resourceCreditPriceId) → Promise<void>`
Changes resource credit price tier. Queues async update via updateSubscription.

### cancelSwitchResourceCreditPrice
`engine/core-modules/billing/services/billing-subscription-update.service.ts:88`
`(workspace) → Promise<void>`
Reverts pending resource credit price change to current price.

### cancelSwitchPlan
`engine/core-modules/billing/services/billing-subscription-update.service.ts:110`
`(workspaceId) → Promise<void>`
Reverts pending plan change to current plan.

### cancelSwitchInterval
`engine/core-modules/billing/services/billing-subscription-update.service.ts:126`
`(workspaceId) → Promise<void>`
Reverts pending interval change to current interval.

### changeInterval
`engine/core-modules/billing/services/billing-subscription-update.service.ts:140`
`(workspaceId) → Promise<void>`
Toggles subscription interval between monthly and yearly.

### changePlan
`engine/core-modules/billing/services/billing-subscription-update.service.ts:157`
`(workspaceId) → Promise<void>`
Toggles plan between PRO and ENTERPRISE.

### changeSeats
`engine/core-modules/billing/services/billing-subscription-update.service.ts:176`
`(workspaceId, newSeats) → Promise<void>`
Updates seat count immediately (no proration needed).

### updateSubscription
`engine/core-modules/billing/services/billing-subscription-update.service.ts:188`
`(workspaceId, subscriptionId, update) → Promise<void>`
Core subscription update orchestrator. Determines if update should apply immediately or at period end, manages subscription schedules, creates upgrade invoices, and syncs back to database.

### computeSubscriptionPricesUpdate
`engine/core-modules/billing/services/billing-subscription-update.service.ts:595`
`(update, currentPrices) → Promise<SubscriptionStripePrices>`
Computes new prices for subscription update. Handles plan/interval mapping, resource credit equivalence, and tier selection.

### runSubscriptionUpdate
`engine/core-modules/billing/services/billing-subscription-update.service.ts:426` (private)
`(params) → Promise<Stripe.Subscription>`
Calls Stripe API to update subscription items and metadata. Handles prorations and billing cycle anchoring.

### runSubscriptionScheduleUpdate
`engine/core-modules/billing/services/billing-subscription-update.service.ts:469` (private)
`(params) → Promise<void>`
Updates subscription schedule phases for future billing changes. Releases schedule if phases become identical.

### shouldUpdateAtSubscriptionPeriodEnd
`engine/core-modules/billing/services/billing-subscription-update.service.ts:522` (private)
`(subscription, update) → Promise<boolean>`
Determines if downgrade should happen at period end (true) or immediately (false). Upgrades apply immediately; downgrades apply at period end.

## Billing Plan Service

### getProductsByProductMetadata
`engine/core-modules/billing/services/billing-plan.service.ts:29`
`({ planKey, priceUsageBased, productKey }) → Promise<BillingProductEntity[]>`
Queries products by metadata filters (plan, usage type, product key). Returns active products with pricing.

### getPlanBaseProduct
`engine/core-modules/billing/services/billing-plan.service.ts:51`
`(planKey) → Promise<BillingProductEntity>`
Returns the base/seat-licensed product for a plan. Throws if not found.

### listPlans
`engine/core-modules/billing/services/billing-plan.service.ts:63`
`() → Promise<BillingGetPlanResult[]>`
Returns all plans with their products grouped by type (metered, base, resource credit). Used for billing catalog.

### getPlanByPriceId
`engine/core-modules/billing/services/billing-plan.service.ts:103`
`(stripePriceId) → Promise<BillingGetPlanResult>`
Finds which plan contains a given price ID. Used in webhooks to determine plan from Stripe events.

### getPricesPerPlanByInterval
`engine/core-modules/billing/services/billing-plan.service.ts:127`
`({ planKey, interval }) → Promise<BillingGetPricesPerPlanResult>`
Returns all prices for plan/interval combo. Separates metered, base, and resource credit prices.

## Billing Portal Workspace Service

### computeCheckoutSessionURL
`engine/core-modules/billing/services/billing-portal.workspace-service.ts:50`
`(params) → Promise<string>`
Creates Stripe checkout session URL for subscription signup. Handles trial period config and payment method requirements.

### createDirectSubscription
`engine/core-modules/billing/services/billing-portal.workspace-service.ts:90`
`(params) → Promise<string>`
Creates subscription directly without checkout flow for 7-day trials. Syncs to database and returns success URL.

## Billing Usage Service

### canFeatureBeUsed
`engine/core-modules/billing/services/billing-usage.service.ts:54`
`(workspaceId) → Promise<boolean>`
Checks if workspace can use billable features (not canceled subscription). Returns true if billing disabled.

### getResourceCreditProductUsage
`engine/core-modules/billing/services/billing-usage.service.ts:70`
`(workspace) → Promise<BillingResourceCreditUsageDTO[]>`
Returns resource credit usage for current period. Includes used credits, granted credits, rollover balance, and unit price.

### flushAvailableCreditsFromCache
`engine/core-modules/billing/services/billing-usage.service.ts:166`
`(workspaceId) → Promise<void>`
Clears available credits cache for workspace. Called when subscription changes to force recalculation.

## Billing Usage Cap Service

### isClickHouseEnabled
`engine/core-modules/billing/services/billing-usage-cap.service.ts:48`
`() → boolean`
Returns true if CLICKHOUSE_URL is configured.

### getBatchPeriodCreditsUsed
`engine/core-modules/billing/services/billing-usage-cap.service.ts:52`
`(workspaceIds, periodStart) → Promise<Map<string, number>>`
Queries ClickHouse for credits used by workspace list during period. Returns map of workspaceId→creditsUsedMicro.

### setSubscriptionItemHasReachedCap
`engine/core-modules/billing/services/billing-usage-cap.service.ts:85`
`(workspaceId, hasReachedCap) → Promise<void>`
Updates resource credit subscription item flag. Prevents further usage once cap reached.

## Billing Credit Rollover Service

### processRolloverOnPeriodTransition
`engine/core-modules/billing/services/billing-credit-rollover.service.ts:17`
`({ workspaceId, stripeCustomerId, tierQuantity, previousPeriodStart }) → Promise<void>`
Processes credit carryover at period end. Calculates unused credits and adds to customer balance (capped at tier quantity).

## Billing Price Service

### getBillingThresholdsByMeterPriceId
`engine/core-modules/billing/services/billing-price.service.ts:31`
`(meterPriceId) → Promise<{...}>`
Returns billing thresholds for metered price (usage triggers invoice). Validates metered schema.

### findEquivalentMeteredPrice
`engine/core-modules/billing/services/billing-price.service.ts:46`
`(params) → Promise<BillingMeterPrice>`
Finds metered price in target interval/plan. Scales caps for interval changes and selects best match floor.

### findEquivalentResourceCreditPrice
`engine/core-modules/billing/services/billing-price.service.ts:137` (partial in file)
`(params) → Promise<BillingPriceEntity>`
Finds resource credit price in target interval/plan with largest credit_amount not exceeding reference.

## Billing Product Service

### getProductPrices
`engine/core-modules/billing/services/billing-product.service.ts:20`
`({ interval, planKey }) → Promise<BillingPriceEntity[]>`
Returns all active prices for plan/interval. Flattens products and filters by interval/active status.

### getProductsByPlan
`engine/core-modules/billing/services/billing-product.service.ts:49`
`(planKey) → Promise<BillingProductEntity[]>`
Returns all products (base, resource credit, metered) for plan.

## Billing Subscription Item Service

### getResourceCreditSubscriptionItemDetails
`engine/core-modules/billing/services/billing-subscription-item.service.ts:26`
`(subscription) → Promise<{...} | null>`
Returns resource credit item details: price, credit amount, trial quantity, unit price. Returns null if not found.

## Billing Subscription Phase Service

### getDetailsFromPhase
`engine/core-modules/billing/services/billing-subscription-phase.service.ts:31`
`(phase) → Promise<{...}>`
Extracts plan, metered price, licensed price, quantity from subscription schedule phase.

### toPhaseUpdateParams
`engine/core-modules/billing/services/billing-subscription-phase.service.ts:69`
`(phase) → Stripe.SubscriptionScheduleUpdateParams.Phase`
Converts Stripe phase to update params format. Normalizes price references.

### buildPhaseUpdateParams
`engine/core-modules/billing/services/billing-subscription-phase.service.ts:86`
`({ toUpdatePrices, startDate, endDate }) → Stripe.SubscriptionScheduleUpdateParams.Phase`
Builds phase update params from subscription prices (licensed and resource credit items).

### getLicensedPriceIdAndQuantityFromPhaseUpdateParams
`engine/core-modules/billing/services/billing-subscription-phase.service.ts:109`
`(phase) → { price, quantity }`
Extracts licensed item price ID and quantity from update params.

### isSamePhaseSignature
`engine/core-modules/billing/services/billing-subscription-phase.service.ts:123`
`(a, b) → Promise<boolean>`
Compares two phases for identical pricing and quantity. Used to release schedule if phases match.

## Resource Credit Service

### extractResourceCreditPricingInfo
`engine/core-modules/billing/services/resource-credit.service.ts:25`
`(subscription) → ResourceCreditPricingInfo | null`
Extracts tier cap and unit price from resource credit subscription item. Returns null if not found/invalid.

### getResourceCreditRolloverParameters
`engine/core-modules/billing/services/resource-credit.service.ts:59`
`(workspaceId, subscriptionId) → Promise<{...} | null>`
Gets tier quantity and unit price for rollover calculation. Returns null if subscription/pricing not found.

## Billing Workspace Member Listener

### handleCreateOrDeleteEvent
`engine/core-modules/billing/listeners/billing-workspace-member.listener.ts:31`
Listens for workspaceMember create/delete/destroy events. Queues UpdateSubscriptionQuantityJob to sync seat count with Stripe.

## App Billing Service

### emitChargeEvent
`engine/core-modules/billing/app-billing/app-billing.service.ts:38`
`({ workspaceId, applicationId, charge }) → Promise<void>`
Emits usage event from application. Converts charge to display credits, resolves period start from subscription cache, emits USAGE_RECORDED event.

## Billing Webhook Controller

### handleWebhooks
`engine/core-modules/billing-webhook/billing-webhook.controller.ts:55`
`POST /webhooks/stripe (signature, request) → 200 OK`
Validates Stripe webhook signature, constructs event, routes to appropriate webhook handler. Catches and returns billing exceptions.

## Billing Webhook Subscription Service

### processStripeEvent
`engine/core-modules/billing-webhook/services/billing-webhook-subscription.service.ts:68`
`(workspaceId, event) → Promise<void>`
Handles subscription created/updated/deleted events. Syncs customer, subscription, and items to database. Manages workspace cache and triggers seat count updates.

## Stripe Services

### StripeCustomerService.hasPaymentMethod
`engine/core-modules/billing/stripe/services/stripe-customer.service.ts:40`
`(stripeCustomerId) → Promise<boolean>`
Checks if Stripe customer has any payment methods on file.

### StripeCustomerService.createStripeCustomer
`engine/core-modules/billing/stripe/services/stripe-customer.service.ts:47`
`(email, workspaceId, name) → Promise<Stripe.Customer>`
Creates Stripe customer and saves to database. Sets workspaceId in metadata.

### StripeSubscriptionService.cancelSubscription
`engine/core-modules/billing/stripe/services/stripe-subscription.service.ts:27`
`(stripeSubscriptionId) → Promise<void>`
Cancels subscription in Stripe.

### StripeSubscriptionService.collectLastInvoice
`engine/core-modules/billing/stripe/services/stripe-subscription.service.ts:42`
`(stripeSubscriptionId) → Promise<void>`
Collects draft invoice for unpaid subscriptions. Called during payment recovery.

### StripeSubscriptionService.updateSubscription
`engine/core-modules/billing/stripe/services/stripe-subscription.service.ts:61`
`(stripeSubscriptionId, updateData) → Promise<Stripe.Subscription>`
Updates subscription items and metadata in Stripe. Returns updated subscription.

### StripeCheckoutService.createCheckoutSession
`engine/core-modules/billing/stripe/services/stripe-checkout.service.ts:34`
`(params) → Promise<Stripe.Checkout.Session>`
Creates checkout session for subscription signup. Handles trial config and payment method requirements.

### StripeCheckoutService.createDirectSubscription
`engine/core-modules/billing/stripe/services/stripe-checkout.service.ts:91`
`(params) → Promise<Stripe.Subscription>`
Creates subscription directly. Converts checkout line items to subscription format.

### StripeWebhookService.constructEventFromPayload
`engine/core-modules/billing/stripe/services/stripe-webhook.service.ts:26`
`(signature, payload) → Stripe.Event`
Validates Stripe webhook signature and constructs event object from raw payload.

### StripeBillingMeterService.getMeter
`engine/core-modules/billing/stripe/services/stripe-billing-meter.service.ts:27`
`(stripeMeterId) → Promise<Stripe.Billing.Meter>`
Retrieves meter definition from Stripe.

### StripeBillingMeterService.getAllMeters
`engine/core-modules/billing/stripe/services/stripe-billing-meter.service.ts:31`
`() → Promise<Stripe.Billing.Meter[]>`
Retrieves all meters configured in Stripe.

## Usage Resolver

### getUsageAnalytics
`engine/core-modules/usage/usage.resolver.ts:42`
`Query(workspace, input?) → UsageAnalyticsDTO`
Returns usage analytics for period (default 30 days). Breaks down by user, operation type, model, and time series. Resolves user names and converts to display credits.

## Usage Analytics Service

### getAdminAiUsageByWorkspace
`engine/core-modules/usage/services/usage-analytics.service.ts:55`
`({ periodStart, periodEnd, useDollarMode? }) → Promise<UsageBreakdownItem[]>`
Queries ClickHouse for AI usage by workspace. Optional dollar conversion. Limited to 50 results.

### getUsageByUser
`engine/core-modules/usage/services/usage-analytics.service.ts:89`
`(params) → Promise<UsageBreakdownItem[]>`
Returns usage breakdown by user ID (userWorkspaceId). Filters out empty values.

### getUsageByModel
`engine/core-modules/usage/services/usage-analytics.service.ts:97`
`(params) → Promise<UsageBreakdownItem[]>`
Returns usage breakdown by AI model (resourceContext). Filters out empty values.

### getUsageByOperationType
`engine/core-modules/usage/services/usage-analytics.service.ts:105`
`(params) → Promise<UsageBreakdownItem[]>`
Returns usage breakdown by operation type (AI_CHAT_TOKEN, etc). Optionally filters by user.

### getUsageByUserTimeSeries
`engine/core-modules/usage/services/usage-analytics.service.ts:118`
`(params) → Promise<UsageTimeSeriesPoint[]>`
Returns daily usage time series for specific user. Fills gaps in data.

### getUsageTimeSeries
`engine/core-modules/usage/services/usage-analytics.service.ts:128`
`(params) → Promise<UsageTimeSeriesPoint[]>`
Returns daily usage time series for workspace. Fills gaps in data.

## Usage Event Writer Service

### writeToClickHouse
`engine/core-modules/usage/services/usage-event-writer.service.ts:19`
`(workspaceId, usageEvents) → void`
Async writes usage events to ClickHouse. Formats dates and fills in metadata. Logs errors but doesn't throw.

## Usage Event Listener

### handleUsageRecordedEvent
`engine/core-modules/usage/listeners/usage-event.listener.ts:20`
`@OnCustomBatchEvent(USAGE_RECORDED) handler`
Listens for USAGE_RECORDED custom events. Writes events to ClickHouse for analytics.

## Billing Gauge Service

### getSubscribedWorkspacesCount
`engine/core-modules/billing/billing-gauge.service.ts:56` (private)
`() → Promise<number>`
Counts non-deleted subscriptions for Prometheus gauge. Returns 0 if billing disabled or error.

### lastWorkspaceHasSubscription
`engine/core-modules/billing/billing-gauge.service.ts:74` (private)
`() → Promise<number>`
Returns 1 if last workspace (older than 1 min) has subscription, 0 otherwise. Used to monitor onboarding completeness.

## Core Billing Commands

### billing:sync-customer-data
`engine/core-modules/billing/commands/billing-sync-customer-data.command.ts`
CLI command to sync customer data from Stripe for all active/suspended workspaces. Finds stripeCustomerId from workspace subscription and saves to database.

## Billing Validate

### assertIsMeteredTiersSchemaOrThrow
`engine/core-modules/billing/billing.validate.ts:22`
Validates metered price has exactly two tiers with one having up_to set.

### isMeteredTiersSchema
`engine/core-modules/billing/billing.validate.ts:37`
`(tiers) → boolean`
Type-safe check for metered tiers schema.

### assertIsLicensedSubscriptionItem
`engine/core-modules/billing/billing.validate.ts:55`
Validates subscription item is licensed (has quantity, priceUsageBased=LICENSED).

### assertIsMeteredSubscriptionItem
`engine/core-modules/billing/billing.validate.ts:71`
Validates subscription item is metered (no quantity, priceUsageBased=METERED).

### assertIsMeteredPrice
`engine/core-modules/billing/billing.validate.ts:87`
Validates price is metered with correct tiers schema.

### isMeteredPrice
`engine/core-modules/billing/billing.validate.ts:109`
`(price) → boolean`
Type-safe check for metered price.

### assertIsSubscription
`engine/core-modules/billing/billing.validate.ts:123`
Validates subscription has exactly two subscription items. Ensures data consistency.

### assertIsLicensedResourceCreditPrice
`engine/core-modules/billing/billing.validate.ts:164`
Validates price is RESOURCE_CREDIT product with credit_amount metadata.

### isLicensedResourceCreditItem
`engine/core-modules/billing/billing.validate.ts:155`
`(item) → boolean`
Checks if subscription item is RESOURCE_CREDIT product.

### getCapFromCreditMetadata
`engine/core-modules/billing/billing.validate.ts:187`
`(price) → number`
Extracts credit_amount from price metadata. Throws if invalid.


## Billing Webhook Product Service

### processStripeEvent
`engine/core-modules/billing-webhook/services/billing-webhook-product.service.ts:21`
`(data) → Promise<{ stripeProductId }>`
Syncs Stripe product create/update events to database. Validates metadata and upserts product with conflict resolution.

## Billing Webhook Entitlement Service

### processStripeEvent
`engine/core-modules/billing-webhook/services/billing-webhook-entitlement.service.ts:33`
`(data) → Promise<{ stripeEntitlementCustomerId }>`
Syncs Stripe entitlements to database. Finds workspace by stripeCustomerId, upserts entitlements, and deletes row-level permission groups if RLS is disabled.

## Stripe Billing Meter Event Service

### sendBillingMeterEvent
`engine/core-modules/billing/stripe/services/stripe-billing-meter-event.service.ts:29`
`({ usageEvent, stripeCustomerId }) → Promise<void>`
Records usage event to Stripe billing meter. Includes credits used, customer ID, operation type, and resource context.

### sumMeterEvents
`engine/core-modules/billing/stripe/services/stripe-billing-meter-event.service.ts:56`
`(meterId, customerId, startTime, endTime) → Promise<number>`
Queries Stripe for meter event summaries within time window. Aggregates cumulative usage.

### getTotalCumulativeUsage
`engine/core-modules/billing/stripe/services/stripe-billing-meter-event.service.ts:76` (partial)
`(meterId, customerId) → Promise<number>`
Returns total cumulative usage for customer across all time. Used for rollover calculations.

## Billing Webhook Invoice Service (Webhook Handler)

Handles invoice.created, invoice.payment_succeeded, invoice.payment_failed, invoice.finalized events to sync invoice data to database.

## Billing Webhook Price Service (Webhook Handler)

Handles price.created, price.updated events to sync pricing data to database. Validates schema and manages conflict resolution.

## Billing Webhook Customer Service (Webhook Handler)

Handles customer events to sync customer data and metadata between Stripe and database.

## Billing Webhook Subscription Schedule Service (Webhook Handler)

Handles subscription_schedule.updated, subscription_schedule.released events to sync scheduled billing phase changes to database.

## App Billing Controller

### emitCharge
`engine/core-modules/billing/app-billing/app-billing.controller.ts`
REST endpoint for applications to report usage. Validates app key, workspace, and charge DTO. Calls AppBillingService to emit event.

## Remaining Utility & Service Coverage

Additional documented utilities and functions from:
- Billing subscription item service methods
- Billing subscription phase service methods
- Resource credit service methods
- Billing price service methods
- Billing plan service methods
- Stripe services (subscription, customer, checkout, portal, invoice, pricing)
- Usage analytics service queries
- Billing validation functions (metered, licensed, subscription schema checks)

