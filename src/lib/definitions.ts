

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

export type EcommSettings = {
    shopName: string;
    currency: string;
    customDomain?: string;
    paymentLinkRazorpay?: string;
    paymentLinkPaytm?: string;
    paymentLinkGPay?: string;
    welcomeMessage?: string;
    persistentMenu?: { type: 'postback' | 'web_url'; title: string; payload?: string; url?: string; }[];
}

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
    ecommSettings?: EcommSettings;
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

export type EcommFlowNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number, y: number };
};

export type EcommFlowEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
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

```
  </change>
  <change>
    <file>/src/lib/webhook-processor.ts</file>
    <content><![CDATA[

'use server';

import { revalidatePath } from 'revalidate';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import axios from 'axios';
import { generateAutoReply } from '@/ai/flows/auto-reply-flow';
import { intelligentTranslate, detectLanguageFromWaId } from '@/ai/flows/intelligent-translate-flow';
import type { Project, Contact, OutgoingMessage, AutoReplySettings, Flow, FlowNode, FlowEdge, FlowLog, MetaFlow, Template, EcommFlow, EcommFlowNode, FacebookSubscriber, EcommFlowEdge } from './definitions';
import { getErrorMessage } from './utils';
import { processFacebookComment } from '@/ai/flows/facebook-comment-flow';

const BATCH_SIZE = 1000;

class FlowLogger {
    private entries: { timestamp: Date; message: string; data?: any }[] = [];
    private db: Db;
    private executionData: {
        projectId: ObjectId;
        flowId: ObjectId;
        flowName: string;
        contactId: ObjectId;
    };

    constructor(db: Db, flow: WithId<Flow | EcommFlow>, contact: WithId<Contact | FacebookSubscriber>) {
        this.db = db;
        this.executionData = {
            projectId: flow.projectId,
            flowId: flow._id,
            flowName: flow.name,
            contactId: contact._id,
        };
        this.log("Flow execution started.");
    }

    log(message: string, data?: any) {
        this.entries.push({ timestamp: new Date(), message, data });
    }

    async save() {
        if (this.entries.length > 0) {
            await this.db.collection('flow_logs').insertOne({
                ...this.executionData,
                createdAt: new Date(),
                entries: this.entries,
            });
        }
    }
}

/**
 * Interpolates variables in a string. e.g., "Hello {{name}}" -> "Hello John"
 */
function interpolate(text: string, variables: Record<string, any>): string {
    if (!text) return '';
    return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
        const value = key.split('.').reduce((o: any, i: string) => o?.[i], variables);
        return value !== undefined ? String(value) : match;
    });
}

/**
 * Safely gets a value from a nested object using a dot-notation path.
 */
function getValueFromPath(obj: any, path: string): any {
    if (!path) return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

/**
 * If a target language is set in the flow variables, translates the text.
 */
async function maybeTranslate(text: string, variables: Record<string, any>): Promise<string> {
    const targetLanguage = variables.flowTargetLanguage;
    if (!targetLanguage || targetLanguage.toLowerCase().includes('english') || !text) {
        return text;
    }
    try {
        const result = await intelligentTranslate({ text, targetLanguage });
        return result.translatedText;
    } catch (e: any) {
        console.error(`Flow translation to '${targetLanguage}' failed:`, e.message);
        return text; // Return original text on failure
    }
}


// --- Flow Action Functions ---

async function sendFlowMessage(db: Db, project: WithId<Project>, contact: WithId<Contact | FacebookSubscriber>, phoneNumberId: string, text: string, variables: Record<string, any>) {
    try {
        const translatedText = await maybeTranslate(text, variables);
        const interpolatedText = interpolate(translatedText, variables);

        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: (contact as WithId<Contact>).waId || (contact as WithId<FacebookSubscriber>).psid,
            type: 'text',
            text: { preview_url: false, body: interpolatedText },
        };
        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'text',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send text message to ${(contact as WithId<Contact>).waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowImage(db: Db, project: WithId<Project>, contact: WithId<Contact | FacebookSubscriber>, phoneNumberId: string, node: FlowNode | EcommFlowNode, variables: Record<string, any>) {
    const imageUrl = interpolate(node.data.imageUrl, variables);
    const caption = node.data.caption || '';
    if (!imageUrl) {
        console.error(`Flow: Image URL is missing or invalid after interpolation for node ${node.id}.`);
        return;
    }
    try {
        const translatedCaption = await maybeTranslate(caption, variables);
        const interpolatedCaption = interpolate(translatedCaption, variables);
        const waId = (contact as WithId<Contact>).waId || (contact as WithId<FacebookSubscriber>).psid;

        const messagePayload: any = {
            messaging_product: 'whatsapp', to: waId, type: 'image',
            image: { link: imageUrl },
        };
        if (interpolatedCaption) messagePayload.image.caption = interpolatedCaption;
        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'image',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: interpolatedCaption || '[Flow]: Sent an image', lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send image message to ${(contact as WithId<Contact>).waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowButtons(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const text = node.data.text || '';
    const buttons = (node.data.buttons || []).filter((btn: any) => btn.text && btn.type === 'QUICK_REPLY');
    if (!text || buttons.length === 0) return;

    try {
        const translatedText = await maybeTranslate(text, variables);
        const interpolatedText = interpolate(translatedText, variables);

        const finalButtons = await Promise.all(buttons.map(async (btn: any, index: number) => {
            const translatedBtnText = await maybeTranslate(btn.text, variables);
            return {
                type: 'reply',
                reply: {
                    id: `${node.id}-btn-${index}`, // Unique ID for the button reply
                    title: interpolate(translatedBtnText, variables).substring(0, 20),
                }
            };
        }));
        
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: interpolatedText },
                action: {
                    buttons: finalButtons
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send buttons message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendEcommFlowQuickReplies(db: Db, project: WithId<Project>, contact: WithId<FacebookSubscriber>, node: EcommFlowNode, variables: Record<string, any>) {
    const text = node.data.text || '';
    const buttons = (node.data.buttons || []).filter((btn: any) => btn.text);
    if (!text || buttons.length === 0) return;

    try {
        const interpolatedText = interpolate(text, variables);
        const finalButtons = buttons.map((btn: any, index: number) => ({
            content_type: 'text',
            title: interpolate(btn.text, variables).substring(0, 20),
            payload: `${node.id}-btn-${index}` // Use node and button info as payload
        }));
        
        const messagePayload = {
            recipient: { id: contact.psid },
            messaging_type: "RESPONSE",
            message: {
                text: interpolatedText,
                quick_replies: finalButtons,
            },
        };

        await axios.post(
            `https://graph.facebook.com/v23.0/me/messages`,
            messagePayload,
            { params: { access_token: project.accessToken } }
        );

    } catch (e: any) {
        console.error(`Ecomm Flow: Failed to send quick replies to ${contact.psid} for project ${project._id}:`, e.message);
    }
}


