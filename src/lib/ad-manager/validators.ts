/**
 * Zod schemas for every input going into the Meta Marketing API via
 * the ad-manager server actions. Centralising here lets us:
 *  - Validate user / client input consistently
 *  - Surface helpful error messages before hitting Graph API
 *  - Keep types, enums and error mapping in one place
 */

import { z } from 'zod';

/**
 * Shared action result envelope returned from every server action.
 * Lives here (not in the actions file) because Next.js 16 forbids
 * type exports from "use server" modules.
 */
export type ActionResult<T = unknown> = { data?: T; error?: string };

/* ── Shared primitives ────────────────────────────────────────────── */

export const IdString = z
    .string()
    .min(1, 'ID is required')
    .regex(/^(act_)?\d+$/, 'ID must be numeric (optionally prefixed with act_)');

export const AdAccountId = z.string().min(1, 'Ad account ID required');
export const GraphNodeId = z.string().min(1, 'Graph node ID required');

export const NonEmptyString = (name: string, max = 512) =>
    z.string().trim().min(1, `${name} is required`).max(max, `${name} must be ≤ ${max} chars`);

export const OptionalString = (max = 512) => z.string().trim().max(max).optional();

export const UrlString = z
    .string()
    .trim()
    .url('Must be a valid URL starting with http:// or https://')
    .max(2048, 'URL too long');

export const PositiveInt = (name: string) =>
    z.number().int(`${name} must be an integer`).positive(`${name} must be > 0`);

export const NonNegativeInt = z.number().int().min(0);

export const CurrencyMinorUnits = z
    .number()
    .int('Budget must be an integer in minor currency units (e.g. cents)')
    .min(100, 'Budget must be at least 1.00 in account currency');

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const IsoDateTime = z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), 'Must be a valid ISO 8601 date-time');

export const CountryCode = z
    .string()
    .length(2, 'Country must be a 2-letter ISO code')
    .regex(/^[A-Z]{2}$/, 'Country code must be uppercase');

export const Currency = z.string().length(3, 'Currency must be a 3-letter ISO code');

export const FbId = z.string().regex(/^\d+$/, 'Facebook ID must be numeric');

export const PixelId = FbId;
export const PageId = FbId;
export const BusinessId = FbId;

/* ── Enums pulled from the Marketing API spec ─────────────────────── */

export const CampaignObjective = z.enum([
    'OUTCOME_AWARENESS',
    'OUTCOME_TRAFFIC',
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_LEADS',
    'OUTCOME_APP_PROMOTION',
    'OUTCOME_SALES',
    // Legacy objectives — still accepted by API but deprecated
    'APP_INSTALLS',
    'BRAND_AWARENESS',
    'CONVERSIONS',
    'EVENT_RESPONSES',
    'LEAD_GENERATION',
    'LINK_CLICKS',
    'LOCAL_AWARENESS',
    'MESSAGES',
    'OFFER_CLAIMS',
    'PAGE_LIKES',
    'POST_ENGAGEMENT',
    'PRODUCT_CATALOG_SALES',
    'REACH',
    'STORE_VISITS',
    'VIDEO_VIEWS',
]);

export const CampaignStatus = z.enum([
    'ACTIVE',
    'PAUSED',
    'DELETED',
    'ARCHIVED',
]);

export const BuyingType = z.enum(['AUCTION', 'RESERVED']);

export const BidStrategy = z.enum([
    'LOWEST_COST_WITHOUT_CAP',
    'LOWEST_COST_WITH_BID_CAP',
    'COST_CAP',
    'LOWEST_COST_WITH_MIN_ROAS',
    'TARGET_COST',
]);

export const SpecialAdCategory = z.enum([
    'NONE',
    'EMPLOYMENT',
    'HOUSING',
    'CREDIT',
    'ISSUES_ELECTIONS_POLITICS',
    'ONLINE_GAMBLING_AND_GAMING',
    'FINANCIAL_PRODUCTS_SERVICES',
]);

