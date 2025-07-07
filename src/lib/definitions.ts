

import type { ObjectId, WithId } from 'mongodb';

export type BusinessCapabilities = {
    max_daily_conversation_per_phone: number;
    max_phone_numbers_per_business: number;
};

export type PaymentConfiguration = {
    configuration_name: string;
    provider_name: string;
    provider_mid: string;
    status: string;
    created_timestamp: number;
    updated_timestamp: number;
};

export type PhoneNumberProfile = {
    about: string;
    address: string;
    description: string;
    email: string;
    profile_picture_url: string;
    websites: string[];
    vertical: string;
}

export type PhoneNumber = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    code_verification_status: string;
    quality_rating: string;
    platform_type?: string;
    throughput?: {
        level: string;
    };
    profile?: PhoneNumberProfile;
};

export type GeneralReplyRule = {
    id: string;
    keywords: string;
    reply: string;
    matchType: 'contains' | 'exact';
};

export type AutoReplySettings = {
  masterEnabled?: boolean;
  welcomeMessage?: {
    enabled: boolean;
    message: string;
  };
  general?: {
    enabled: boolean;
    replies: GeneralReplyRule[];
  };
  inactiveHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
    days: number[]; // 0 = Sunday, 1 = Monday, etc.
    message: string;
  };
  aiAssistant?: {
    enabled: boolean;
    context: string;
    autoTranslate?: boolean;
  };
};

export type OptInOutSettings = {
  enabled?: boolean;
  optOutKeywords?: string[];
  optOutResponse?: string;
  optInKeywords?: string[];
  optInResponse?: string;
};

export type UserAttribute = {
    id: string;
    name: string;
    action?: string;
    status: 'ACTIVE' | 'INACTIVE';
};

export type Agent = {
    userId: ObjectId;
    email: string;
    name: string;
    role: string;
};

export type Tag = {
    _id: string;
    name: string;
    color: string;
};

export type CustomDomain = {
    _id: ObjectId;
    hostname: string;
    verified: boolean;
    verificationCode: string;
};

export type FacebookCommentAutoReplySettings = {
  enabled: boolean;
  replyMode: 'static' | 'ai';
  staticReplyText?: string;
  aiReplyPrompt?: string;
  moderationEnabled: boolean;
  moderationPrompt?: string;
};

export type FacebookWelcomeMessageSettings = {
    enabled: boolean;
    message: string;
    quickReplies?: { title: string; payload: string; }[];
};

export type PostRandomizerSettings = {
    enabled: boolean;
    frequencyHours: number;
    lastPostedAt?: Date;
};

export type AbandonedCartSettings = {
    enabled: boolean;
    delayMinutes: number;
    flowId: string;
};

export type WebsiteBlock = {
    id: string;
    type: 'hero' | 'featuredProducts' | 'richText' | 'testimonials' | 'faq';
    settings: any;
};

export type EcommShop = {
    _id: ObjectId;
    projectId: ObjectId;
    name: string;
    slug: string;
    currency: string;
    customDomain?: string;
    paymentLinkRazorpay?: string;
    paymentLinkPaytm?: string;
    paymentLinkGPay?: string;
    persistentMenu?: { type: 'postback' | 'web_url'; title: string; payload?: string; url?: string; }[];
    abandonedCart?: AbandonedCartSettings;
    homepageLayout: WebsiteBlock[];
    createdAt: Date;
    updatedAt: Date;
};

export type Project = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    wabaId?: string;
    businessId?: string;
    appId?: string;
    accessToken: string;
    phoneNumbers: PhoneNumber[];
    createdAt: Date;
    messagesPerSecond?: number;
    reviewStatus?: string;
    banState?: string;
    violationType?: string;
    violationTimestamp?: Date;
    paymentConfiguration?: PaymentConfiguration;
    businessCapabilities?: BusinessCapabilities;
    autoReplySettings?: AutoReplySettings;
    optInOutSettings?: OptInOutSettings;
    userAttributes?: UserAttribute[];
    agents?: Agent[];
    adAccountId?: string;
    facebookPageId?: string;
    facebookCommentAutoReply?: FacebookCommentAutoReplySettings;
    facebookWelcomeMessage?: FacebookWelcomeMessageSettings;
    postRandomizer?: PostRandomizerSettings;
    tags?: Tag[];
    planId?: ObjectId;
    credits?: number;
    connectedCatalogId?: string;
    hasCatalogManagement?: boolean;
    kanbanStatuses?: string[];
    facebookKanbanStatuses?: string[];
    plan?: WithId<Plan> | null; // populated by aggregate
};