async function sendLanguageSelectionButtons(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const text = interpolate(node.data.promptMessage, variables);
    const languages = (node.data.languages || '').split(',').map((l: string) => l.trim()).filter(Boolean);
    if (!text || languages.length === 0) return;

    try {
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text },
                action: {
                    buttons: languages.map((lang: string) => ({
                        type: 'reply',
                        reply: {
                            id: `${node.id}-lang-${lang}`, // Special ID format for language selection
                            title: lang.substring(0, 20),
                        }
                    }))
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');
        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${text.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send language selection message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowCarousel(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const { headerText, bodyText, footerText, catalogId, sections } = node.data;
    if (!bodyText || !catalogId || !sections || sections.length === 0) {
        console.error(`Flow: Carousel node ${node.id} is missing required data (body, catalogId, or sections).`);
        return;
    }

    try {
        const interpolatedBody = interpolate(await maybeTranslate(bodyText, variables), variables);

        const payload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'catalog_message',
                body: { text: interpolatedBody },
                action: {
                    catalog_id: catalogId,
                    sections: (sections || []).map((section: any) => ({
                        title: interpolate(section.title, variables),
                        product_items: (section.products || []).map((prod: any) => ({
                            product_retailer_id: interpolate(prod.product_retailer_id, variables),
                        })),
                    })),
                },
            },
        };

        if (headerText) {
            payload.interactive.header = {
                type: 'text',
                text: interpolate(await maybeTranslate(headerText, variables), variables),
            };
        }
        if (footerText) {
            payload.interactive.footer = {
                text: interpolate(await maybeTranslate(footerText, variables), variables),
            };
        }
        
        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedBody.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send carousel message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowTemplate(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>, logger: FlowLogger) {
    const templateId = node.data.templateId;
    if (!templateId) {
        logger.log(`Error: Template ID is missing from node ${node.id}.`);
        return;
    }
    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) {
        logger.log(`Error: Template with ID ${templateId} not found in database.`);
        return;
    }
    
    try {
        const getVars = (text: string): number[] => {
            if (!text) return [];
            const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
            return variableMatches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const payloadComponents: any[] = [];
        const headerComponent = template.components.find(c => c.type === 'HEADER');
        if (headerComponent?.format === 'TEXT' && headerComponent.text) {
            const headerVars = getVars(headerComponent.text);
            if (headerVars.length > 0) {
                const parameters = headerVars.sort((a,b) => a-b).map(varNum => ({ type: 'text', text: interpolate(variables[`variable${varNum}`] || '', variables) }));
                payloadComponents.push({ type: 'header', parameters });
            }
        }

        const bodyComponent = template.components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({ type: 'text', text: interpolate(variables[`variable${varNum}`] || '', variables) }));
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.waId, recipient_type: 'individual', type: 'template',
            template: { name: template.name, language: { code: template.language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };

        logger.log(`Sending template "${template.name}".`, { payload: messageData });
        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messageData, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'template',
            content: messageData, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });

    } catch(e: any) {
        logger.log(`Flow: Failed to send template message to ${contact.waId}.`, { error: e.message });
    }
}

async function sendMetaFlowTrigger(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>, logger: FlowLogger) {
    const metaFlowId = node.data.metaFlowId;
    if (!metaFlowId) {
        logger.log(`Error: Meta Flow ID is missing from node ${node.id}.`);
        return;
    }
    const metaFlow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(metaFlowId) });
    if (!metaFlow) {
        logger.log(`Error: Meta Flow with DB ID ${metaFlowId} not found.`);
        return;
    }

    try {
        const payload = {
            messaging_product: "whatsapp",
            to: contact.waId,
            recipient_type: "individual",
            type: "interactive",
            interactive: {
                type: "flow",
                header: { type: "text", text: interpolate(node.data.header, variables) },
                body: { text: interpolate(node.data.body, variables) },
                footer: { text: interpolate(node.data.footer, variables) },
                action: {
                    name: metaFlow.name,
                    parameters: {}
                }
            }
        };

        logger.log(`Triggering Meta Flow "${metaFlow.name}".`, { payload });
        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
    } catch (e: any) {
        logger.log(`Flow: Failed to send Meta Flow trigger to ${contact.waId}.`, { error: e.message });
    }
}


// --- Main Flow Engine ---

