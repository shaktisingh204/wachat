/**
 * Shared constants for the Meta-style Ad Manager UI.
 * Mirrors the taxonomy Meta exposes in their Ads Manager.
 */

export type ObjectiveDef = {
    id: string;            // Meta Marketing API enum
    label: string;         // Human label
    group: 'Awareness' | 'Traffic' | 'Engagement' | 'Leads' | 'App Promotion' | 'Sales';
    description: string;
    optimization_goals: string[];
    billing_events: string[];
};

export const OBJECTIVES: ObjectiveDef[] = [
    {
        id: 'OUTCOME_AWARENESS',
        label: 'Awareness',
        group: 'Awareness',
        description: 'Show your ads to people most likely to remember them.',
        optimization_goals: ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'THRUPLAY'],
        billing_events: ['IMPRESSIONS'],
    },
    {
        id: 'OUTCOME_TRAFFIC',
        label: 'Traffic',
        group: 'Traffic',
        description: 'Send people to a destination like your website, app, or Messenger.',
        optimization_goals: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS'],
        billing_events: ['IMPRESSIONS', 'LINK_CLICKS'],
    },
    {
        id: 'OUTCOME_ENGAGEMENT',
        label: 'Engagement',
        group: 'Engagement',
        description: 'Get more messages, video views, post engagement, page likes, or event responses.',
        optimization_goals: [
            'POST_ENGAGEMENT', 'PAGE_LIKES', 'EVENT_RESPONSES',
            'THRUPLAY', 'REPLIES', 'CONVERSATIONS',
        ],
        billing_events: ['IMPRESSIONS', 'POST_ENGAGEMENT'],
    },
    {
        id: 'OUTCOME_LEADS',
        label: 'Leads',
        group: 'Leads',
        description: 'Collect leads for your business or brand.',
        optimization_goals: ['LEAD_GENERATION', 'QUALITY_LEAD', 'CONVERSATIONS', 'LINK_CLICKS'],
        billing_events: ['IMPRESSIONS'],
    },
    {
        id: 'OUTCOME_APP_PROMOTION',
        label: 'App promotion',
        group: 'App Promotion',
        description: 'Find new people to install your app and continue using it.',
        optimization_goals: ['APP_INSTALLS', 'LINK_CLICKS', 'VALUE', 'OFFSITE_CONVERSIONS'],
        billing_events: ['IMPRESSIONS', 'APP_INSTALLS'],
    },
    {
        id: 'OUTCOME_SALES',
        label: 'Sales',
        group: 'Sales',
        description: 'Find people likely to purchase your product or service.',
        optimization_goals: ['OFFSITE_CONVERSIONS', 'VALUE', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS'],
        billing_events: ['IMPRESSIONS'],
    },
];

export const BID_STRATEGIES = [
    { id: 'LOWEST_COST_WITHOUT_CAP', label: 'Highest volume', description: 'Get the most results for your budget.' },
    { id: 'LOWEST_COST_WITH_BID_CAP', label: 'Bid cap', description: 'Control your max bid per auction.' },
    { id: 'COST_CAP', label: 'Cost cap', description: 'Control cost per result.' },
    { id: 'LOWEST_COST_WITH_MIN_ROAS', label: 'Minimum ROAS', description: 'Maintain a minimum return on ad spend.' },
];

export const PLACEMENTS = [
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'messenger', label: 'Messenger' },
    { id: 'audience_network', label: 'Audience Network' },
];

export const FACEBOOK_POSITIONS = [
    'feed',
    'right_hand_column',
    'marketplace',
    'video_feeds',
    'story',
    'search',
    'instream_video',
    'facebook_reels',
];

export const INSTAGRAM_POSITIONS = [
    'stream',
    'story',
    'explore',
    'reels',
    'shop',
    'profile_feed',
    'explore_home',
];

export const COUNTRIES = [
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'BR', name: 'Brazil' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'SG', name: 'Singapore' },
    { code: 'SA', name: 'Saudi Arabia' },
];