export type Template = {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | 'INTERACTIVE';
  body: string;
  language: string;
  status: string;
  components: any[];
  metaId: string;
  headerSampleUrl?: string;
  qualityScore?: string;
  type?: 'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL';
};

export type FlowNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
};

export type FlowEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
};

export type Flow = {
    name: string;
    projectId: any;
    nodes: FlowNode[];
    edges: FlowEdge[];
    triggerKeywords: string[];
    createdAt: Date;
    updatedAt: Date;
};

export type FacebookFlowNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number, y: number };
};

export type FacebookFlowEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
};

export type FacebookFlow = {
    name: string;
    projectId: ObjectId;
    nodes: FacebookFlowNode[];
    edges: FacebookFlowEdge[];
    triggerKeywords: string[];
    createdAt: Date;
    updatedAt: Date;
};

export type AdCampaign = {
    projectId: ObjectId;
    name: string;
    status: string;
    dailyBudget: number;
    metaCampaignId: string;
    metaAdSetId: string;
    metaAdCreativeId: string;
    metaAdId: string;
    createdAt: Date;
    insights?: {
        impressions?: string;
        clicks?: string;
        spend?: string;
        ctr?: string;
    };
};

export type FacebookPage = {
    id: string;
    name: string;
    category: string;
    tasks: string[];
};

export type FacebookPageDetails = {
    id: string;
    name: string;
    about?: string;
    category?: string;
    fan_count?: number;
    followers_count?: number;
    link?: string;
    location?: {
        city: string;
        country: string;
        latitude: number;
        longitude: number;
        street: string;
        zip: string;
    };
    phone?: string;
    website?: string;
    picture?: {
        data: {
            height: number;
            is_silhouette: boolean;
            url: string;
            width: number;
        };
    };
};

export type CustomAudience = {
    id: string;
    name: string;
    description: string;
    approximate_count_lower_bound: number;
    delivery_status: {
        code: number;
        description: string;
    };
    operation_status: {
        code: number;
        description: string;
    };
    time_updated: number;
};

export type FacebookComment = {
  id: string;
  message: string;
  from: {
    name: string;
    id: string;
  };
  created_time: string;
  comments?: {
    data: FacebookComment[];
  }
};

export type FacebookPost = {
    id: string;
    message?: string;
    full_picture?: string;
    permalink_url: string;
    created_time: string;
    object_id?: string;
    shares?: { count: number };
    reactions?: { data: any[], summary: { total_count: number } };
    comments?: { data: FacebookComment[], summary: { total_count: number } };
    scheduled_publish_time?: number;
    is_published?: boolean;
};

export type FacebookBroadcast = {
    _id: ObjectId;
    projectId: ObjectId;
    message: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_FAILURE';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    totalRecipients: number;
    successCount: number;
    failedCount: number;
};

export type FacebookConversationParticipant = {
    id: string; // This is the PSID for the user
    name: string;
    email: string;
};

export type FacebookConversation = {
    id: string;
    snippet: string;
    unread_count: number;
    updated_time: string;
    participants: {
        data: FacebookConversationParticipant[];
    };
    can_reply: boolean;
    status?: string;
    assignedAgentId?: string;
};

export type FacebookMessage = {
    id: string;
    created_time: string;
    from: FacebookConversationParticipant;
    to: {
        data: FacebookConversationParticipant[];
    };
    message: string;
};

export type FacebookLiveStream = {
    _id: ObjectId;
    projectId: ObjectId;
    title: string;
    description?: string;
    scheduledTime: Date;
    facebookVideoId: string;
    status: 'SCHEDULED_LIVE' | 'LIVE' | 'VOD';
    streamUrl?: string;
    createdAt: Date;
};

export type FacebookSubscriber = {
  _id: ObjectId;
  projectId: ObjectId;
  psid: string; // Page-Scoped ID
  name: string;
  createdAt: Date;
  status?: string;
  assignedAgentId?: string;
  snippet?: string;
  updated_time?: Date;
  unread_count?: number;
  activeEcommFlow?: {
    flowId: string;
    currentNodeId: string;
    variables: Record<string, any>;
    waitingSince?: Date;
    cartLastUpdatedAt?: Date;
  };
};