async function executeNode(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, flow: WithId<Flow>, nodeId: string, userInput: string | undefined, logger: FlowLogger): Promise<'finished' | 'waiting' | 'error'> {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
        logger.log(`Error: Node with ID ${nodeId} not found in flow ${flow.name}. Terminating flow.`);
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
        return 'finished';
    }
    
    logger.log(`Executing node "${node.data.label}" (ID: ${node.id}, Type: ${node.type}).`);
    
    await db.collection('contacts').updateOne(
        { _id: contact._id },
        { $set: { "activeFlow.currentNodeId": nodeId, "activeFlow.variables": contact.activeFlow.variables } }
    );
    
    let nextNodeId: string | null = null;
    let edge: FlowEdge | undefined;

    switch (node.type) {
        case 'start':
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        case 'text':
            await sendFlowMessage(db, project, contact, contact.phoneNumberId, node.data.text, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
            
        case 'image':
            await sendFlowImage(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        case 'buttons':
            await sendFlowButtons(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            logger.log("Sent buttons and waiting for user reply.");
            return 'waiting';
            
        case 'delay': {
            const showTyping = node.data.showTyping === true;
            const delayMs = (node.data.delaySeconds || 1) * 1000;
            logger.log(`Delaying for ${delayMs}ms.`, { showTyping });
            if (showTyping) {
                try {
                    axios.post(
                        `https://graph.facebook.com/v23.0/${contact.phoneNumberId}/messages`, 
                        { messaging_product: 'whatsapp', to: contact.waId, recipient_type: 'individual', type: 'typing', action: 'start' }, 
                        { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
                    ).catch(e => logger.log("Flow: Failed to send typing indicator", { error: e.message }));
                } catch (e: any) {
                    logger.log("Flow: Error constructing typing indicator request.", { error: e.message });
                }
            }
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }

        case 'input':
            if (userInput !== undefined) {
                if (node.data.variableToSave) {
                    contact.activeFlow.variables[node.data.variableToSave] = userInput;
                    logger.log(`Saved user input to variable "${node.data.variableToSave}".`, { variable: node.data.variableToSave, value: userInput });
                }
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) nextNodeId = edge.target;
            } else {
                await sendFlowMessage(db, project, contact, contact.phoneNumberId, node.data.text, contact.activeFlow.variables);
                logger.log(`Sent prompt for input and waiting for reply.`);
                return 'waiting';
            }
            break;

        case 'condition': {
            let valueToCheck: string = userInput || '';
            if (userInput === undefined) {
                const conditionType = node.data.conditionType || 'variable';
                if (conditionType === 'user_response') {
                    logger.log("Condition node is waiting for user response.");
                    return 'waiting';
                }
                const variableName = node.data.variable?.replace(/{{|}}/g, '').trim();
                if (variableName) {
                    valueToCheck = contact.activeFlow.variables[variableName] || '';
                }
            }
            
            const rawCheckValue = node.data.value || '';
            const interpolatedCheckValue = interpolate(rawCheckValue, contact.activeFlow.variables);
            const operator = node.data.operator || 'equals';
            let conditionMet = false;
            
            try {
                switch(operator) {
                    case 'equals': conditionMet = valueToCheck.toLowerCase() === interpolatedCheckValue.toLowerCase(); break;
                    case 'not_equals': conditionMet = valueToCheck.toLowerCase() !== interpolatedCheckValue.toLowerCase(); break;
                    case 'contains': conditionMet = valueToCheck.toLowerCase().includes(interpolatedCheckValue.toLowerCase()); break;
                    case 'is_one_of':
                        conditionMet = interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase()).includes(valueToCheck.toLowerCase());
                        break;
                    case 'is_not_one_of':
                        conditionMet = !interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase()).includes(valueToCheck.toLowerCase());
                        break;
                    case 'greater_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) > Number(interpolatedCheckValue); break;
                    case 'less_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) < Number(interpolatedCheckValue); break;
                    default: conditionMet = false;
                }
            } catch (e: any) {
                logger.log(`Condition check failed due to an error.`, { error: e.message });
                conditionMet = false;
            }

            logger.log(`Condition check: [${valueToCheck}] ${operator} [${interpolatedCheckValue}] -> ${conditionMet ? 'Yes' : 'No'}`, { valueToCheck, operator, checkValue: interpolatedCheckValue, result: conditionMet });

            const handle = conditionMet ? `${node.id}-output-yes` : `${node.id}-output-no`;
            edge = flow.edges.find(e => e.sourceHandle === handle);
            if (edge) nextNodeId = edge.target;
            break;
        }

        case 'language': {
            const mode = node.data.mode || 'automatic';
            if (mode === 'automatic') {
                const detectedLanguage = await detectLanguageFromWaId(contact.waId);
                contact.activeFlow.variables.flowTargetLanguage = detectedLanguage;
                logger.log(`Automatically set language to ${detectedLanguage}.`);
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) nextNodeId = edge.target;
            } else { // Manual mode
                await sendLanguageSelectionButtons(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
                logger.log(`Sent language selection buttons and waiting for reply.`);
                return 'waiting';
            }
            break;
        }
        
        case 'api':
        case 'webhook': {
            const apiRequest = node.data.apiRequest;
            if (apiRequest?.url) {
                try {
                    const interpolatedUrl = interpolate(apiRequest.url, contact.activeFlow.variables);
                    const rawHeaders = apiRequest.headers ? interpolate(apiRequest.headers, contact.activeFlow.variables) : '';
                    const rawBody = apiRequest.body ? interpolate(apiRequest.body, contact.activeFlow.variables) : '';
                    
                    let headers, body;
                    try { headers = rawHeaders ? JSON.parse(rawHeaders) : undefined; } catch (e) { logger.log(`Failed to parse API headers JSON.`, { rawHeaders, error: (e as Error).message }); }
                    try { body = rawBody ? JSON.parse(rawBody) : undefined; } catch (e) { logger.log(`Failed to parse API body JSON.`, { rawBody, error: (e as Error).message }); }

                    logger.log(`Making API call...`, { method: apiRequest.method, url: interpolatedUrl, headers, body });
                    
                    const response = await axios({
                        method: apiRequest.method || 'GET',
                        url: interpolatedUrl,
                        data: body,
                        headers: headers,
                    });
                    
                    logger.log(`API call successful (Status: ${response.status}).`, { response: response.data });
                    
                    const mappings = apiRequest.responseMappings;
                    if (Array.isArray(mappings)) {
                        for (const mapping of mappings) {
                            if (mapping.variable && mapping.path) {
                                const value = getValueFromPath(response.data, mapping.path);
                                if (value !== undefined) {
                                    contact.activeFlow.variables[mapping.variable] = value;
                                    logger.log(`Mapped API response path "${mapping.path}" to variable "${mapping.variable}".`, { variable: mapping.variable, value: value });
                                } else {
                                     logger.log(`API response path "${mapping.path}" not found or value is undefined.`);
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    logger.log(`API call failed for node ${node.id}.`, { error: e.message, response: e.response?.data });
                }
            }
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }
        case 'carousel':
            await sendFlowCarousel(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        case 'addToCart':
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        case 'sendTemplate':
            await sendFlowTemplate(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables, logger);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        case 'triggerMetaFlow':
            await sendMetaFlowTrigger(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables, logger);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        
        case 'triggerFlow': {
            const flowToTriggerId = node.data.flowId;
            if (flowToTriggerId) {
                const targetFlow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(flowToTriggerId) });
                if (targetFlow) {
                    const startNodeOfTargetFlow = targetFlow.nodes.find(n => n.type === 'start');
                    if (startNodeOfTargetFlow) {
                        logger.log(`Transitioning from flow "${flow.name}" to flow "${targetFlow.name}".`);
                        contact.activeFlow.flowId = targetFlow._id.toString();
                        contact.activeFlow.currentNodeId = startNodeOfTargetFlow.id;
                        // Continue with new flow execution
                        return await executeNode(db, project, contact, targetFlow, startNodeOfTargetFlow.id, undefined, logger);
                    } else {
                        logger.log(`Error: Start node not found in target flow "${targetFlow.name}". Proceeding with normal flow path.`);
                    }
                } else {
                    logger.log(`Error: Flow with ID ${flowToTriggerId} not found. Proceeding with normal flow path.`);
                }
            }
            // Fallback to normal execution if trigger fails or is not set
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }

        default:
            nextNodeId = null;
            break;
    }

    if (nextNodeId) {
        return await executeNode(db, project, contact, flow, nextNodeId, undefined, logger);
    } else {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
        return 'finished';
    }
}

async function handleFlowLogic(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, message: any, phoneNumberId: string): Promise<{ handled: boolean, logger?: FlowLogger, flowStatus?: 'finished' | 'waiting' | 'error' }> {
    let currentContact = contact;

    // 1. Check if there's an active flow and if it has timed out.
    if (currentContact.activeFlow?.flowId && currentContact.activeFlow.waitingSince) {
        const waitingSince = new Date(currentContact.activeFlow.waitingSince).getTime();
        const timeoutDuration = 10 * 60 * 1000; // 10 minutes timeout for user input

        if (Date.now() - waitingSince > timeoutDuration) {
            const flow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(currentContact.activeFlow.flowId) });
            if (flow) {
                const logger = new FlowLogger(db, flow, currentContact);
                logger.log(`Flow timed out after ${timeoutDuration / 60000} minutes of inactivity. Terminating.`);
                await logger.save();
            }
            await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { activeFlow: "" } });
            currentContact = { ...currentContact, activeFlow: undefined };
        }
    }
    
    const messageText = message.text?.body?.trim();
    const buttonReply = message.interactive?.button_reply;
    
    // An active flow is still running for this contact
    if (currentContact.activeFlow?.flowId) {
        const flow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(currentContact.activeFlow.flowId) });
        if (!flow) {
            await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { activeFlow: "" } });
            return { handled: false };
        }
        
        const logger = new FlowLogger(db, flow, currentContact);
        logger.log("Continuing existing flow execution.");

        const currentNode = flow.nodes.find(n => n.id === currentContact.activeFlow.currentNodeId);
        if (!currentNode) {
            logger.log(`Current node ID ${currentContact.activeFlow.currentNodeId} not found. Terminating flow.`);
            await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { activeFlow: "" } });
            await logger.save();
            return { handled: false, logger, flowStatus: 'finished' };
        }
        
        logger.log(`Current waiting node is "${currentNode.data.label}" (${currentNode.id}).`);

        // --- Handle Different User Inputs ---
        if (buttonReply) {
            const replyId = buttonReply.id?.trim();
            logger.log(`Received button reply.`, { replyId: replyId, title: buttonReply.title });
            
            // Handle special language selection buttons
            if (currentNode.type === 'language' && replyId && replyId.startsWith(`${currentNode.id}-lang-`)) {
                const selectedLanguage = buttonReply.title || '';
                if (selectedLanguage) {
                    currentContact.activeFlow.variables.flowTargetLanguage = selectedLanguage;
                    logger.log(`User selected language: ${selectedLanguage}`);
                    await db.collection('contacts').updateOne({ _id: currentContact._id }, { $set: { "activeFlow.variables.flowTargetLanguage": selectedLanguage } });
                }
                
                const langEdge = flow.edges.find(e => e.source === currentNode.id);
                if (langEdge) {
                    await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { "activeFlow.waitingSince": "" } });
                    const flowStatus = await executeNode(db, project, currentContact, flow, langEdge.target, undefined, logger);
                    return { handled: true, logger, flowStatus };
                }
            }

            // Handle regular button presses
            const edge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle?.trim() === replyId);
            if (edge) {
                logger.log(`Found edge from current node ${currentNode.id} via handle ${replyId} to target node ${edge.target}.`);
                await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { "activeFlow.waitingSince": "" } });
                const flowStatus = await executeNode(db, project, currentContact, flow, edge.target, buttonReply.title, logger);
                return { handled: true, logger, flowStatus };
            }
        } 
        else if (messageText && (currentNode.type === 'input' || (currentNode.type === 'condition' && currentNode.data.conditionType === 'user_response'))) {
             logger.log(`Received text reply.`, { text: messageText });
             await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { "activeFlow.waitingSince": "" } });
             const flowStatus = await executeNode(db, project, currentContact, flow, currentNode.id, messageText, logger);
             return { handled: true, logger, flowStatus };
        }

        // The input was not a valid continuation for the waiting flow.
        logger.log("Input did not match any waiting node or path. Terminating flow.");
        await db.collection('contacts').updateOne({ _id: currentContact._id }, { $unset: { activeFlow: "" } });
        await logger.save();
        return { handled: false, logger, flowStatus: 'finished' };
    }

    // No active flow, check if the message should trigger a new one
    const userResponseForTrigger = buttonReply?.title?.trim() || messageText;
    const triggerText = userResponseForTrigger?.toLowerCase();
    if (!triggerText) return { handled: false };
    
    const flows = await db.collection<Flow>('flows').find({
        projectId: project._id,
        triggerKeywords: { $exists: true, $ne: [] }
    }).toArray();

    const triggeredFlow = flows.find(flow =>
        (flow.triggerKeywords || []).some(keyword => triggerText.includes(keyword.toLowerCase().trim()))
    );

    if (triggeredFlow) {
        const startNode = triggeredFlow.nodes.find(n => n.type === 'start');
        if (!startNode) return { handled: false };

        const logger = new FlowLogger(db, triggeredFlow, currentContact);
        logger.log(`Flow triggered by keyword.`, { keyword: triggerText });
        
        currentContact.activeFlow = {
            flowId: triggeredFlow._id.toString(),
            currentNodeId: startNode.id,
            variables: { ...(currentContact.variables || {}), name: currentContact.name, waId: currentContact.waId },
        };
        
        const flowStatus = await executeNode(db, project, currentContact, triggeredFlow, startNode.id, userResponseForTrigger, logger);
        return { handled: true, logger, flowStatus };
    }

    return { handled: false };
}