export const BillingEvent = z.enum([
    'APP_INSTALLS',
    'CLICKS',
    'IMPRESSIONS',
    'LINK_CLICKS',
    'NONE',
    'OFFER_CLAIMS',
    'PAGE_LIKES',
    'POST_ENGAGEMENT',
    'THRUPLAY',
    'PURCHASE',
    'LISTING_INTERACTION',
]);

export const OptimizationGoal = z.enum([
    'AD_RECALL_LIFT',
    'APP_INSTALLS',
    'APP_INSTALLS_AND_OFFSITE_CONVERSIONS',
    'CONVERSATIONS',
    'DERIVED_EVENTS',
    'ENGAGED_USERS',
    'EVENT_RESPONSES',
    'IMPRESSIONS',
    'IN_APP_VALUE',
    'LANDING_PAGE_VIEWS',
    'LEAD_GENERATION',
    'LINK_CLICKS',
    'MEANINGFUL_CALL_ATTEMPT',
    'OFFSITE_CONVERSIONS',
    'PAGE_LIKES',
    'POST_ENGAGEMENT',
    'QUALITY_CALL',
    'QUALITY_LEAD',
    'REACH',
    'REPLIES',
    'SOCIAL_IMPRESSIONS',
    'SUBSCRIBERS',
    'THRUPLAY',
    'VALUE',
    'VISIT_INSTAGRAM_PROFILE',
]);

export const EffectiveStatus = z.enum([
    'ACTIVE',
    'PAUSED',
    'DELETED',
    'PENDING_REVIEW',
    'DISAPPROVED',
    'PREAPPROVED',
    'PENDING_BILLING_INFO',
    'CAMPAIGN_PAUSED',
    'ARCHIVED',
    'ADSET_PAUSED',
    'IN_PROCESS',
    'WITH_ISSUES',
]);

export const CallToActionType = z.enum([
    'LEARN_MORE', 'SHOP_NOW', 'BUY_NOW', 'SIGN_UP', 'SUBSCRIBE',
    'DOWNLOAD', 'APPLY_NOW', 'BOOK_TRAVEL', 'CONTACT_US',
    'GET_QUOTE', 'GET_OFFER', 'INSTALL_APP', 'PLAY_GAME',
    'LISTEN_MUSIC', 'WATCH_MORE', 'DONATE_NOW',
    'WHATSAPP_MESSAGE', 'MESSAGE_PAGE', 'SEND_EMAIL', 'CALL_NOW',
    'LIKE_PAGE', 'SEND_TIP', 'REQUEST_TIME', 'SEE_MENU',
    'ORDER_NOW', 'FOLLOW_PAGE', 'NO_BUTTON',
]);

export const DatePreset = z.enum([
    'today', 'yesterday', 'this_month', 'last_month',
    'this_quarter', 'last_quarter', 'maximum',
    'last_3d', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_90d',
    'last_week_mon_sun', 'last_week_sun_sat',
    'last_year', 'this_week_mon_today', 'this_week_sun_today',
    'this_year',
]);

export const InsightsLevel = z.enum(['account', 'campaign', 'adset', 'ad']);

export const CustomAudienceSubtype = z.enum([
    'CUSTOM',
    'WEBSITE',
    'APP',
    'OFFLINE_CONVERSION',
    'CLAIM',
    'PARTNER',
    'MANAGED',
    'VIDEO',
    'LOOKALIKE',
    'ENGAGEMENT',
    'DATA_SET',
    'BAG_OF_ACCOUNTS',
    'STUDY_RULE_AUDIENCE',
    'FOX',
]);

export const CustomerFileSource = z.enum([
    'USER_PROVIDED_ONLY',
    'PARTNER_PROVIDED_ONLY',
    'BOTH_USER_AND_PARTNER_PROVIDED',
]);

/* ── Composite shapes ─────────────────────────────────────────────── */

