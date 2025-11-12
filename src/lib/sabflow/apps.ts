
'use client';

import {
  MessageSquare,
  GitFork,
  Mail,
  Server,
  Combine,
  Code2,
  Forward,
  Replace,
  Timer,
  Globe2,
  FileUp,
  Filter,
  IterationCcw,
  Braces,
  Table,
  Sigma,
  Cable,
  Webhook,
  Split,
  CaseSensitive,
  Route,
  Columns,
  Calendar,
  Link as LinkIcon,
  QrCode,
  Handshake,
  Repeat,
  Zap,
  Tag,
  XCircle,
  Users,
  Search,
  UserPlus,
  Inbox,
  User,
  History as HistoryIcon,
  Newspaper,
  Pencil,
  Trash2 as TrashIcon,
  ThumbsUp,
  MessageCircle,
  Megaphone,
  LayoutDashboard,
  Video,
  ListFilter,
  ShoppingBag,
  Package
} from 'lucide-react';
import { WhatsAppIcon, MetaIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { apiActions } from './actions/api';

const wachatActions = [
    {
        name: 'sendMessage',
        label: 'Send Text Message',
        description: 'Sends a simple text message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', placeholder: 'e.g., 919876543210', required: true },
            { name: 'message', label: 'Message Text', type: 'textarea', required: true },
        ]
    },
    {
        name: 'sendTemplate',
        label: 'Send Template Message',
        description: 'Sends a pre-approved message template.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'templateId', label: 'Template ID', type: 'text', required: true },
        ]
    },
    {
        name: 'sendImage',
        label: 'Send Image',
        description: 'Sends an image message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Image URL', type: 'text', required: true },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
    {
        name: 'sendVideo',
        label: 'Send Video',
        description: 'Sends a video message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Video URL', type: 'text', required: true },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
    {
        name: 'sendDocument',
        label: 'Send Document',
        description: 'Sends a document.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Document URL', type: 'text', required: true },
            { name: 'filename', label: 'Filename (Optional)', type: 'text' },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
     {
        name: 'sendAudio',
        label: 'Send Audio',
        description: 'Sends an audio message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Audio URL', type: 'text', required: true },
        ]
    },
    {
        name: 'sendSticker',
        label: 'Send Sticker',
        description: 'Sends a sticker.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Sticker URL', type: 'text', required: true },
        ]
    },
    {
        name: 'sendLocation',
        label: 'Send Location',
        description: 'Sends a map location.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'latitude', label: 'Latitude', type: 'number', required: true },
            { name: 'longitude', label: 'Longitude', type: 'number', required: true },
            { name: 'name', label: 'Location Name', type: 'text' },
            { name: 'address', label: 'Address', type: 'text' },
        ]
    },
    {
        name: 'sendContact',
        label: 'Send Contact Card',
        description: 'Sends a contact card.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'contactName', label: 'Contact\'s Full Name', type: 'text', required: true },
            { name: 'contactPhone', label: 'Contact\'s Phone Number', type: 'tel', required: true },
        ]
    },
    {
        name: 'createContact',
        label: 'Create Contact',
        description: 'Creates a new contact in Wachat.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'waId', label: 'WhatsApp ID', type: 'text', required: true },
        ]
    },
    {
        name: 'updateContact',
        label: 'Update Contact Variables',
        description: 'Updates custom attributes for a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'variables', label: 'Variables (JSON)', type: 'textarea', placeholder: '{"membership_level": "gold"}', required: true },
        ]
    },
    {
        name: 'addContactTag',
        label: 'Add Tag to Contact',
        description: 'Adds a specific tag to a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
    {
        name: 'removeContactTag',
        label: 'Remove Tag from Contact',
        description: 'Removes a specific tag from a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
     {
        name: 'getContact',
        label: 'Get Contact Details',
        description: 'Retrieves all information for a specific contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'getConversation',
        label: 'Get Conversation History',
        description: 'Retrieves the recent message history for a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'markAsRead',
        label: 'Mark Conversation as Read',
        description: 'Marks a contact\'s conversation as read.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'assignAgent',
        label: 'Assign Agent to Conversation',
        description: 'Assigns a team member to a conversation.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'agentId', label: 'Agent User ID', type: 'text', required: true },
        ]
    },
    {
        name: 'changeConversationStatus',
        label: 'Change Conversation Status',
        description: 'Updates the status of a conversation (e.g., open, resolved).',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'status', label: 'New Status', type: 'text', required: true },
        ]
    },
    {
        name: 'triggerFlow',
        label: 'Trigger Another Flow',
        description: 'Starts another Wachat flow for the contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'flowId', label: 'Flow ID', type: 'text', required: true },
        ]
    },
    {
        name: 'requestRazorpayPayment',
        label: 'Request Razorpay Payment',
        description: 'Sends a Razorpay payment link to the contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
    {
        name: 'requestWaPayPayment',
        label: 'Request WhatsApp Pay',
        description: 'Sends a native WhatsApp Pay request.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
];

const crmActions = [
    {
        name: 'createLead',
        label: 'Create Lead & Deal',
        description: 'Creates a new lead and an associated deal in the sales pipeline.',
        inputs: [
            { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone', label: 'Phone', type: 'tel' },
            { name: 'company', label: 'Company Name', type: 'text' },
            { name: 'dealName', label: 'Deal Name / Subject', type: 'text', required: true },
            { name: 'dealValue', label: 'Deal Value', type: 'number', required: true },
            { name: 'dealStage', label: 'Initial Deal Stage', type: 'text', placeholder: 'e.g., New' },
        ]
    },
    {
        name: 'addNote',
        label: 'Add Note to Record',
        description: 'Adds a note to a contact, account, or deal.',
        inputs: [
            { name: 'recordId', label: 'Record ID', type: 'text', required: true, placeholder: 'e.g., {{trigger.contactId}}' },
            { name: 'recordType', label: 'Record Type', type: 'select', options: ['contact', 'account', 'deal'], required: true },
            { name: 'noteContent', label: 'Note Content', type: 'textarea', required: true },
        ]
    }
];

const emailActions = [
    {
        name: 'sendEmail',
        label: 'Send Email',
        description: 'Sends an email using your configured SMTP or OAuth provider.',
        inputs: [
            { name: 'to', label: 'To', type: 'email', required: true },
            { name: 'subject', label: 'Subject', type: 'text', required: true },
            { name: 'body', label: 'Body (HTML)', type: 'textarea', required: true },
        ]
    }
];

const metaActions = [
    // Content
    { name: 'createPost', label: 'Create Post', description: 'Publish a new post to your page.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }, { name: 'imageUrl', label: 'Image URL (Optional)', type: 'text' }] },
    { name: 'updatePost', label: 'Update Post', description: 'Edit the message of an existing post.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'postId', label: 'Post ID', type: 'text', required: true }, { name: 'message', label: 'New Message', type: 'textarea', required: true }] },
    { name: 'deletePost', label: 'Delete Post', description: 'Permanently delete a post.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'postId', label: 'Post ID', type: 'text', required: true }] },
    // Engagement
    { name: 'getComments', label: 'Get Post Comments', description: 'Retrieve comments for a specific post or comment.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true }] },
    { name: 'postComment', label: 'Reply to Post/Comment', description: 'Post a new comment or reply to an existing one.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true }, { name: 'message', label: 'Comment Text', type: 'textarea', required: true }] },
    { name: 'likeObject', label: 'Like Post/Comment', description: 'Like a post or comment.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true }] },
    { name: 'deleteComment', label: 'Delete Comment', description: 'Permanently delete a comment.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'commentId', label: 'Comment ID', type: 'text', required: true }] },
    // Data Retrieval
    { name: 'getPagePosts', label: 'Get Page Posts', description: 'Retrieve a list of recent posts from your page.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    { name: 'getPageInsights', label: 'Get Page Insights', description: 'Fetch performance metrics for your page.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    // Messenger
    { name: 'sendMessengerMessage', label: 'Send Messenger Message', description: 'Send a text message to a user in Messenger.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'recipientId', label: 'Recipient PSID', type: 'text', required: true }, { name: 'messageText', label: 'Message Text', type: 'textarea', required: true }] },
    { name: 'getPageConversations', label: 'Get Messenger Conversations', description: 'Retrieve a list of recent Messenger conversations.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    { name: 'getConversationMessages', label: 'Get Conversation Messages', description: 'Fetch messages from a specific Messenger conversation.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'conversationId', label: 'Conversation ID', type: 'text', required: true }] },
    // Live Video
    { name: 'scheduleLiveVideo', label: 'Schedule Live Video', description: 'Schedule a pre-recorded video to premiere as a live stream.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'scheduledDate', label: 'Date (YYYY-MM-DD)', type: 'text', required: true }, { name: 'scheduledTime', label: 'Time (HH:MM)', type: 'text', required: true }, { name: 'videoUrl', label: 'Video Source URL', type: 'text', required: true }] },
    { name: 'getScheduledLiveVideos', label: 'Get Scheduled Live Videos', description: 'Retrieve a list of your scheduled live streams.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    // Ads & Catalog
    { name: 'getAdCampaigns', label: 'Get Ad Campaigns', description: 'Retrieve a list of ad campaigns.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    { name: 'getCatalogs', label: 'Get Product Catalogs', description: 'Fetch all product catalogs for the business.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }] },
    { name: 'getProductsForCatalog', label: 'Get Catalog Products', description: 'List all products within a specific catalog.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'catalogId', label: 'Catalog ID', type: 'text', required: true }] },
    { name: 'addProductToCatalog', label: 'Add Product to Catalog', description: 'Create a new product in a catalog.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'catalogId', label: 'Catalog ID', type: 'text', required: true }, { name: 'name', label: 'Product Name', type: 'text', required: true }, { name: 'price', label: 'Price', type: 'number', required: true }, { name: 'currency', label: 'Currency', type: 'text', required: true, placeholder: 'e.g., USD' }, { name: 'retailer_id', label: 'SKU / Retailer ID', type: 'text', required: true }, { name: 'image_url', label: 'Image URL', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea' }] },
    { name: 'deleteProductFromCatalog', label: 'Delete Product from Catalog', description: 'Remove a product from a catalog.', inputs: [{ name: 'projectId', label: 'Facebook Project', type: 'project-selector', required: true }, { name: 'productId', label: 'Product ID', type: 'text', required: true }] },
];

const qrCodeMakerActions = [
    {
        name: 'generateQrCode',
        label: 'Generate QR Code',
        description: 'Generates a QR code from text or a URL.',
        inputs: [
            { name: 'data', label: 'Data to Encode', type: 'text', required: true },
            { name: 'name', label: 'Name for Saving (Optional)', type: 'text' },
        ]
    }
];

const sabChatActions = [
    { name: 'sendMessage', label: 'Send Message', description: 'Sends a message to an active chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'content', label: 'Message Content', type: 'textarea', required: true }
    ]},
    { name: 'closeSession', label: 'Close Session', description: 'Closes an active chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]},
    { name: 'addTagToSession', label: 'Add Tag to Session', description: 'Adds a tag to a chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'tagName', label: 'Tag Name', type: 'text', required: true },
    ]},
    { name: 'getOrCreateSession', label: 'Get or Create Session', description: 'Finds an existing session by email or creates a new one.', inputs: [
        { name: 'email', label: 'Visitor Email', type: 'email', required: true },
    ]},
    { name: 'getSessionDetails', label: 'Get Session Details', description: 'Retrieves all information for a specific chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]},
    { name: 'updateVisitorInfo', label: 'Update Visitor Info', description: 'Updates the name, email, or phone for a visitor.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
    ]},
    { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns a team member to a chat session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
        { name: 'agentId', label: 'Agent', type: 'agent-selector', required: true },
    ]},
    { name: 'getChatHistory', label: 'Get Chat History', description: 'Retrieves the message history for a session.', inputs: [
        { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true },
    ]}
];

const smsActions = [
    {
        name: 'sendSms',
        label: 'Send SMS',
        description: 'Sends a standard SMS message via Twilio.',
        inputs: [
            { name: 'to', label: 'To (Phone Number)', type: 'tel', required: true, placeholder: 'e.g. 919876543210' },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
        ]
    }
];

const urlShortenerActions = [
    {
        name: 'createShortLink',
        label: 'Create Short Link',
        description: 'Creates a new short, trackable link.',
        inputs: [
            { name: 'longUrl', label: 'Original URL', type: 'text', required: true },
            { name: 'alias', label: 'Custom Alias (Optional)', type: 'text' },
        ]
    }
];

export const sabnodeAppActions = [
  // SabNode Internal Apps
    {
      appId: 'wachat',
      name: 'Wachat',
      icon: WhatsAppIcon,
      actions: wachatActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-wachat-icon',
    },
    {
      appId: 'sabchat',
      name: 'sabChat',
      icon: SabChatIcon,
      actions: sabChatActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-sabchat-icon',
    },
    {
      appId: 'meta',
      name: 'Meta Suite',
      icon: MetaIcon,
      actions: metaActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-meta-icon',
    },
    {
      appId: 'instagram',
      name: 'Instagram Suite',
      icon: InstagramIcon,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-instagram-icon',
    },
    {
      appId: 'crm',
      name: 'CRM Suite',
      icon: Handshake,
      actions: crmActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-crm-icon',
    },
    {
      appId: 'email',
      name: 'Email Suite',
      icon: Mail,
      actions: emailActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-email-icon',
    },
    {
      appId: 'sms',
      name: 'SMS Suite',
      icon: MessageSquare,
      actions: smsActions,
      connectionType: 'internal',
      iconColor: 'text-sabflow-sms-icon',
    },
    { appId: 'url-shortener', name: 'URL Shortener', icon: LinkIcon, actions: urlShortenerActions, connectionType: 'internal', iconColor: 'text-sabflow-url-shortener-icon' },
    { appId: 'qr-code-maker', name: 'QR Code Maker', icon: QrCode, actions: qrCodeMakerActions, connectionType: 'internal', iconColor: 'text-sabflow-qr-code-maker-icon' },
    { appId: 'seo-suite', name: 'SEO Suite', icon: SeoIcon, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-seo-suite-icon' },

  // Core Apps
  { appId: 'api', name: 'API Request', icon: Server, actions: apiActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-api-icon' },
  { appId: 'array_function', name: 'Array Function', icon: Combine, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-array_function-icon' },
  { appId: 'code', name: 'Code', icon: Code2, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-code-icon' },
  { appId: 'data_forwarder', name: 'Data Forwarder', icon: Forward, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_forwarder-icon' },
  { appId: 'data_transformer', name: 'Data Transformer', icon: Replace, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_transformer-icon' },
  { appId: 'datetime_formatter', name: 'DateTime Formatter', icon: Calendar, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-datetime_formatter-icon' },
  { appId: 'delay', name: 'Delay', icon: Timer, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-delay-icon' },
  { appId: 'dynamic_web_page', name: 'Dynamic Web Page', icon: Globe2, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-dynamic_web_page-icon' },
  { appId: 'file_uploader', name: 'File Uploader', icon: FileUp, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-file_uploader-icon' },
  { appId: 'filter', name: 'Filter', icon: Filter, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-filter-icon' },
  { appId: 'iterator', name: 'Iterator', icon: IterationCcw, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-iterator-icon' },
  { appId: 'json_extractor', name: 'JSON Extractor', icon: Braces, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-json_extractor-icon' },
  { appId: 'lookup_table', name: 'Lookup Table', icon: Table, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-lookup_table-icon' },
  { appId: 'number_formatter', name: 'Number Formatter', icon: Sigma, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-number_formatter-icon' },
  { appId: 'connect_manager', name: 'Connect Manager', icon: Cable, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-connect_manager-icon' },
  { appId: 'hook', name: 'Hook', icon: Webhook, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-hook-icon' },
  { appId: 'subscription_billing', name: 'Subscription Billing', icon: Repeat, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-subscription_billing-icon' },
  { appId: 'router', name: 'Router', icon: Route, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-router-icon' },
  { appId: 'select_transform_json', name: 'Select Transform JSON', icon: Columns, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-select_transform_json-icon' },
  { appId: 'text_formatter', name: 'Text Formatter', icon: CaseSensitive, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-text_formatter-icon' },

  // External Apps
  {
    appId: 'google_sheets',
    name: 'Google Sheets',
    category: 'Productivity',
    description: "Connect Google Sheets by sending data to your flow's webhook URL from an Apps Script trigger.",
    icon: Zap, // Fallback icon
    connectionType: 'webhook',
    iconColor: 'text-sabflow-google_sheets-icon',
    actions: []
  },
  { 
    appId: 'stripe',
    name: 'Stripe',
    category: 'Payment',
    description: "Connect your Stripe account to create customers, manage subscriptions, and process payments.",
    icon: Zap, // Fallback icon
    connectionType: 'apikey',
    credentials: [
        { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
    iconColor: 'text-sabflow-stripe-icon',
    actions: []
  },
  { 
    appId: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    description: "Connect your Shopify store to manage customers, orders, and products.",
    icon: Zap, // Fallback icon
    connectionType: 'apikey',
    credentials: [
        { name: 'shopName', label: 'Shop Name', type: 'text', placeholder: 'your-store' },
        { name: 'accessToken', label: 'Admin API Access Token', type: 'password' },
    ],
    iconColor: 'text-sabflow-shopify-icon',
    actions: []
  },
  {
    appId: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: "Connect your Slack workspace to send messages to channels or users.",
    icon: Zap, // Fallback icon
    connectionType: 'oauth',
    iconColor: 'text-sabflow-slack-icon',
    actions: []
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    category: 'Email',
    description: "Connect your Gmail account to send and receive emails.",
    icon: Mail,
    connectionType: 'oauth',
    color: 'bg-gradient-to-br from-red-500 to-red-600',
    actions: []
  },
  { 
    appId: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: "Connect your HubSpot account to sync contacts, deals, and companies.",
    icon: Handshake,
    connectionType: 'apikey',
    credentials: [
         { name: 'accessToken', label: 'Private App Access Token', type: 'password' },
    ],
    color: 'bg-gradient-to-br from-orange-500 to-orange-600',
    actions: []
  },
  {
    appId: 'discord',
    name: 'Discord',
    category: 'Communication',
    description: "Connect your Discord server to send messages and manage roles.",
    icon: Zap, // Fallback icon
    connectionType: 'oauth',
    iconColor: 'text-sabflow-discord-icon',
    actions: []
  },
  {
    appId: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: "Connect your Notion workspace to create pages and database entries.",
    icon: Zap, // Fallback icon
    connectionType: 'oauth',
    iconColor: 'text-sabflow-notion-icon',
    actions: []
  }
];