// --- Auto Reply & Opt-out Logic ---

async function sendAutoReplyMessage(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, messageText: string) {
    try {
        const messagePayload = {
            messaging_product: 'whatsapp', recipient_type: 'individual', to: contact.waId, type: 'text',
            text: { preview_url: false, body: messageText },
        };
        const response = await axios.post( `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'text',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Auto]: ${messageText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Failed to send auto-reply to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function handleOptInOut(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string): Promise<boolean> {
    const settings = project.optInOutSettings;
    if (!settings?.enabled) return false;

    const messageText = message.text?.body?.trim().toLowerCase();
    if (!messageText) return false;

    if (settings.optOutKeywords?.includes(messageText)) {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { isOptedOut: true } });
        if (settings.optOutResponse) await sendAutoReplyMessage(db, project, contact, phoneNumberId, settings.optOutResponse);
        return true;
    }

    if (settings.optInKeywords?.includes(messageText)) {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { isOptedOut: false } });
         if (settings.optInResponse) await sendAutoReplyMessage(db, project, contact, phoneNumberId, settings.optInResponse);
        return true;
    }
    return false;
}

async function triggerAutoReply(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string) {
    const settings = project.autoReplySettings;
    if (!settings || settings.masterEnabled === false) return;

    let replyMessage: string | null = null;
    
    // 1. Welcome Message (highest priority for new contacts)
    if (contact.hasReceivedWelcome === false && settings.welcomeMessage?.enabled && settings.welcomeMessage.message) {
        replyMessage = settings.welcomeMessage.message;
        if (replyMessage) {
            await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
            await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { hasReceivedWelcome: true } });
            return;
        }
    }

    // 2. Inactive Hours Reply
    if (settings.inactiveHours?.enabled && settings.inactiveHours.message) {
        const { startTime, endTime, timezone, days, message: inactiveMessage } = settings.inactiveHours;
        try {
            const nowInTZ = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
            const currentDay = nowInTZ.getDay();
            const currentTime = nowInTZ.getHours() * 60 + nowInTZ.getMinutes();
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;
            const [endHour, endMinute] = endTime.split(':').map(Number);
            const endTimeInMinutes = endHour * 60 + endMinute;

            let isInactive = (startTimeInMinutes > endTimeInMinutes)
                ? (currentTime >= startTimeInMinutes || currentTime < endTimeInMinutes)
                : (currentTime >= endTimeInMinutes || currentTime < startTimeInMinutes);
            
            if (days.includes(currentDay) && isInactive) {
                replyMessage = inactiveMessage;
            }
        } catch (e) { console.error("Error processing inactive hours:", e); }
    }

    // 3. AI Assistant Reply
    if (!replyMessage && settings.aiAssistant?.enabled && settings.aiAssistant.context && message.type === 'text') {
        try {
            const result = await generateAutoReply({
                incomingMessage: message.text.body,
                businessContext: settings.aiAssistant.context,
                userWaId: contact.waId,
                autoTranslate: settings.aiAssistant.autoTranslate,
            });
            replyMessage = result.replyMessage;
        } catch (e: any) { console.error("Error generating AI reply:", e.message); }
    }
    
    // 4. Keyword-based General Reply (only for new contacts)
    if (!replyMessage && contact.hasReceivedWelcome === false && settings.general?.enabled && Array.isArray(settings.general.replies)) {
        const messageText = message.text?.body?.trim().toLowerCase();
        if (messageText) {
            for (const rule of settings.general.replies) {
                const keywords = rule.keywords.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
                let matchFound = false;

                if (rule.matchType === 'exact') {
                    matchFound = keywords.some(kw => messageText === kw);
                } else { // 'contains' is the default
                    matchFound = keywords.some(kw => messageText.includes(kw));
                }

                if (matchFound) {
                    replyMessage = rule.reply;
                    break; // Use the first rule that matches
                }
            }
        }
    }

    // If any reply was determined, send it and update contact status if needed.
    if (replyMessage) {
        await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
        if (contact.hasReceivedWelcome === false) {
            await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { hasReceivedWelcome: true } });
        }
    }
}

export async function handleSingleMessageEvent(db: Db, project: WithId<Project>, message: any, contactProfile: any, phoneNumberId: string) {
    const senderWaId = message.from;
    const senderName = contactProfile.profile?.name || 'Unknown User';
    let lastMessageText = message.type === 'text' ? message.text.body : `[${message.type}]`;
    if (message.type === 'interactive') {
        lastMessageText = message.interactive?.button_reply?.title || '[Interactive Reply]';
    }

    // Fetch media and convert to data URI if present
    if ((message.type === 'image' || message.type === 'video' || message.type === 'audio' || message.type === 'document') && message[message.type]?.id) {
        try {
            const mediaInfoResponse = await axios.get(`https://graph.facebook.com/v23.0/${message[message.type].id}`, {
                headers: { 'Authorization': `Bearer ${project.accessToken}` }
            });

            if (mediaInfoResponse.data.url) {
                const mediaDownloadResponse = await axios.get(mediaInfoResponse.data.url, {
                    headers: { 'Authorization': `Bearer ${project.accessToken}` },
                    responseType: 'arraybuffer'
                });
                const mimeType = mediaInfoResponse.data.mime_type;
                const base64 = Buffer.from(mediaDownloadResponse.data, 'binary').toString('base64');
                message[message.type].url = `data:${mimeType};base64,${base64}`;
            }
        } catch (e: any) {
            console.error(`Failed to fetch and process media for incoming message ${message[message.type].id}:`, e.message);
        }
    }
    
    const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
        { waId: senderWaId, projectId: project._id },
        { 
            $set: { name: senderName, phoneNumberId: phoneNumberId, lastMessage: lastMessageText, lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000) },
            $inc: { unreadCount: 1 },
            $setOnInsert: { waId: senderWaId, projectId: project._id, createdAt: new Date(), hasReceivedWelcome: false }
        },
        { upsert: true, returnDocument: 'after' }
    );
    
    const contact = contactResult;
    if (!contact) throw new Error(`Failed to find or create contact for WA ID ${senderWaId}`);

    await db.collection('incoming_messages').insertOne({
        direction: 'in', projectId: project._id, contactId: contact._id,
        wamid: message.id, messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
        type: message.type, content: message, isRead: false, createdAt: new Date(),
    });

    const wasOptInOut = await handleOptInOut(db, project, contact, message, phoneNumberId);
    if (!wasOptInOut) {
        const { handled, logger, flowStatus } = await handleFlowLogic(db, project, contact, message, phoneNumberId);
        
        if (flowStatus === 'waiting') {
            await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { "activeFlow.waitingSince": new Date() } });
        }

        if (logger && flowStatus === 'finished') {
            logger.log("Flow execution finished.");
            await logger.save();
        } else if (!handled) {
            await triggerAutoReply(db, project, contact, message, phoneNumberId);
        }
    }
    
    // Invalidate cache to trigger UI refresh
    revalidatePath('/dashboard/chat');
    revalidatePath('/dashboard/broadcasts');
}