export type MetaFlow = {
    name: string;
    projectId: ObjectId;
    metaId: string; 
    status: string;
    json_version?: string;
    categories: string[];
    flow_data: any; 
    createdAt: Date;
    updatedAt: Date;
};

export type PlanFeaturePermissions = {
    overview: boolean;
    campaigns: boolean;
    liveChat: boolean;
    contacts: boolean;
    templates: boolean;
    catalog: boolean;
    ecommerce: boolean;
    flowBuilder: boolean;
    metaFlows: boolean;
    whatsappAds: boolean;
    webhooks: boolean;
    settingsBroadcast: boolean;
    settingsAutoReply: boolean;
    settingsMarketing: boolean;
    settingsTemplateLibrary: boolean;
    settingsCannedMessages: boolean;
    settingsAgentsRoles: boolean;
    settingsCompliance: boolean;
    settingsUserAttributes: boolean;
    apiAccess: boolean;
    urlShortener: boolean;
    qrCodeMaker: boolean;
    numbers: boolean;
    billing: boolean;
    notifications: boolean;
    instagramFeed: boolean;
    instagramStories: boolean;
    instagramReels: boolean;
    instagramMessages: boolean;
    chatbot: boolean;
};

export type PlanMessageCosts = {
    marketing: number;
    utility: number;
    authentication: number;
    service?: number;
};

export type Plan = {
    _id: ObjectId;
    name: string;
    price: number;
    currency: string;
    isPublic: boolean;
    isDefault: boolean;
    projectLimit: number;
    agentLimit: number;
    attributeLimit: number;
    templateLimit: number;
    flowLimit: number;
    metaFlowLimit: number;
    cannedMessageLimit: number;
    signupCredits?: number;
    messageCosts: PlanMessageCosts;
    features: PlanFeaturePermissions;
    createdAt: Date;
};

export type User = {
    _id: ObjectId;
    name: string;
    email: string;
    password?: string;
    createdAt: Date;
    tags?: Tag[];
    customDomains?: CustomDomain[];
};

export type Invitation = {
    _id: ObjectId;
    projectId: ObjectId;
    projectName: string;
    inviterId: ObjectId;
    inviteeEmail: string;
    role: string;
    status: 'pending';
    createdAt: Date;
};

