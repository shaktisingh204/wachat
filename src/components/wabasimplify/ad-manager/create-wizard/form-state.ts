/**
 * Complete Meta Ads Manager create-flow form state.
 * Mirrors every field the Meta Marketing API accepts for
 * campaigns, ad sets, creatives and ads.
 */

export type CreateFormState = {
    /* ── Campaign ───────────────────────────────────────── */
    campaignName: string;
    objective: string;
    specialAdCategory: string;
    specialAdCountry: string;
    buyingType: 'AUCTION' | 'RESERVED';
    cbo: boolean; // Advantage+ campaign budget
    campaignBudgetType: 'DAILY' | 'LIFETIME';
    campaignBudget: string; // in major units
    campaignSpendCap: string;
    bidStrategy: string;
    campaignStartDate: string;
    campaignEndDate: string;
    campaignTags: string[];
    adCategoryCountries: string[];

    /* ── Ad set ────────────────────────────────────────── */
    adSetName: string;
    conversionLocation: 'website' | 'app' | 'messenger' | 'whatsapp' | 'calls' | 'facebook_page' | 'instagram_direct';
    performanceGoal: string;
    pixelId: string;
    conversionEvent: string;
    costPerResultGoal: string;
    bidCap: string;
    roasGoal: string;
    attributionClickWindow: '1_day_click' | '7_day_click';
    attributionViewWindow: '1_day_view' | 'none';
    adSetBudgetType: 'DAILY' | 'LIFETIME';
    adSetBudget: string;
    startDate: string;
    endDate: string;
    dayparting: boolean;
    daypartingSchedule: Array<{ days: number[]; start_minute: number; end_minute: number }>;
    pacing: 'standard' | 'accelerated';
    frequencyCapImpressions: string;
    frequencyCapDays: string;

    /* ── Targeting (audience) ──────────────────────────── */
    advantageAudience: boolean;
    locationTypes: string[]; // home / recent / travel_in
    countries: string[];
    regions: string[];
    cities: Array<{ key: string; name: string; radius?: number }>;
    excludedCountries: string[];
    minAge: number;
    maxAge: number;
    gender: 'all' | 'male' | 'female';
    languages: string[];
    detailedTargeting: Array<{ id: string; name: string; type?: string }>;
    detailedExclusions: Array<{ id: string; name: string; type?: string }>;
    detailedNarrow: Array<{ id: string; name: string; type?: string }>;
    customAudiences: Array<{ id: string; name: string }>;
    excludedCustomAudiences: Array<{ id: string; name: string }>;
    connectionTargeting: 'all' | 'connected' | 'friends_of_connected' | 'excluded';
    connectionPageId: string;

    /* ── Placements ────────────────────────────────────── */
    advantagePlacements: boolean;
    devices: string[]; // mobile, desktop
    platforms: string[]; // facebook, instagram, messenger, audience_network
    facebookPositions: string[];
    instagramPositions: string[];
    messengerPositions: string[];
    audienceNetworkPositions: string[];
    specificMobileDevices: string[];
    mobileOS: 'all' | 'ios' | 'android';
    iosVersionMin: string;
    androidVersionMin: string;
    onlyWifi: boolean;
    excludePublisherLists: string[];
    contentExclusions: string[];
    brandSafetyInventoryFilter: 'FULL_INVENTORY' | 'STANDARD_INVENTORY' | 'LIMITED_INVENTORY';

    /* ── Ad ─────────────────────────────────────────────── */
    adName: string;
    useExistingPost: boolean;
    existingPostId: string;
    facebookPageId: string;
    instagramActorId: string;
    adFormat: 'SINGLE_IMAGE' | 'CAROUSEL' | 'VIDEO' | 'COLLECTION' | 'SLIDESHOW';
    primaryTexts: string[];
    headlines: string[];
    descriptions: string[];
    destinationUrl: string;
    displayLink: string;
    callToAction: string;
    urlParameters: string;
    imageHash: string;
    imageUrl: string;
    videoId: string;
    languageOptimization: boolean;
    carouselCards: Array<{
        name: string;
        description?: string;
        link?: string;
        image_hash?: string;
        image_url?: string;
        video_id?: string;
        call_to_action?: string;
    }>;
    brandedContentSponsorId: string;
    pixelEventsTracking: string[];
};

export const initialFormState: CreateFormState = {
    campaignName: 'New campaign',
    objective: 'OUTCOME_TRAFFIC',
    specialAdCategory: 'NONE',
    specialAdCountry: 'IN',
    buyingType: 'AUCTION',
    cbo: false,
    campaignBudgetType: 'DAILY',
    campaignBudget: '500',
    campaignSpendCap: '',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    campaignStartDate: '',
    campaignEndDate: '',
    campaignTags: [],
    adCategoryCountries: [],

    adSetName: 'New ad set',
    conversionLocation: 'website',
    performanceGoal: 'LINK_CLICKS',
    pixelId: '',
    conversionEvent: '',
    costPerResultGoal: '',
    bidCap: '',
    roasGoal: '',
    attributionClickWindow: '7_day_click',
    attributionViewWindow: '1_day_view',
    adSetBudgetType: 'DAILY',
    adSetBudget: '500',
    startDate: '',
    endDate: '',
    dayparting: false,
    daypartingSchedule: [],
    pacing: 'standard',
    frequencyCapImpressions: '',
    frequencyCapDays: '',

    advantageAudience: false,
    locationTypes: ['home', 'recent'],
    countries: ['IN'],
    regions: [],
    cities: [],
    excludedCountries: [],
    minAge: 18,
    maxAge: 65,
    gender: 'all',
    languages: [],
    detailedTargeting: [],
    detailedExclusions: [],
    detailedNarrow: [],
    customAudiences: [],
    excludedCustomAudiences: [],
    connectionTargeting: 'all',
    connectionPageId: '',

    advantagePlacements: true,
    devices: ['mobile', 'desktop'],
    platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
    facebookPositions: [],
    instagramPositions: [],
    messengerPositions: [],
    audienceNetworkPositions: [],
    specificMobileDevices: [],
    mobileOS: 'all',
    iosVersionMin: '',
    androidVersionMin: '',
    onlyWifi: false,
    excludePublisherLists: [],
    contentExclusions: [],
    brandSafetyInventoryFilter: 'FULL_INVENTORY',

    adName: 'New ad',
    useExistingPost: false,
    existingPostId: '',
    facebookPageId: '',
    instagramActorId: '',
    adFormat: 'SINGLE_IMAGE',
    primaryTexts: [''],
    headlines: [''],
    descriptions: [''],
    destinationUrl: '',
    displayLink: '',
    callToAction: 'LEARN_MORE',
    urlParameters: '',
    imageHash: '',
    imageUrl: '',
    videoId: '',
    languageOptimization: false,
    carouselCards: [],
    brandedContentSponsorId: '',
    pixelEventsTracking: [],
};

