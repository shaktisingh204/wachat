
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

export type Project = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    wabaId: string;
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
    tags?: Tag[];
    planId?: ObjectId;
    credits?: number;
    connectedCatalogId?: string;
    hasCatalogManagement?: boolean;
    kanbanStatuses?: string[];
    plan?: WithId<Plan>; // populated by aggregate
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
    campaigns: boolean;
    liveChat: boolean;
    contacts: boolean;
    templates: boolean;
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
};

export type Invitation = {
    _id: ObjectId;
    projectId: ObjectId;
    projectName: string;
    inviterId: ObjectId;
    inviterName: string;
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

export type FlowLogEntry = {
    timestamp: Date;
    message: string;
    data?: any;
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
    broadcastType: 'template' | 'flow';
    templateId?: ObjectId;
    metaFlowId?: ObjectId;
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