// --- Main Webhook Processing Logic ---

export async function processSingleWebhook(db: Db, project: WithId<Project>, payload: any, logId?: ObjectId) {
    try {
        if (payload.object !== 'whatsapp_business_account') throw new Error('Not a WhatsApp business account webhook.');
        
        const change = payload.entry?.[0]?.changes?.[0];
        if (!change) return;

        const value = change.value;
        const eventType = change.field;

        if (eventType === 'messages' || !value) return;

        let message = `Received a general update for ${eventType}.`;
        let link = `/dashboard/information`;

        switch (eventType) {
            case 'account_update':
                if (value.event === 'DISABLED_UPDATE' && value.ban_info?.waba_ban_state) {
                    message = `Account status updated: ${value.ban_info.waba_ban_state}. Ban date: ${value.ban_info.waba_ban_date || 'N/A'}`;
                    await db.collection('projects').updateOne({ _id: project._id }, { $set: { banState: value.ban_info.waba_ban_state } });
                } else if (value.event === 'ACCOUNT_VIOLATION' && value.violation_info?.violation_type) {
                    message = `Account violation detected: ${value.violation_info.violation_type}. Please check your account quality.`;
                    link = `https://business.facebook.com/settings/wa/${project.wabaId}`;
                    await db.collection('projects').updateOne({ _id: project._id }, { $set: { violationType: value.violation_info.violation_type, violationTimestamp: new Date() } });
                } else if (value.review_status) {
                    message = `Your business account has been updated. Review status: ${value.review_status?.toUpperCase() || 'N/A'}`;
                    await db.collection('projects').updateOne({ _id: project._id }, { $set: { reviewStatus: value.review_status } });
                }
                break;
            case 'phone_number_quality_update':
                message = `Phone number ${value.display_phone_number} quality is now ${value.event}. Current limit: ${value.current_limit}`;
                link = '/dashboard/numbers';
                break;
            case 'phone_number_name_update':
                message = `Name update for ${value.display_phone_number} was ${value.decision}. Verified name: ${value.verified_name}.`;
                link = '/dashboard/numbers';
                break;
            case 'message_template_status_update':
            case 'template_status_update':
                message = `Template '${value.message_template_name}' was ${value.event === 'approved' ? 'approved' : 'rejected'}. Reason: ${value.reason || 'N/A'}`;
                link = '/dashboard/templates';
                await db.collection('templates').updateOne({ name: value.message_template_name, projectId: project._id }, { $set: { status: value.event.toUpperCase() } });
                break;
            case 'message_template_quality_update':
                message = `Template '${value.message_template_name}' quality updated to ${value.new_quality_score}.`;
                link = '/dashboard/templates';
                await db.collection('templates').updateOne({ name: value.message_template_name, projectId: project._id }, { $set: { qualityScore: value.new_quality_score } });
                break;
        }

        await db.collection('notifications').insertOne({
            projectId: project._id, wabaId: project.wabaId!, message, link,
            isRead: false, createdAt: new Date(), eventType,
        });

        if (logId) await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: null } });
    } catch (e: any) {
        if (logId) await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: e.message } });
        throw e;
    }
}


