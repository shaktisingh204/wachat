

'use client';

import React, { useState } from 'react';
import { handleTranslateMessage } from '@/app/actions';
import type { AnyMessage, OutgoingMessage } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon, Image as ImageIcon, XCircle, Languages, LoaderCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { getPaymentRequestStatus } from '@/app/actions/whatsapp.actions';

interface ChatMessageProps {
    message: AnyMessage;
}

function StatusTicks({ message }: { message: OutgoingMessage }) {
    const { status, statusTimestamps } = message;

    const getIcon = () => {
        switch (status) {
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'read':
                return <CheckCheck className="h-4 w-4 text-blue-500" />;
            case 'delivered':
                return <CheckCheck className="h-4 w-4" />;
            case 'sent':
                return <Check className="h-4 w-4" />;
            default:
                return <Clock className="h-4 w-4" />; // for 'pending'
        }
    };

    const formatTimestamp = (date: Date | string | undefined) => {
        if (!date) return '';
        return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground">{getIcon()}</span>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                    <div className="text-xs space-y-1 p-1">
                        {statusTimestamps?.read && <p>Read: {formatTimestamp(statusTimestamps.read)}</p>}
                        {statusTimestamps?.delivered && <p>Delivered: {formatTimestamp(statusTimestamps.delivered)}</p>}
                        {statusTimestamps?.sent && <p>Sent: {formatTimestamp(statusTimestamps.sent)}</p>}
                        {status === 'pending' && <p>Pending...</p>}
                        {status === 'failed' && <p>Failed</p>}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function MediaContent({ message }: { message: AnyMessage }) {
    const type = message.type;
    const media = message.content[type as keyof typeof message.content] as any;

    if (!media && type !== 'unsupported') return <div className="text-sm text-muted-foreground italic">[Unsupported message content]</div>;
    
    const url = media.url || media.link;
    const caption = media.caption || '';
    const fileName = media.filename || 'download';

    if (type === 'image') {
        if (url) {
            return (
                <div className="space-y-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-64 bg-muted rounded-lg overflow-hidden">
                        <Image src={url} alt={caption || 'Sent image'} layout="fill" objectFit="cover" data-ai-hint="chat image" />
                    </a>
                    {caption && <p className="text-sm">{caption}</p>}
                </div>
            );
        }
        return <div className="text-sm text-muted-foreground italic">[Image received - preview unavailable]</div>;
    }

    if (type === 'video') {
         return <div className="text-sm text-muted-foreground italic">[Video received]</div>;
    }

    if (type === 'document') {
        if (url) {
            return (
                <a href={url} target="_blank" rel="noopener noreferrer" download={fileName} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors max-w-xs">
                    <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate">{fileName}</p>
                        {caption && <p className="text-xs text-muted-foreground truncate">{caption}</p>}
                    </div>
                    <Download className="h-5 w-5 text-muted-foreground" />
                </a>
            );
        }
        return <div className="text-sm text-muted-foreground italic">[Document received: {fileName}]</div>;
    }

    if (type === 'audio') {
        return <div className="text-sm text-muted-foreground italic">[Audio message]</div>;
    }

    if (type === 'sticker') {
        return <div className="text-sm text-muted-foreground italic">[Sticker]</div>;
    }
    
    return <div className="text-sm text-muted-foreground italic">[{type} message]</div>;
};

const PaymentRequestContent = ({ message }: { message: OutgoingMessage }) => {
    const { toast } = useToast();
    const [isChecking, startCheckingTransition] = React.useTransition();
    const [currentStatus, setCurrentStatus] = useState(message.status);

    const checkStatus = async () => {
        startCheckingTransition(async () => {
            const contactId = message.contactId.toString();
            const contact = await (await fetch(`/api/contact/${contactId}`)).json(); // A helper API might be needed for client components
            // This is a simplification. A better approach would be a dedicated server action.
            // For now, let's assume we can get the project ID and phone number ID this way.
            const result = await getPaymentRequestStatus(contact.projectId, contact.phoneNumberId, message.wamid);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive'});
            } else {
                toast({ title: 'Status Updated', description: `Payment status is now: ${result.status}` });
                if(result.status) setCurrentStatus(result.status);
            }
        });
    };

    return (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 space-y-2">
            <p className="font-semibold">WhatsApp Pay Request Sent</p>
            <p className="text-sm">Amount: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(message.content.amount.value)}</p>
            <p className="text-sm text-muted-foreground">{message.content.description}</p>
            <div className="flex justify-between items-center pt-2">
                <Badge variant="secondary" className="capitalize">{currentStatus}</Badge>
                <Button variant="outline" size="sm" onClick={checkStatus} disabled={isChecking}>
                    {isChecking ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
};


const MessageBody = ({ message, isOutgoing }: { message: AnyMessage; isOutgoing: boolean }) => {
    // Outgoing message from bot with buttons
    if (isOutgoing && message.type === 'interactive' && message.content.interactive?.type === 'button') {
        const interactive = message.content.interactive;
        return (
            <div>
                <p className="whitespace-pre-wrap">{interactive.body.text}</p>
                <div className="mt-2 pt-2 border-t border-black/10 space-y-1">
                    {interactive.action.buttons.map((btn: any, index: number) => (
                        <div key={index} className="text-center bg-white/50 rounded-md py-1.5 text-sm font-medium text-blue-500">
                            {btn.reply.title}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    // Incoming interactive reply
    if (!isOutgoing && message.type === 'interactive' && message.content.interactive?.button_reply?.title) {
        return <p className="whitespace-pre-wrap">{message.content.interactive.button_reply.title}</p>;
    }
    
    // Standard text message
    if (message.type === 'text' && message.content.text?.body) {
        return <p className="whitespace-pre-wrap">{message.content.text.body}</p>;
    }

    if (message.type === 'payment_request') {
        return <PaymentRequestContent message={message as OutgoingMessage} />;
    }

    // Media and other types
    return <MediaContent message={message} />;
};


export const ChatMessage = React.memo(function ChatMessage({ message }: ChatMessageProps) {
    const isOutgoing = message.direction === 'out';
    const timestamp = message.messageTimestamp || message.createdAt;
    
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const { toast } = useToast();

    const onTranslate = async () => {
        let originalText = message.content.text?.body;
        if (!originalText && message.type === 'interactive') {
            originalText = message.content.interactive?.button_reply?.title;
        }

        if (!originalText) return;

        setIsTranslating(true);
        const result = await handleTranslateMessage(originalText);
        setIsTranslating(false);

        if (result.error) {
            toast({ title: 'Translation Error', description: result.error, variant: 'destructive' });
        } else if (result.translatedText) {
            setTranslatedText(result.translatedText);
        }
    };
    
    return (
        <div className={cn("flex items-end gap-2 group/message", isOutgoing ? "justify-end" : "justify-start")}>
            {!isOutgoing && (
                <Avatar className="h-8 w-8 self-end">
                    <AvatarFallback>{message.content?.profile?.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
            )}
            <div
                className={cn(
                    "max-w-[70%] rounded-lg p-2 px-3 text-sm flex flex-col shadow-sm",
                    isOutgoing
                        ? "bg-[#E2F7CB] dark:bg-[#056056] text-gray-800 dark:text-gray-50 rounded-br-none"
                        : "bg-white dark:bg-muted rounded-bl-none"
                )}
            >
                <MessageBody message={message} isOutgoing={isOutgoing} />

                {translatedText && (
                    <>
                        <Separator className="my-2 bg-black/10 dark:bg-white/10" />
                        <p className="whitespace-pre-wrap italic text-muted-foreground">{translatedText}</p>
                    </>
                )}


                {isOutgoing && message.status === 'failed' && (
                    <p className="text-xs mt-1 pt-1 border-t border-black/10 text-red-600 dark:text-red-400">
                        Failed: {message.error}
                    </p>
                )}

                <div className="flex items-center gap-1.5 self-end mt-1">
                    <p className="text-xs text-muted-foreground/80">
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isOutgoing && <StatusTicks message={message as OutgoingMessage} />}
                </div>
            </div>
        </div>
    );
});

```
- src/lib/definitions.ts:
  <content><![CDATA[

import type { ObjectId, WithId } from 'mongodb';

export type CrmModulePermissions = {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
};

export type CrmPermissions = {
    agent: {
        contacts?: CrmModulePermissions,
        accounts?: CrmModulePermissions,
        deals?: CrmModulePermissions,
        tasks?: CrmModulePermissions,
    }
};

export type CrmAutomationNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number, y: number };
};

export type CrmAutomationEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
};

export type CrmAutomation = {
    name: string;
    userId: ObjectId;
    nodes: CrmAutomationNode[];
    edges: CrmAutomationEdge[];
    createdAt: Date;
    updatedAt: Date;
};

export type CrmEmailSettings = {
    _id: ObjectId;
    userId: ObjectId;
    provider: 'smtp' | 'google' | 'outlook';
    fromName?: string;
    fromEmail?: string;
    smtp?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
    };
    googleOAuth?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
    };
    outlookOAuth?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
    };
}

export type CrmTask = {
    _id: ObjectId;
    userId: ObjectId;
    contactId?: ObjectId;
    dealId?: ObjectId;
    title: string;
    description?: string;
    dueDate?: Date;
    status: 'To-Do' | 'In Progress' | 'Completed';
    priority: 'High' | 'Medium' | 'Low';
    type: 'Call' | 'Meeting' | 'Follow-up' | 'WhatsApp' | 'Email';
    assignedTo?: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
};

export type CrmDeal = {
    _id: ObjectId;
    userId: ObjectId;
    accountId?: ObjectId;
    contactIds?: ObjectId[];
    name: string;
    value: number;
    currency: string;
    stage: string;
    closeDate?: Date;
    probability?: number;
    ownerId?: ObjectId; // User ID
    createdAt: Date;
    updatedAt?: Date;
    notes?: {
        content: string;
        createdAt: Date;
        author: string;
    }[];
    products?: { name: string; quantity: number; price: number }[];
};

export type CrmAccount = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    notes?: {
        content: string;
        createdAt: Date;
        author: string;
    }[];
    contactIds?: ObjectId[];
    dealIds?: ObjectId[];
    createdAt: Date;
    updatedAt?: Date;
};

export type CrmContact = {
    _id: ObjectId;
    userId: ObjectId;
    accountId?: ObjectId;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    avatarUrl?: string;
    status: 'new_lead' | 'contacted' | 'qualified' | 'unqualified' | 'customer' | 'imported';
    leadScore?: number;
    assignedTo?: string; // User ID or name
    lastActivity?: Date;
    notes?: {
        content: string;
        createdAt: Date;
        author: string;
    }[];
    tags?: string[];
    createdAt: Date;
    updatedAt?: Date;
};

export type BusinessCapabilities = {
    max_daily_conversation_per_phone: number;
    max_phone_numbers_per_business: number;
};

export type PaymentConfiguration = {
    configuration_name: string;
    provider_name: string;
    status: string;
    created_timestamp: number;
    updated_timestamp: number;
    provider_mid: string;
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

export type WeeklyOperatingHours = {
    day_of_week: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
    open_time: string; // "HHMM"
    close_time: string; // "HHMM"
};

export type HolidaySchedule = {
    date: string; // "YYYY-MM-DD"
    start_time: string; // "HHMM"
    end_time: string; // "HHMM"
};

export type CallHours = {
    status: 'ENABLED' | 'DISABLED';
    timezone_id: string;
    weekly_operating_hours: WeeklyOperatingHours[];
    holiday_schedule: HolidaySchedule[];
};

export type SIPServer = {
    hostname: string;
    port: number;
    request_uri_user_params?: Record<string, string>;
};

export type SIPSettings = {
    status: 'ENABLED' | 'DISABLED';
    servers: SIPServer[];
};

export type CallingSettings = {
    status: 'ENABLED' | 'DISABLED';
    call_icon_visibility: 'DEFAULT' | 'HIDDEN' | 'SHOW';
    call_hours: CallHours;
    callback_permission_status: 'ENABLED' | 'DISABLED';
    sip: SIPSettings;
};

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
    is_calling_enabled?: boolean;
    inbound_call_control?: 'DISABLED' | 'CALLBACK_REQUEST';
    calling_settings?: CallingSettings;
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

export type WhatsAppWidgetSettings = {
    phoneNumber: string;
    prefilledMessage: string;
    position: 'bottom-right' | 'bottom-left';
    buttonColor: string;
    headerTitle: string;
    headerSubtitle: string;
    headerAvatarUrl: string;
    welcomeMessage: string;
    ctaText: string;
    borderRadius: number;
    padding: number;
    textColor: string;
    buttonTextColor: string;
    stats?: {
        loads: number;
        opens: number;
        clicks: number;
    }
};

export type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea' | 'url' | 'tel' | 'radio' | 'checkbox' | 'select' | 'number' | 'date' | 'time' | 'file' | 'password' | 'hidden' | 'html' | 'acceptance';
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  columnWidth?: string;
  fieldId?: string;
  labelPosition?: 'above' | 'inline' | 'hidden';
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  multiple?: boolean;
  options?: string;
  maxFileSize?: number;
  allowedFileTypes?: string;
  htmlContent?: string;
};

export type WebsiteBlock = {
    id: string;
    type: 'hero' | 'featuredProducts' | 'richText' | 'testimonials' | 'faq' | 'customHtml' | 'heading' | 'image' | 'button' | 'video' | 'icon' | 'spacer' | 'imageCarousel' | 'tabs' | 'accordion' | 'form' | 'map' | 'countdown' | 'socialShare' | 'repeater' | 'section' | 'columns' | 'column' | 'productImage' | 'productTitle' | 'productPrice' | 'productDescription' | 'productAddToCart' | 'productBreadcrumbs' | 'cart' | 'accountDashboard' | 'accountOrders' | 'accountProfileForm' | 'accountAddressBook' | 'accountWishlist' | 'accountReturns' | 'accountDownloads' | 'accountCompare' | 'accountLoginForm' | 'accountRegisterForm' | 'crmAutomation';
    settings: any;
    children?: WebsiteBlock[];
};

export type EcommTheme = {
    _id: ObjectId;
    name: string;
    description?: string;
    createdAt: Date;
    layouts: {
        headerLayout: WebsiteBlock[],
        footerLayout: WebsiteBlock[],
        productPageLayout: WebsiteBlock[],
        cartPageLayout: WebsiteBlock[],
    };
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
    createdAt: Date;
    updatedAt: Date;
    headerLayout?: WebsiteBlock[];
    footerLayout?: WebsiteBlock[];
    productPageLayout?: WebsiteBlock[];
    productsPageLayout?: WebsiteBlock[];
    categoryPageLayout?: WebsiteBlock[];
    searchPageLayout?: WebsiteBlock[];
    cartPageLayout?: WebsiteBlock[];
    accountPageLayout?: WebsiteBlock[];
    ordersPageLayout?: WebsiteBlock[];
    profilePageLayout?: WebsiteBlock[];
    addressBookPageLayout?: WebsiteBlock[];
    wishlistPageLayout?: WebsiteBlock[];
    returnsPageLayout?: WebsiteBlock[];
    downloadsPageLayout?: WebsiteBlock[];
    comparePageLayout?: WebsiteBlock[];
    loginPageLayout?: WebsiteBlock[];
    registerPageLayout?: WebsiteBlock[];
    themes?: EcommTheme[];
    appearance?: {
        primaryColor?: string;
        fontFamily?: string;
        bannerImageUrl?: string;
    }
};

export type EcommPage = {
    _id: ObjectId;
    shopId: ObjectId;
    projectId: ObjectId;
    name: string;
    slug: string;
    layout: WebsiteBlock[];
    isHomepage?: boolean;
    isPublished?: boolean;
    createdAt: Date;
    updatedAt: Date;
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
    widgetSettings?: WhatsAppWidgetSettings;
    tags?: Tag[];
    planId?: ObjectId;
    credits?: number;
    connectedCatalogId?: string;
    hasCatalogManagement?: boolean;
    kanbanStatuses?: string[];
    facebookKanbanStatuses?: string[];
    plan?: WithId<Plan> | null; // populated by aggregate
    ecommSettings?: {
        abandonedCart: AbandonedCartSettings;
    },
    razorpaySettings?: {
        keyId?: string;
        keySecret?: string;
    };
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
    type: 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow' | 'payment';
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
    facebookUserAccessToken?: string;
    activeProjectId?: string;
    crmIndustry?: string;
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
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive' | 'template' | 'payment_request';
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
    broadcastType: 'template' | 'flow';
    templateId?: ObjectId;
    templateName: string;
    flowId?: ObjectId;
    flowName?: string;
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
    payload?: string | null;
    debugInfo?: string | null;
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

export type EcommCartItem = {
    productId: string;
    name: string;
    price: number;
    imageUrl?: string;
    quantity: number;
};

export type EcommOrderItem = {
    productId: string;
    productName: string;
    variantInfo?: string; 
    quantity: number;
    price: number; 
};

export type EcommOrder = {
    _id: ObjectId;
    projectId: ObjectId;
    shopId: ObjectId;
    customerId?: ObjectId;
    items: EcommOrderItem[];
    subtotal: number;
    shipping: number;
    total: number;
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
    customerInfo: {
        name: string;
        email: string;
        phone?: string;
    };
    shippingAddress: {
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

export type EcommProductVariant = {
  id: string;
  name: string;
  options: string;
};

export type EcommProduct = {
  _id: ObjectId;
  projectId: ObjectId;
  shopId: ObjectId;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  imageUrl?: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  variants?: EcommProductVariant[];
  inventory?: { warehouseId: ObjectId, stock: number }[];
  createdAt: Date;
  updatedAt: Date;
};

export type CrmWarehouse = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    location?: string;
    isDefault?: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type CrmVendor = {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type CrmStockAdjustment = {
    _id: ObjectId;
    userId: ObjectId;
    productId: ObjectId;
    warehouseId: ObjectId;
    date: Date;
    quantity: number; // can be positive or negative
    reason: 'Initial Stock' | 'Stock Take' | 'Goods In' | 'Damaged' | 'Theft/Loss' | 'Sale' | 'Return';
    notes?: string;
    relatedPurchaseOrderId?: ObjectId;
    relatedSaleId?: ObjectId;
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

// --- Security Types ---
export type SessionPayload = { userId: string; email: string; jti: string; expires: number };
export type AdminSessionPayload = { role: 'admin'; loggedInAt: number; jti: string; expires: number };