export type Transaction = {
    _id: ObjectId;
    userId: ObjectId;
    projectId?: ObjectId;
    type: 'PLAN' | 'CREDITS';
    description: string;
    planId?: ObjectId;
    credits?: number;
    amount: number; 
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    provider: 'phonepe';
    providerTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type BroadcastAttempt = {
    _id: string;
    phone: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';
    sentAt?: Date;
    messageId?: string; 
    error?: string; 
};

export type Notification = {
    _id: ObjectId;
    projectId: ObjectId;
    wabaId: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: Date;
    eventType: string;
};

export type NotificationWithProject = Notification & { projectName?: string };

export type Contact = {
    projectId: ObjectId;
    waId: string; 
    phoneNumberId: string; 
    name: string;
    lastMessage?: string;
    lastMessageTimestamp?: Date;
    unreadCount?: number;
    createdAt: Date;
    variables?: Record<string, string>;
    activeFlow?: {
        flowId: string;
        currentNodeId: string;
        variables: Record<string, any>;
        waitingSince?: Date;
    };
    isOptedOut?: boolean;
    hasReceivedWelcome?: boolean;
    status?: string;
    assignedAgentId?: string;
    tagIds?: string[];
}

export type IncomingMessage = {
    _id: ObjectId;
    direction: 'in';
    contactId: ObjectId;
    projectId: ObjectId;
    wamid: string;
    messageTimestamp: Date;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'unknown' | 'interactive';
    content: any;
    isRead: boolean;
    createdAt: Date;
}

export type OutgoingMessage = {
    _id: ObjectId;
    direction: 'out';
    contactId: ObjectId;
    projectId: ObjectId;
    wamid: string;
    messageTimestamp: Date;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive' | 'template';
    content: any;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    statusTimestamps: {
        sent?: Date;
        delivered?: Date;
        read?: Date;
    };
    error?: string;
    createdAt: Date;
}

export type AnyMessage = (WithId<IncomingMessage> | WithId<OutgoingMessage>);

export type LibraryTemplate = Omit<Template, 'metaId' | 'status' | 'qualityScore'> & {
    _id?: ObjectId;
    isCustom?: boolean;
    createdAt?: Date;
}

export type TemplateCategory = {
    _id: ObjectId;
    name: string;
    description?: string;
};

export type CannedMessage = {
    _id: ObjectId;
    projectId: ObjectId;
    name: string;
    type: 'text' | 'image' | 'audio' | 'video' | 'document';
    content: {
        text?: string;
        mediaUrl?: string;
        caption?: string;
        fileName?: string;
    };
    isFavourite: boolean;
    createdBy: string;
    createdAt: Date;
};

export type FlowLog = {
    _id: ObjectId;
    projectId: ObjectId;
    contactId: ObjectId;
    flowId: ObjectId;
    flowName: string;
    createdAt: Date;
    entries: FlowLogEntry[];
};

export type FlowLogEntry = {
    timestamp: Date;
    message: string;
    data?: any;
};

export type PaymentGatewaySettings = {
    _id: 'phonepe';
    merchantId: string;
    saltKey: string;
    saltIndex: string;
    environment: 'staging' | 'production';
};

export type WebhookLogListItem = {
    _id: string;
    createdAt: string;
    eventField: string;
    eventSummary: string;
};

export type WebhookLog = {
    _id: ObjectId;
    payload: any;
    searchableText: string;
    processed?: boolean;
    createdAt: Date;
    projectId?: ObjectId;
    error?: string;
};


export type MetaPhoneNumber = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    code_verification_status: string;
    quality_rating: string;
    platform_type?: string;
    throughput?: {
        level: string;
    };
    whatsapp_business_profile?: PhoneNumberProfile;
};