export const CALL_TO_ACTIONS = [
    'LEARN_MORE', 'SHOP_NOW', 'BUY_NOW', 'SIGN_UP', 'SUBSCRIBE',
    'DOWNLOAD', 'APPLY_NOW', 'BOOK_TRAVEL', 'CONTACT_US',
    'GET_QUOTE', 'GET_OFFER', 'INSTALL_APP', 'PLAY_GAME',
    'LISTEN_MUSIC', 'WATCH_MORE', 'DONATE_NOW',
    'WHATSAPP_MESSAGE', 'MESSAGE_PAGE', 'SEND_EMAIL', 'CALL_NOW',
];

export const SPECIAL_AD_CATEGORIES = [
    { id: 'NONE', label: 'None' },
    { id: 'CREDIT', label: 'Credit' },
    { id: 'EMPLOYMENT', label: 'Employment' },
    { id: 'HOUSING', label: 'Housing' },
    { id: 'ISSUES_ELECTIONS_POLITICS', label: 'Social issues, elections, politics' },
    { id: 'ONLINE_GAMBLING_AND_GAMING', label: 'Online gambling and gaming' },
    { id: 'FINANCIAL_PRODUCTS_SERVICES', label: 'Financial products and services' },
];

export const DATE_PRESETS = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week_mon_today', label: 'This week' },
    { id: 'last_7d', label: 'Last 7 days' },
    { id: 'last_14d', label: 'Last 14 days' },
    { id: 'this_month', label: 'This month' },
    { id: 'last_30d', label: 'Last 30 days' },
    { id: 'last_90d', label: 'Last 90 days' },
    { id: 'maximum', label: 'Lifetime' },
];

export const EFFECTIVE_STATUSES = [
    'ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED',
    'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO',
    'CAMPAIGN_PAUSED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES',
];

export const INSIGHT_COLUMNS: Record<string, { id: string; label: string; formatter?: (v: any) => string }[]> = {
    Performance: [
        { id: 'results', label: 'Results' },
        { id: 'reach', label: 'Reach' },
        { id: 'impressions', label: 'Impressions' },
        { id: 'cost_per_result', label: 'Cost per result' },
        { id: 'amount_spent', label: 'Amount spent' },
        { id: 'ends', label: 'Ends' },
    ],
    Delivery: [
        { id: 'quality_ranking', label: 'Quality ranking' },
        { id: 'engagement_rate_ranking', label: 'Engagement rate ranking' },
        { id: 'conversion_rate_ranking', label: 'Conversion rate ranking' },
    ],
    Engagement: [
        { id: 'post_engagement', label: 'Post engagement' },
        { id: 'post_reactions', label: 'Post reactions' },
        { id: 'post_comments', label: 'Post comments' },
        { id: 'post_shares', label: 'Post shares' },
        { id: 'page_likes', label: 'Page likes' },
    ],
    Video: [
        { id: 'video_plays', label: '3-second video plays' },
        { id: 'video_p25_watched', label: 'Video plays at 25%' },
        { id: 'video_p50_watched', label: 'Video plays at 50%' },
        { id: 'video_p75_watched', label: 'Video plays at 75%' },
        { id: 'video_p100_watched', label: 'Video plays at 100%' },
    ],
    Clicks: [
        { id: 'clicks', label: 'Clicks (all)' },
        { id: 'link_clicks', label: 'Link clicks' },
        { id: 'ctr', label: 'CTR (all)' },
        { id: 'cpc', label: 'CPC (all)' },
    ],
    Conversions: [
        { id: 'website_purchases', label: 'Purchases' },
        { id: 'cost_per_purchase', label: 'Cost per purchase' },
        { id: 'purchase_value', label: 'Purchase value' },
        { id: 'purchase_roas', label: 'Purchase ROAS' },
    ],
};