export const TargetingSchema = z.object({
    geo_locations: z
        .object({
            countries: z.array(CountryCode).optional(),
            regions: z.array(z.object({ key: z.string() })).optional(),
            cities: z.array(z.object({ key: z.string(), radius: z.number().optional(), distance_unit: z.string().optional() })).optional(),
            zips: z.array(z.object({ key: z.string() })).optional(),
            custom_locations: z
                .array(
                    z.object({
                        latitude: z.number(),
                        longitude: z.number(),
                        radius: z.number(),
                        distance_unit: z.enum(['mile', 'kilometer']).optional(),
                    }),
                )
                .optional(),
            location_types: z.array(z.enum(['home', 'recent', 'travel_in', 'recent_and_home'])).optional(),
        })
        .optional(),
    excluded_geo_locations: z.record(z.string(), z.unknown()).optional(),
    age_min: z.number().int().min(13).max(65).optional(),
    age_max: z.number().int().min(13).max(65).optional(),
    genders: z.array(z.union([z.literal(1), z.literal(2)])).optional(),
    interests: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    behaviors: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    locales: z.array(z.number()).optional(),
    publisher_platforms: z.array(z.enum(['facebook', 'instagram', 'messenger', 'audience_network'])).optional(),
    facebook_positions: z.array(z.string()).optional(),
    instagram_positions: z.array(z.string()).optional(),
    messenger_positions: z.array(z.string()).optional(),
    device_platforms: z.array(z.enum(['mobile', 'desktop'])).optional(),
    user_os: z.array(z.string()).optional(),
    user_device: z.array(z.string()).optional(),
    wireless_carrier: z.array(z.string()).optional(),
    education_statuses: z.array(z.number()).optional(),
    income: z.array(z.number()).optional(),
    relationship_statuses: z.array(z.number()).optional(),
    custom_audiences: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
    excluded_custom_audiences: z.array(z.object({ id: z.string() })).optional(),
    flexible_spec: z.array(z.record(z.string(), z.unknown())).optional(),
    exclusions: z.record(z.string(), z.unknown()).optional(),
    targeting_optimization: z.enum(['expansion_all', 'none']).optional(),
}).refine(
    (t) => !(t.age_min && t.age_max && t.age_min > t.age_max),
    { message: 'age_min cannot be greater than age_max', path: ['age_min'] },
);

export const ObjectStorySpecSchema = z.object({
    page_id: PageId,
    instagram_actor_id: z.string().optional(),
    link_data: z
        .object({
            message: z.string().max(2200).optional(),
            name: z.string().max(400).optional(),
            description: z.string().max(400).optional(),
            link: UrlString,
            image_hash: z.string().optional(),
            image_url: UrlString.optional(),
            call_to_action: z
                .object({
                    type: CallToActionType,
                    value: z.record(z.string(), z.unknown()).optional(),
                })
                .optional(),
            child_attachments: z.array(z.record(z.string(), z.unknown())).optional(),
            multi_share_optimized: z.boolean().optional(),
            multi_share_end_card: z.boolean().optional(),
        })
        .optional(),
    video_data: z
        .object({
            video_id: z.string(),
            title: z.string().optional(),
            message: z.string().optional(),
            image_url: UrlString.optional(),
            call_to_action: z
                .object({
                    type: CallToActionType,
                    value: z.record(z.string(), z.unknown()).optional(),
                })
                .optional(),
        })
        .optional(),
    template_data: z.record(z.string(), z.unknown()).optional(),
    product_set_id: z.string().optional(),
});

export const PromotedObjectSchema = z.object({
    page_id: PageId.optional(),
    application_id: z.string().optional(),
    object_store_url: UrlString.optional(),
    custom_event_type: z.string().optional(),
    pixel_id: PixelId.optional(),
    product_set_id: z.string().optional(),
    product_catalog_id: z.string().optional(),
    offer_id: z.string().optional(),
    place_page_set_id: z.string().optional(),
    offline_conversion_data_set_id: z.string().optional(),
});

/* ── Create payload schemas ───────────────────────────────────────── */