export type MetaPhoneNumbersResponse = {
    data: MetaPhoneNumber[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

export type MetaTemplateComponent = {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CAROUSEL';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: any[];
    cards?: any[];
    example?: {
        header_handle?: string[];
        header_text?: string[];
        body_text?: string[][];
        carousel_card_components?: any[];
    }
};

export type MetaTemplate = {
    id:string;
    name: string;
    language: string;
    status: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
    quality_score?: { score: string };
};

export type MetaTemplatesResponse = {
    data: MetaTemplate[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

export type MetaWaba = {
    id: string;
    name: string;
};

export type MetaWabasResponse = {
    data: MetaWaba[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

export type VariableMapping = {
    var: string; // e.g., '1', '2'
    mode: 'file' | 'manual';
    value: string; // column name or static value
};

export type BroadcastJob = {
    _id: ObjectId;
    projectId: ObjectId;
    broadcastType: 'template';
    templateId?: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed' | 'Cancelled';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    contactCount: number;
    fileName: string;
    components: any[];
    language: string;
    headerImageUrl?: string;
    headerMediaId?: string;
    category?: Template['category'];
    successCount?: number;
    errorCount?: number;
    messagesPerSecond?: number;
    projectMessagesPerSecond?: number;
    variableMappings?: VariableMapping[];
};

export type AdminUserView = Omit<User, 'password'>;


export type CreateTemplateState = {
    message?: string | null;
    error?: string | null;
};

export type BroadcastState = {
  message?: string | null;
  error?: string | null;
};

export type UpdateProjectSettingsState = {
  message?: string | null;
  error?: string | null;
};

export type InitiatePaymentResult = {
  redirectUrl?: string;
  error?: string;
}

export type KanbanColumnData = {
    name: string;
    contacts: WithId<Contact>[];
};

export type CommerceMerchantSettings = {
    id: string;
    commerce_manager_url: string;
    display_name: string;
    shops: {
        data: {
            id: string;
            name: string;
            shop_url: string;
        }[];
    };
};

export type Catalog = {
    _id: ObjectId;
    projectId: ObjectId;
    metaCatalogId: string;
    name: string;
    createdAt: Date;
};

export type Product = {
    _id: ObjectId;
    catalogId: ObjectId;
    projectId: ObjectId;
    metaProductId: string;
    retailerId: string;
    name: string;
    description: string;
    price: string;
    currency: string;
    imageUrl?: string;
    availability: string;
    condition: string;
    createdAt: Date;
};

export type ProductSet = {
    id: string;
    name: string;
    product_count: number;
    filter?: any;
};

export type ShortUrl = {
    _id: ObjectId;
    userId: ObjectId;
    domainId?: string;
    originalUrl: string;
    shortCode: string;
    clickCount: number;
    analytics: {
        timestamp: Date;
        referrer?: string;
        userAgent?: string;
        ip?: string;
    }[];
    tagIds?: string[];
    createdAt: Date;
    expiresAt?: Date | null;
};

export type QrCode = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    dataType: 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';
    data: any;
    config: {
        color: string;
        bgColor: string;
        eccLevel: string;
        size: number;
    };
    logoDataUri?: string;
    shortUrlId?: ObjectId;
    tagIds?: string[];
    createdAt: Date;
};

export type QrCodeWithShortUrl = WithId<QrCode> & {
    shortUrl?: WithId<ShortUrl> | null;
};

export type PageInsights = {
    pageReach: number;
    postEngagement: number;
};

export type RandomizerPost = {
    _id: ObjectId;
    projectId: ObjectId;
    message: string;
    imageUrl?: string;
    createdAt: Date;
};

export type FacebookOrder = {
    id: string;
    buyer_details: {
        name: string;
        email: string;
    };
    order_status: {
        state: string;
    };
    estimated_payment_details: {
        total_amount: {
            amount: string;
            currency: string;
            formatted_amount: string;
        }
    };
    created: string;
    updated: string;
};

// --- Custom Ecommerce ---

export type EcommProductVariant = {
  id: string; // e.g., color, size
  name: string; // e.g., Color, Size
  options: string; // Comma-separated, e.g., "Red, Blue, Green"
};

export type EcommProduct = {
  _id: ObjectId;
  projectId: ObjectId;
  shopId: ObjectId;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stock?: number;
  variants?: EcommProductVariant[];
  createdAt: Date;
  updatedAt: Date;
};

export type EcommOrderItem = {
    productId: ObjectId;
    productName: string;
    variantInfo?: string; // e.g., "Color: Red, Size: L"
    quantity: number;
    price: number; // Price at time of order
};

export type EcommOrder = {
    _id: ObjectId;
    projectId: ObjectId;
    shopId: ObjectId;
    contactId: ObjectId; // The customer from the main contacts collection
    items: EcommOrderItem[];
    subtotal: number;
    shipping: number;
    total: number;
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
    customerInfo?: {
        name: string;
        waId: string;
    };
    shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    };
    trackingNumber?: string;
    paymentStatus: 'pending' | 'successful' | 'failed';
    createdAt: Date;
    updatedAt: Date;
};

export type EcommSettings = {
    shopName: string;
    currency: string;
    customDomain?: string;
    paymentLinkRazorpay?: string;
    paymentLinkPaytm?: string;
    paymentLinkGPay?: string;
    persistentMenu?: MenuItem[];
    abandonedCart?: AbandonedCartSettings;
};

export type MenuItem = { 
    type: 'postback' | 'web_url';
    title: string; 
    payload?: string;
    url?: string;
};

export type EcommFlowNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
};

export type EcommFlowEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
};

export type EcommFlow = {
    name: string;
    projectId: ObjectId;
    nodes: EcommFlowNode[];
    edges: EcommFlowEdge[];
    triggerKeywords: string[];
    isWelcomeFlow?: boolean;
    createdAt: Date;
    updatedAt: Date;
};

// --- SEO Suite Types ---

export type BrandMention = {
    source: 'Reddit' | 'Twitter' | 'TechCrunch' | 'Google Alerts';
    author: string;
    content: string;
    url: string;
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    date: Date;
};

export type KeywordData = {
    keyword: string;
    position: number;
    volume: number;
};

export type TrafficData = {
    date: string;
    organic: number;
    social: number;
    direct: number;
};

export type SiteMetrics = {
    domainAuthority: number;
    linkingDomains: number;
    totalBacklinks: number;
    toxicityScore: number;
    trafficData: TrafficData[];
    keywords: KeywordData[];
};

export type Backlink = {
    sourceUrl: string;
    anchorText: string;
    domainAuthority: number;
    linkType: 'News' | 'Forum' | 'Blog' | 'Review';
};