export function formatMoney(value: unknown, currency = 'USD'): string {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

export function formatNumber(value: unknown): string {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(value: unknown): string {
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return `${n.toFixed(2)}%`;
}

/**
 * Every Meta ad preview format (ad_format enum). Used by the
 * getAllAdPreviews server action and by the client preview switcher.
 */
export const AD_PREVIEW_FORMATS = [
    'DESKTOP_FEED_STANDARD',
    'FACEBOOK_STORY_MOBILE',
    'FACEBOOK_REELS_MOBILE',
    'INSTAGRAM_STANDARD',
    'INSTAGRAM_STORY',
    'INSTAGRAM_REELS',
    'INSTAGRAM_EXPLORE_CONTEXTUAL',
    'INSTAGRAM_FEED_WEB_MEDIUM',
    'INSTAGRAM_SHOP',
    'MARKETPLACE_MOBILE',
    'MESSENGER_MOBILE_INBOX_MEDIA',
    'MESSENGER_MOBILE_STORY_MEDIA',
    'MOBILE_BANNER',
    'MOBILE_FEED_BASIC',
    'MOBILE_FEED_STANDARD',
    'MOBILE_FULLWIDTH',
    'MOBILE_INTERSTITIAL',
    'MOBILE_MEDIUM_RECTANGLE',
    'MOBILE_NATIVE',
    'RIGHT_COLUMN_STANDARD',
    'SUGGESTED_VIDEO_MOBILE',
    'AUDIENCE_NETWORK_OUTSTREAM_VIDEO',
] as const;

export type AdPreviewFormat = typeof AD_PREVIEW_FORMATS[number];

/**
 * Friendly labels + channel icon + aspect hint for each preview
 * format, used by the client-side mock preview carousel in the
 * create flow.
 */
export const PREVIEW_VARIANTS: Array<{
    id: AdPreviewFormat;
    label: string;
    platform: 'facebook' | 'instagram' | 'messenger' | 'audience_network';
    channel: string; // short label shown under tab
    aspect: 'feed' | 'story' | 'square' | 'banner';
}> = [
    { id: 'DESKTOP_FEED_STANDARD', label: 'Facebook Desktop Feed', platform: 'facebook', channel: 'FB Feed', aspect: 'feed' },
    { id: 'MOBILE_FEED_STANDARD', label: 'Facebook Mobile Feed', platform: 'facebook', channel: 'FB Mobile', aspect: 'feed' },
    { id: 'FACEBOOK_STORY_MOBILE', label: 'Facebook Story', platform: 'facebook', channel: 'FB Story', aspect: 'story' },
    { id: 'FACEBOOK_REELS_MOBILE', label: 'Facebook Reels', platform: 'facebook', channel: 'FB Reels', aspect: 'story' },
    { id: 'MARKETPLACE_MOBILE', label: 'Facebook Marketplace', platform: 'facebook', channel: 'Marketplace', aspect: 'feed' },
    { id: 'RIGHT_COLUMN_STANDARD', label: 'Facebook Right Column', platform: 'facebook', channel: 'Right Col', aspect: 'banner' },
    { id: 'INSTAGRAM_STANDARD', label: 'Instagram Feed', platform: 'instagram', channel: 'IG Feed', aspect: 'square' },
    { id: 'INSTAGRAM_STORY', label: 'Instagram Story', platform: 'instagram', channel: 'IG Story', aspect: 'story' },
    { id: 'INSTAGRAM_REELS', label: 'Instagram Reels', platform: 'instagram', channel: 'IG Reels', aspect: 'story' },
    { id: 'INSTAGRAM_EXPLORE_CONTEXTUAL', label: 'Instagram Explore', platform: 'instagram', channel: 'IG Explore', aspect: 'square' },
    { id: 'INSTAGRAM_SHOP', label: 'Instagram Shop', platform: 'instagram', channel: 'IG Shop', aspect: 'square' },
    { id: 'MESSENGER_MOBILE_INBOX_MEDIA', label: 'Messenger Inbox', platform: 'messenger', channel: 'Msg Inbox', aspect: 'banner' },
    { id: 'MESSENGER_MOBILE_STORY_MEDIA', label: 'Messenger Story', platform: 'messenger', channel: 'Msg Story', aspect: 'story' },
    { id: 'AUDIENCE_NETWORK_OUTSTREAM_VIDEO', label: 'Audience Network', platform: 'audience_network', channel: 'AN Video', aspect: 'feed' },
];