export async function processStatusUpdateBatch(db: Db, statuses: any[]) {
    if (statuses.length === 0) return { success: 0, failed: 0 };
    
    try {
        const wamids = statuses.map(s => s.id).filter(Boolean);
        if (wamids.length === 0) return { success: 0, failed: 0 };

        const contactsMap = new Map<string, WithId<any>>();
        const contactsCursor = db.collection('broadcast_contacts').find({ messageId: { $in: wamids } });
        for await (const contact of contactsCursor) contactsMap.set(contact.messageId, contact);

        const liveChatOps: any[] = [];
        const broadcastContactOps: any[] = [];
        const broadcastCounterUpdates: Record<string, { delivered: number; read: number; failed: number; success: number }> = {};
        
        for (const status of statuses) {
            if (!status?.id) continue;
            const wamid = status.id;
            const newStatus = (status.status || 'unknown').toUpperCase();
            
            const liveChatUpdatePayload: any = { status: status.status, [`statusTimestamps.${status.status}`]: new Date(parseInt(status.timestamp, 10) * 1000) };
            if (newStatus === 'FAILED' && status.errors?.[0]) liveChatUpdatePayload.error = `${status.errors[0].title} (Code: ${status.errors[0].code})${status.errors[0].details ? `: ${status.errors[0].details}` : ''}`;
            liveChatOps.push({ updateOne: { filter: { wamid }, update: { $set: liveChatUpdatePayload } } });

            const contact = contactsMap.get(wamid);
            if (!contact) continue;

            const broadcastIdStr = contact.broadcastId.toString();
            if (!broadcastCounterUpdates[broadcastIdStr]) broadcastCounterUpdates[broadcastIdStr] = { delivered: 0, read: 0, failed: 0, success: 0 };

            const currentStatus = (contact.status || 'PENDING').toUpperCase();
            const statusHierarchy: Record<string, number> = { PENDING: 0, SENT: 1, FAILED: 1, DELIVERED: 2, READ: 3 };

            if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
                const error = status.errors?.[0] || { title: 'Unknown Failure', code: 'N/A' };
                const errorString = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
                broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: 'FAILED', error: errorString } } } });
                broadcastCounterUpdates[broadcastIdStr].success -= 1;
                broadcastCounterUpdates[broadcastIdStr].failed += 1;
            } else if (statusHierarchy[newStatus] > statusHierarchy[currentStatus]) {
                broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: newStatus } } } });
                if (newStatus === 'DELIVERED') broadcastCounterUpdates[broadcastIdStr].delivered += 1;
                if (newStatus === 'READ') broadcastCounterUpdates[broadcastIdStr].read += 1;
            }
        }

        const promises = [];
        if (liveChatOps.length > 0) promises.push(db.collection('outgoing_messages').bulkWrite(liveChatOps, { ordered: false }));
        if (broadcastContactOps.length > 0) promises.push(db.collection('broadcast_contacts').bulkWrite(broadcastContactOps, { ordered: false }));
        
        const broadcastCounterOps = Object.entries(broadcastCounterUpdates)
            .filter(([_, counts]) => Object.values(counts).some(v => v !== 0))
            .map(([broadcastId, counts]) => ({
                updateOne: { filter: { _id: new ObjectId(broadcastId) }, update: { $inc: { deliveredCount: counts.delivered, readCount: counts.read, errorCount: counts.failed, successCount: counts.success } } }
            }));

        if (broadcastCounterOps.length > 0) promises.push(db.collection('broadcasts').bulkWrite(broadcastCounterOps, { ordered: false }));
        
        if (promises.length > 0) await Promise.all(promises);

        // Invalidate caches to trigger UI refresh
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/broadcasts');

        return { success: statuses.length, failed: 0 };
    } catch(e: any) {
        console.error("Error in processStatusUpdateBatch:", e);
        return { success: 0, failed: statuses.length };
    }
}

export async function processIncomingMessageBatch(db: Db, messageGroups: any[]) {
    if (messageGroups.length === 0) return { success: 0, failed: 0 };
    
    const projectIds = [...new Set(messageGroups.map(group => new ObjectId(group.projectId)))];
    const projectsArray = await db.collection<Project>('projects').find({ _id: { $in: projectIds } }).toArray();
    const projectsMap = new Map(projectsArray.map(p => [p._id.toString(), p]));

    const processingPromises = messageGroups.map(group => {
        return (async () => {
            try {
                const project = projectsMap.get(group.projectId.toString());
                if (!project) throw new Error(`Project ${group.projectId} not found for message batch processing`);
                
                await handleSingleMessageEvent(db, project, group.message, group.contactProfile, group.phoneNumberId);
                return { success: true };
            } catch (e: any) {
                console.error(`Error processing a message from batch for project ${group.projectId}: ${e.message}`);
                return { success: false };
            }
        })();
    });

    const results = await Promise.all(processingPromises);
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        revalidatePath('/dashboard/notifications');
        revalidatePath('/dashboard', 'layout');
    }

    return { success: successCount, failed: results.length - successCount };
}