/* ── Client-side validation rules that mirror Meta's ──────────── */

export type ValidationIssue = { field: keyof CreateFormState | string; message: string };

export function validateStep1(state: CreateFormState): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!state.campaignName.trim()) issues.push({ field: 'campaignName', message: 'Campaign name is required.' });
    if (state.campaignName.length > 400) issues.push({ field: 'campaignName', message: 'Campaign name must be ≤ 400 characters.' });
    if (!state.objective) issues.push({ field: 'objective', message: 'Pick a campaign objective.' });
    if (state.cbo) {
        if (!state.campaignBudget || Number(state.campaignBudget) <= 0)
            issues.push({ field: 'campaignBudget', message: 'Campaign budget must be > 0 when Advantage+ budget is on.' });
    }
    if (state.campaignStartDate && state.campaignEndDate) {
        if (new Date(state.campaignStartDate) > new Date(state.campaignEndDate)) {
            issues.push({ field: 'campaignEndDate', message: 'End date must be after start date.' });
        }
    }
    return issues;
}

export function validateStep2(state: CreateFormState): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!state.adSetName.trim()) issues.push({ field: 'adSetName', message: 'Ad set name is required.' });
    if (!state.cbo && (!state.adSetBudget || Number(state.adSetBudget) <= 0))
        issues.push({ field: 'adSetBudget', message: 'Ad set budget must be > 0.' });
    if (state.countries.length === 0 && state.cities.length === 0 && state.regions.length === 0)
        issues.push({ field: 'countries', message: 'Pick at least one location.' });
    if (state.minAge < 13 || state.minAge > 65)
        issues.push({ field: 'minAge', message: 'Minimum age must be between 13 and 65.' });
    if (state.maxAge < 13 || state.maxAge > 65)
        issues.push({ field: 'maxAge', message: 'Maximum age must be between 13 and 65.' });
    if (state.minAge > state.maxAge)
        issues.push({ field: 'minAge', message: 'Minimum age must be ≤ maximum age.' });
    if (state.startDate && state.endDate && new Date(state.startDate) > new Date(state.endDate))
        issues.push({ field: 'endDate', message: 'End date must be after start date.' });
    if (!state.advantagePlacements && state.platforms.length === 0)
        issues.push({ field: 'platforms', message: 'Pick at least one platform when using manual placements.' });
    if (state.frequencyCapImpressions && Number(state.frequencyCapImpressions) < 1)
        issues.push({ field: 'frequencyCapImpressions', message: 'Frequency cap must be ≥ 1 impression.' });
    return issues;
}

export function validateStep3(state: CreateFormState): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!state.adName.trim()) issues.push({ field: 'adName', message: 'Ad name is required.' });
    if (!state.facebookPageId) issues.push({ field: 'facebookPageId', message: 'Pick a Facebook page.' });
    if (!state.useExistingPost) {
        const text = state.primaryTexts.filter((t) => t.trim());
        if (text.length === 0) issues.push({ field: 'primaryTexts', message: 'Primary text is required.' });
        text.forEach((t, i) => {
            if (t.length > 2200) issues.push({ field: `primaryTexts.${i}`, message: `Primary text #${i + 1} must be ≤ 2200 characters.` });
        });
        state.headlines.forEach((h, i) => {
            if (h && h.length > 40) issues.push({ field: `headlines.${i}`, message: `Headline #${i + 1} must be ≤ 40 characters.` });
        });
        state.descriptions.forEach((d, i) => {
            if (d && d.length > 30) issues.push({ field: `descriptions.${i}`, message: `Description #${i + 1} must be ≤ 30 characters.` });
        });
        if (!state.destinationUrl) issues.push({ field: 'destinationUrl', message: 'Destination URL is required.' });
        if (state.destinationUrl && !/^https?:\/\//.test(state.destinationUrl))
            issues.push({ field: 'destinationUrl', message: 'Destination URL must start with http:// or https://.' });
        if (state.adFormat === 'SINGLE_IMAGE' && !state.imageHash && !state.imageUrl)
            issues.push({ field: 'imageUrl', message: 'Upload an image for a single-image ad.' });
        if (state.adFormat === 'VIDEO' && !state.videoId)
            issues.push({ field: 'videoId', message: 'Upload a video for a video ad.' });
        if (state.adFormat === 'CAROUSEL' && state.carouselCards.length < 2)
            issues.push({ field: 'carouselCards', message: 'Carousel ads need at least 2 cards.' });
    } else if (!state.existingPostId) {
        issues.push({ field: 'existingPostId', message: 'Pick an existing post to promote.' });
    }
    return issues;
}