export const CreateCampaignInput = z
    .object({
        name: NonEmptyString('Campaign name', 400),
        objective: CampaignObjective,
        status: CampaignStatus.optional(),
        special_ad_categories: z.array(SpecialAdCategory).optional(),
        buying_type: BuyingType.optional(),
        bid_strategy: BidStrategy.optional(),
        daily_budget: CurrencyMinorUnits.optional(),
        lifetime_budget: CurrencyMinorUnits.optional(),
        spend_cap: CurrencyMinorUnits.optional(),
        start_time: IsoDateTime.optional(),
        stop_time: IsoDateTime.optional(),
    })
    .refine(
        (p) => !(p.daily_budget && p.lifetime_budget),
        { message: 'Use either daily_budget or lifetime_budget, not both', path: ['daily_budget'] },
    );

export const CreateAdSetInput = z
    .object({
        name: NonEmptyString('Ad set name', 400),
        campaign_id: FbId,
        status: CampaignStatus.optional(),
        daily_budget: CurrencyMinorUnits.optional(),
        lifetime_budget: CurrencyMinorUnits.optional(),
        bid_amount: PositiveInt('Bid amount').optional(),
        bid_strategy: BidStrategy.optional(),
        billing_event: BillingEvent,
        optimization_goal: OptimizationGoal,
        targeting: TargetingSchema,
        start_time: IsoDateTime.optional(),
        end_time: IsoDateTime.optional(),
        promoted_object: PromotedObjectSchema.optional(),
        destination_type: z.string().optional(),
        attribution_spec: z.array(z.record(z.string(), z.unknown())).optional(),
        pacing_type: z.array(z.string()).optional(),
    })
    .refine(
        (p) => !(p.start_time && p.end_time && Date.parse(p.start_time) > Date.parse(p.end_time)),
        { message: 'start_time must be before end_time', path: ['start_time'] },
    );

export const CreateAdInput = z.object({
    name: NonEmptyString('Ad name', 400),
    adset_id: FbId,
    creative_id: FbId.optional(),
    creative: z.record(z.string(), z.unknown()).optional(),
    status: CampaignStatus.optional(),
    tracking_specs: z.array(z.record(z.string(), z.unknown())).optional(),
}).refine(
    (p) => p.creative_id || p.creative,
    { message: 'Either creative_id or creative payload is required', path: ['creative_id'] },
);

export const CreateCreativeInput = z.object({
    name: NonEmptyString('Creative name', 400),
    object_story_spec: ObjectStorySpecSchema.optional(),
    asset_feed_spec: z.record(z.string(), z.unknown()).optional(),
    url_tags: OptionalString(2048),
    degrees_of_freedom_spec: z.record(z.string(), z.unknown()).optional(),
});

export const CreateCustomAudienceInput = z.object({
    name: NonEmptyString('Audience name', 256),
    description: OptionalString(2048),
    subtype: CustomAudienceSubtype,
    customer_file_source: CustomerFileSource.optional(),
    retention_days: z.number().int().min(1).max(540).optional(),
    rule: z.record(z.string(), z.unknown()).optional(),
});

export const CreateLookalikeInput = z.object({
    name: NonEmptyString('Audience name', 256),
    origin_audience_id: FbId,
    country: CountryCode,
    ratio: z.number().min(0.01).max(0.20).optional(),
});

export const InsightsQueryInput = z
    .object({
        level: InsightsLevel.optional(),
        time_range: z.object({ since: IsoDate, until: IsoDate }).optional(),
        date_preset: DatePreset.optional(),
        breakdowns: z.array(z.string()).optional(),
        action_breakdowns: z.array(z.string()).optional(),
        fields: z.array(z.string()).optional(),
        time_increment: z.union([z.number().int().positive(), z.literal('all_days'), z.literal('monthly')]).optional(),
        limit: z.number().int().positive().max(5000).optional(),
    })
    .refine(
        (q) => !(q.time_range && q.date_preset),
        { message: 'Use either time_range or date_preset, not both' },
    )
    .refine(
        (q) => !(q.time_range && Date.parse(q.time_range.since) > Date.parse(q.time_range.until)),
        { message: 'time_range.since must be ≤ time_range.until' },
    );

export const ReachEstimateInput = z.object({
    targeting: TargetingSchema,
    optimization_goal: OptimizationGoal.optional(),
    currency: Currency.optional(),
});

export const DeliveryEstimateInput = z.object({
    targeting_spec: TargetingSchema,
    optimization_goal: OptimizationGoal,
    daily_budget: CurrencyMinorUnits.optional(),
});