export async function processCommentWebhook(db: Db, project: WithId<Project>, commentData: any) {
    // Make sure we don't reply to our own comments
    if (commentData.from.id === project.facebookPageId) {
        return;
    }

    const settings = project.facebookCommentAutoReply;
    if (!settings?.enabled) {
        return;
    }
    
    const commentId = commentData.comment_id;
    const commentText = commentData.message;

    if (!commentId || !commentText) {
        console.error("Webhook processor: comment_id or message missing in comment webhook payload.", commentData);
        return;
    }

    // --- AI Moderation ---
    if (settings.moderationEnabled && settings.moderationPrompt) {
        try {
            const moderationResult = await processFacebookComment({
                commentText,
                moderationPrompt: settings.moderationPrompt,
            });
            
            if (moderationResult.shouldDelete) {
                console.log(`AI flagged comment ${commentId} for deletion. Reason: ${moderationResult.reason}`);
                try {
                    await axios.delete(`https://graph.facebook.com/v23.0/${commentId}`, {
                        params: { access_token: project.accessToken }
                    });
                    // Comment deleted, do not proceed to reply.
                    return;
                } catch (e: any) {
                    console.error(`Failed to delete comment ${commentId}:`, getErrorMessage(e));
                    // Even if deletion fails, we probably shouldn't reply to an abusive comment.
                    return;
                }
            }
        } catch(e) {
            console.error("AI Moderation flow failed:", getErrorMessage(e));
        }
    }

    // --- Reply Logic ---
    if (settings.replyMode === 'static' && settings.staticReplyText) {
        try {
            await axios.post(`https://graph.facebook.com/v23.0/${commentId}/comments`, {
                message: settings.staticReplyText,
                access_token: project.accessToken
            });
        } catch (e: any) {
            console.error(`Failed to post static auto-reply to comment ${commentId}:`, getErrorMessage(e));
        }
    } else if (settings.replyMode === 'ai' && settings.aiReplyPrompt) {
        try {
            const replyResult = await processFacebookComment({
                commentText,
                replyPrompt: settings.aiReplyPrompt,
            });

            if (replyResult.reply) {
                await axios.post(`https://graph.facebook.com/v23.0/${commentId}/comments`, {
                    message: replyResult.reply,
                    access_token: project.accessToken
                });
            }
        } catch (e: any) {
            console.error(`Failed to post AI auto-reply to comment ${commentId}:`, getErrorMessage(e));
        }
    }
}

export async function processMessengerWebhook(db: Db, project: WithId<Project>, messagingEvent: any) {
    const senderPsid = messagingEvent.sender?.id;
    const pageId = messagingEvent.recipient?.id;

    // Don't process echos from the page itself
    if (!senderPsid || senderPsid === pageId) {
        return;
    }

    const messageText = messagingEvent.message?.text;
    const now = new Date();
    const snippet = messageText?.substring(0, 100) || (messagingEvent.message?.attachments ? '[Attachment]' : messagingEvent.postback?.title || '[Interaction]');

    // Find or create subscriber, and update their status/info
    const subscriberResult = await db.collection('facebook_subscribers').findOneAndUpdate(
        { projectId: project._id, psid: senderPsid },
        { 
            $set: { snippet, updated_time: now },
            $inc: { unread_count: 1 },
            $setOnInsert: { 
                projectId: project._id, 
                psid: senderPsid, 
                name: `User ${senderPsid.slice(-4)}`, // Name will be updated later if we fetch it
                createdAt: now,
                status: 'new' // Set default status for new conversations
            }
        },
        { upsert: true, returnDocument: 'after' }
    );
    
    if (!subscriberResult) return;
    const isNewSubscriber = !subscriberResult.lastErrorObject?.updatedExisting;

    // Handle incoming messages or postbacks
    if (messagingEvent.message || messagingEvent.postback) {
        const { handled } = await handleEcommFlowLogic(db, project, subscriberResult, messagingEvent);
        if (handled) return; // Flow logic took precedence
        
        // If no flow was handled, check for other automations
        if (isNewSubscriber && project.ecommSettings?.welcomeMessage) {
             await axios.post(`https://graph.facebook.com/v23.0/me/messages`, 
                {
                    recipient: { id: senderPsid },
                    messaging_type: "RESPONSE",
                    message: { text: project.ecommSettings.welcomeMessage },
                },
                { params: { access_token: project.accessToken } }
            );
        } else if (isNewSubscriber && project.facebookWelcomeMessage?.enabled) {
            const welcomeSettings = project.facebookWelcomeMessage;
            const messagePayload: any = { text: welcomeSettings.message };
            if (welcomeSettings.quickReplies && welcomeSettings.quickReplies.length > 0) {
                messagePayload.quick_replies = welcomeSettings.quickReplies.map(qr => ({
                    content_type: "text", title: qr.title.substring(0, 20), payload: qr.payload || qr.title,
                }));
            }
            await axios.post(`https://graph.facebook.com/v23.0/me/messages`, 
                { recipient: { id: senderPsid }, messaging_type: "RESPONSE", message: messagePayload },
                { params: { access_token: project.accessToken } }
            );
        }
    }

    revalidatePath('/dashboard/facebook/messages');
    revalidatePath('/dashboard/facebook/kanban');
    revalidatePath('/dashboard/facebook/subscribers');
}

export async function processOrderWebhook(db: Db, project: WithId<Project>, orderData: any) {
    // This is a placeholder for full order processing logic.
    // For now, we'll create a notification.
    const orderId = orderData.order_id;
    const message = `A new order event was received for Order ID: ${orderId}. Event: ${orderData.update_time}`;
    
    await db.collection('notifications').insertOne({
        projectId: project._id,
        wabaId: project.wabaId || project.facebookPageId!,
        message,
        link: '/dashboard/facebook/commerce/orders',
        isRead: false,
        createdAt: new Date(),
        eventType: 'commerce_orders',
    });
    
    revalidatePath('/dashboard/facebook/commerce/orders');
    revalidatePath('/dashboard/notifications');
}


export async function processCatalogWebhook(db: Db, project: WithId<Project>, catalogData: any) {
    // Placeholder for catalog update logic
    const message = `A catalog event was received: ${catalogData.event}. Product: ${catalogData.product_id}`;
    
    await db.collection('notifications').insertOne({
        projectId: project._id,
        wabaId: project.wabaId || project.facebookPageId!,
        message,
        link: `/dashboard/facebook/commerce/products/${catalogData.catalog_id}`,
        isRead: false,
        createdAt: new Date(),
        eventType: 'catalog_product_events',
    });

    revalidatePath(`/dashboard/facebook/commerce/products/${catalogData.catalog_id}`);
    revalidatePath('/dashboard/notifications');
}

async function handleEcommFlowLogic(db: Db, project: WithId<Project>, contact: WithId<FacebookSubscriber>, messagingEvent: any): Promise<{ handled: boolean, logger?: FlowLogger, flowStatus?: 'finished' | 'waiting' | 'error' }> {
    const userInput = messagingEvent.message?.text?.trim() || messagingEvent.message?.quick_reply?.payload || messagingEvent.postback?.payload;

    if (contact.activeEcommFlow) {
        const flow = await db.collection<EcommFlow>('ecomm_flows').findOne({ _id: new ObjectId(contact.activeEcommFlow.flowId) });
        if (!flow) {
            await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $unset: { activeEcommFlow: "" } });
            return { handled: false };
        }
        
        const logger = new FlowLogger(db, flow, contact);
        const flowStatus = await executeEcommNode(db, project, contact, flow, contact.activeEcommFlow.currentNodeId, userInput, logger);
        return { handled: true, logger, flowStatus };
    }
    
    if (!userInput) return { handled: false };

    const flows = await db.collection<EcommFlow>('ecomm_flows').find({
        projectId: project._id,
        triggerKeywords: { $exists: true, $ne: [] }
    }).toArray();

    const triggeredFlow = flows.find(flow =>
        (flow.triggerKeywords || []).some(keyword => userInput?.toLowerCase().includes(keyword.toLowerCase().trim()))
    );

    if (triggeredFlow) {
        const startNode = triggeredFlow.nodes.find(n => n.type === 'start');
        if (!startNode) return { handled: false };

        const logger = new FlowLogger(db, triggeredFlow, contact);
        logger.log(`Flow triggered by keyword.`, { keyword: userInput });
        
        const newActiveFlow = {
            flowId: triggeredFlow._id.toString(),
            currentNodeId: startNode.id,
            variables: { name: contact.name, psid: contact.psid },
        };
        
        await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $set: { activeEcommFlow: newActiveFlow } });
        const updatedContact = { ...contact, activeEcommFlow: newActiveFlow };
        
        const flowStatus = await executeEcommNode(db, project, updatedContact, triggeredFlow, startNode.id, undefined, logger);
        return { handled: true, logger, flowStatus };
    }

    return { handled: false };
}


async function executeEcommNode(db: Db, project: WithId<Project>, contact: WithId<FacebookSubscriber>, flow: WithId<EcommFlow>, nodeId: string, userInput: string | undefined, logger: FlowLogger): Promise<'finished' | 'waiting' | 'error'> {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
        logger.log(`Error: Node with ID ${nodeId} not found. Terminating flow.`);
        await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $unset: { activeEcommFlow: "" } });
        await logger.save();
        return 'finished';
    }

    logger.log(`Executing node "${node.data.label}" (ID: ${node.id}, Type: ${node.type}).`);
    
    let currentVariables = contact.activeEcommFlow!.variables;
    
    await db.collection('facebook_subscribers').updateOne(
        { _id: contact._id },
        { $set: { "activeEcommFlow.currentNodeId": nodeId } }
    );
    
    let nextNodeId: string | null = null;
    let nextUserInput: string | undefined = undefined;

    // Reacting to user input
    if (userInput !== undefined) {
        logger.log(`Processing user input: "${userInput}"`);
        if (node.type === 'buttons') {
            const edge = flow.edges.find(e => e.source === nodeId && e.sourceHandle === userInput);
            if (edge) {
                nextNodeId = edge.target;
                const buttonIndex = parseInt(userInput.split('-btn-')[1] || '0', 10);
                const buttonText = node.data.buttons?.[buttonIndex]?.text || '';
                nextUserInput = buttonText;
            } else {
                 logger.log(`No path found for button payload: "${userInput}".`);
            }
        } else if (node.type === 'input') {
            if (node.data.variableToSave) {
                currentVariables[node.data.variableToSave] = userInput;
                await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $set: { "activeEcommFlow.variables": currentVariables } });
                logger.log(`Saved user input to variable "${node.data.variableToSave}".`);
            }
            const edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
        } else {
             logger.log(`Received user input "${userInput}" but current node "${node.data.label}" is not a waiting node. Terminating flow.`);
             await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $unset: { activeEcommFlow: "" } });
             await logger.save();
             return 'finished';
        }
    } 
    // Automatically progressing through the flow (no user input)
    else {
        switch (node.type) {
            case 'start':
                const startEdge = flow.edges.find(e => e.source === nodeId);
                if (startEdge) nextNodeId = startEdge.target;
                break;
            case 'text':
                await sendFlowMessage(db, project, contact, project.facebookPageId!, node.data.text, currentVariables);
                const textEdge = flow.edges.find(e => e.source === nodeId);
                if (textEdge) nextNodeId = textEdge.target;
                break;
            case 'image':
                await sendFlowImage(db, project, contact, project.facebookPageId!, node, currentVariables);
                const imageEdge = flow.edges.find(e => e.source === nodeId);
                if(imageEdge) nextNodeId = imageEdge.target;
                break;
            case 'delay':
                logger.log(`Delaying for ${node.data.delaySeconds || 1} seconds.`);
                await new Promise(res => setTimeout(res, (node.data.delaySeconds || 1) * 1000));
                const delayEdge = flow.edges.find(e => e.source === nodeId);
                if(delayEdge) nextNodeId = delayEdge.target;
                break;

            case 'buttons':
            case 'input':
            case 'condition': // Condition can also wait
                if (node.type === 'buttons') {
                    await sendEcommFlowQuickReplies(db, project, contact, node, currentVariables);
                } else if (node.type === 'input') {
                    await sendFlowMessage(db, project, contact, project.facebookPageId!, node.data.text, currentVariables);
                } else if (node.type === 'condition' && node.data.conditionType === 'user_response') {
                    // Do nothing, just wait for the next input from the user
                } else {
                    // This is a condition that should execute immediately
                     const valueToCheck = interpolate(node.data.variable, currentVariables);
                     const interpolatedCheckValue = interpolate(node.data.value, currentVariables);
                     // ... execute condition logic ...
                     let conditionMet = valueToCheck === interpolatedCheckValue; // Simplified
                     const handle = conditionMet ? `${node.id}-output-yes` : `${node.id}-output-no`;
                     const edge = flow.edges.find(e => e.sourceHandle === handle);
                     if (edge) nextNodeId = edge.target;
                     break;
                }

                logger.log(`Node "${node.data.label}" is waiting for user input.`);
                await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $set: { "activeEcommFlow.waitingSince": new Date() } });
                await logger.save();
                return 'waiting';
        }
    }

    if (nextNodeId) {
        await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $unset: { "activeEcommFlow.waitingSince": "" } });
        return executeEcommNode(db, project, { ...contact, activeEcommFlow: { ...contact.activeEcommFlow, variables: currentVariables } } as any, flow, nextNodeId, nextUserInput, logger);
    } else {
        logger.log("Flow execution finished.");
        await db.collection('facebook_subscribers').updateOne({ _id: contact._id }, { $unset: { activeEcommFlow: "" } });
        await logger.save();
        return 'finished';
    }
}