export const CustomConversionInput = z.object({
    name: NonEmptyString('Name', 400),
    description: OptionalString(1024),
    custom_event_type: z.enum([
        'ADD_PAYMENT_INFO', 'ADD_TO_CART', 'ADD_TO_WISHLIST', 'COMPLETE_REGISTRATION',
        'CONTACT', 'CUSTOMIZE_PRODUCT', 'DONATE', 'FIND_LOCATION', 'INITIATE_CHECKOUT',
        'LEAD', 'OTHER', 'PURCHASE', 'SCHEDULE', 'SEARCH', 'START_TRIAL',
        'SUBMIT_APPLICATION', 'SUBSCRIBE', 'VIEW_CONTENT',
    ]),
    rule: z.record(z.string(), z.unknown()),
    default_conversion_value: z.number().nonnegative().optional(),
});

export const LeadGenFormInput = z.object({
    page_id: PageId,
    name: NonEmptyString('Form name', 200),
    privacy_policy_url: UrlString,
    questions: z.array(
        z.object({
            type: z.string(),
            key: z.string().optional(),
            label: z.string().optional(),
            inline_context: z.string().optional(),
            options: z.array(z.string()).optional(),
        }),
    ),
});

export const ConversionApiEventInput = z.object({
    event_name: NonEmptyString('event_name', 50),
    event_time: z.number().int().positive(),
    user_data: z.record(z.string(), z.unknown()),
    custom_data: z.record(z.string(), z.unknown()).optional(),
    action_source: z.enum([
        'website', 'email', 'app', 'phone_call', 'chat',
        'physical_store', 'system_generated', 'business_messaging', 'other',
    ]).optional(),
    event_source_url: UrlString.optional(),
});

export const AdRuleInput = z.object({
    name: NonEmptyString('Rule name', 256),
    evaluation_spec: z.object({
        evaluation_type: z.enum(['SCHEDULE', 'TRIGGER']),
        filters: z.array(z.record(z.string(), z.unknown())),
    }),
    execution_spec: z.object({
        execution_type: z.enum([
            'PAUSE', 'UNPAUSE', 'CHANGE_BUDGET', 'CHANGE_BID', 'NOTIFICATION',
            'REBALANCE_BUDGET', 'ROTATE',
        ]),
        execution_options: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
    schedule_spec: z.record(z.string(), z.unknown()).optional(),
});

/* ── Generic validation wrapper ───────────────────────────────────── */

export type ValidationError = { error: string; issues?: Array<{ path: string; message: string }> };

export function validate<T>(
    schema: z.ZodType<T>,
    input: unknown,
): { data: T } | ValidationError {
    const parsed = schema.safeParse(input);
    if (parsed.success) return { data: parsed.data };
    const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
    }));
    return {
        error: issues.map((i) => `${i.path}: ${i.message}`).join('; '),
        issues,
    };
}

/* ── Meta Graph API error code → friendly message mapping ────────── */

export function friendlyGraphError(err: any): string {
    const fb = err?.response?.data?.error || err?.error || err;
    const code = fb?.code;
    const sub = fb?.error_subcode;
    const msg = fb?.error_user_msg || fb?.message || (typeof err === 'string' ? err : 'Meta API error');

    if (code === 100) return `Invalid parameter: ${msg}`;
    if (code === 190) return 'Access token expired or invalid. Please reconnect your Meta account.';
    if (code === 200) return 'Permission denied. Your access token is missing the required scope.';
    if (code === 17 || code === 4 || code === 32) return 'Meta rate limit hit. Try again in a minute.';
    if (code === 1487742) return 'Invalid special ad category for this objective.';
    if (code === 1487390) return 'Ad set requires a campaign ID that belongs to the same ad account.';
    if (sub === 1885183) return 'Budget is below the minimum required for the account currency.';
    if (sub === 2069032) return 'Ad creative violates Meta advertising policies.';
    if (code === 2635) return 'A temporary Meta outage is delaying this request. Retry in a few seconds.';
    return msg;
}
