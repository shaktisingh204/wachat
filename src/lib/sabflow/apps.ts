
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
} from 'lucide-react';
import { WhatsAppIcon, MetaIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

const wachatActions = [
    { name: 'sendMessage', label: 'Send Text Message', description: 'Sends a simple text message.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', placeholder: 'e.g. 919876543210', required: true }, { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello {{name}}!' }] },
    { name: 'sendImage', label: 'Send Image', description: 'Sends an image from a URL, Base64, or file upload.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Image URL', type: 'text' }, { name: 'imageBase64', label: 'Base64 Data', type: 'textarea' }, { name: 'caption', label: 'Caption', type: 'text' }] },
    { name: 'sendTemplate', label: 'Send Template Message', description: 'Sends a pre-approved WhatsApp template.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'templateId', label: 'Template', type: 'dynamic-selector', fetch: 'wachatTemplates' }] },
    { name: 'triggerMetaFlow', label: 'Trigger Meta Flow', description: 'Starts an interactive Meta Flow.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'metaFlowId', label: 'Meta Flow', type: 'dynamic-selector', fetch: 'metaFlows' }, { name: 'header', label: 'Header Text', type: 'text' }, { name: 'body', label: 'Body Text', type: 'textarea' }, { name: 'footer', label: 'Footer Text', type: 'text' }] },
    { name: 'requestRazorpayPayment', label: 'Request Razorpay Payment', description: 'Sends a Razorpay payment link.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'amount', label: 'Amount (INR)', type: 'number' }, { name: 'description', label: 'Description', type: 'text' }] },
    { name: 'requestWaPayPayment', label: 'Request WhatsApp Payment', description: 'Initiates a WhatsApp Pay request.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'amount', label: 'Amount (INR)', type: 'number' }, { name: 'description', label: 'Description', type: 'text' }] },
    { name: 'createContact', label: 'Create/Update Contact', description: 'Creates a new contact or updates an existing one.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'name', label: 'Name', type: 'text' }, { name: 'waId', label: 'WhatsApp ID', type: 'text', required: true }] },
    { name: 'updateContact', label: 'Update Contact Variables', description: 'Updates custom attributes for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'variables', label: 'Variables (JSON)', type: 'textarea', placeholder: '{"key": "value"}' }] },
    { name: 'addContactTag', label: 'Add Tag to Contact', description: 'Adds a tag to a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'tagId', label: 'Tag ID', type: 'text' }] },
    { name: 'removeContactTag', label: 'Remove Tag from Contact', description: 'Removes a tag from a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'tagId', label: 'Tag ID', type: 'text' }] },
    { name: 'getContact', label: 'Get Contact Details', description: 'Retrieves all data for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
    { name: 'getConversation', label: 'Get Conversation History', description: 'Retrieves recent messages for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
    { name: 'markAsRead', label: 'Mark Conversation as Read', description: 'Marks the conversation as read.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
    { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns the conversation to a team member.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'agentId', label: 'Agent ID', type: 'agent-selector', fetch: 'agents' }] },
    { name: 'changeConversationStatus', label: 'Change Conversation Status', description: 'Updates the Kanban status of the conversation.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'status', label: 'New Status', type: 'text' }] },
    { name: 'triggerFlow', label: 'Trigger Another Flow', description: 'Starts another flow for the current contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'flowId', label: 'Flow ID', type: 'text' }] },
];

const sabChatActions = [
    { name: 'sendMessage', label: 'Send Message', description: 'Sends a message to a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'content', label: 'Message Content', type: 'textarea' }] },
    { name: 'closeSession', label: 'Close Session', description: 'Closes a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
    { name: 'addTagToSession', label: 'Add Tag to Session', description: 'Adds a tag to a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'tagName', label: 'Tag Name', type: 'text' }] },
    { name: 'getOrCreateSession', label: 'Get or Create Session', description: 'Finds an existing session or creates a new one for a visitor.', inputs: [{ name: 'email', label: 'Visitor Email', type: 'text' }] },
    { name: 'getSessionDetails', label: 'Get Session Details', description: 'Retrieves full details for a session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
    { name: 'updateVisitorInfo', label: 'Update Visitor Info', description: 'Updates the name, email, or phone of a visitor.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'name', label: 'Name', type: 'text' }, { name: 'email', label: 'Email', type: 'text' }, { name: 'phone', label: 'Phone', type: 'text' }] },
    { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns a chat session to a team member.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'agentId', label: 'Agent ID', type: 'agent-selector', fetch: 'agents' }] },
    { name: 'getChatHistory', label: 'Get Chat History', description: 'Retrieves the message history for a session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
];

const metaActions = [
    { name: 'createPost', label: 'Create Post', description: 'Create a new post on your Facebook Page.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'message', label: 'Message', type: 'textarea' }, { name: 'imageUrl', label: 'Image URL (Optional)', type: 'text' }, { name: 'imageBase64', label: 'Image (Base64)', type: 'textarea'}] },
    { name: 'updatePost', label: 'Update Post', description: 'Update the message of an existing post.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'postId', label: 'Post ID', type: 'text' }, { name: 'message', label: 'New Message', type: 'textarea' }] },
    { name: 'deletePost', label: 'Delete Post', description: 'Permanently delete a post.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'postId', label: 'Post ID', type: 'text' }] },
    { name: 'getComments', label: 'Get Comments', description: 'Retrieve comments from a post or another comment.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'objectId', label: 'Post/Comment ID', type: 'text' }] },
    { name: 'postComment', label: 'Post Comment', description: 'Post a comment or reply.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'objectId', label: 'Post/Comment ID', type: 'text' }, { name: 'message', label: 'Comment Text', type: 'textarea' }] },
    { name: 'likeObject', label: 'Like Post/Comment', description: 'Like a post or comment.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'objectId', label: 'Post/Comment ID', type: 'text' }] },
    { name: 'deleteComment', label: 'Delete Comment', description: 'Delete a comment.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'commentId', label: 'Comment ID', type: 'text' }] },
    { name: 'getPagePosts', label: 'Get Page Posts', description: 'Retrieve a list of recent posts from your page.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'getPageInsights', label: 'Get Page Insights', description: 'Get performance metrics for your page.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'sendMessengerMessage', label: 'Send Messenger Message', description: 'Send a text message to a user in Messenger.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'recipientId', label: 'Recipient PSID', type: 'text' }, { name: 'messageText', label: 'Message Text', type: 'textarea' }] },
    { name: 'getPageConversations', label: 'Get Messenger Conversations', description: 'Retrieve a list of recent conversations.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'getConversationMessages', label: 'Get Conversation Messages', description: 'Get messages from a specific Messenger conversation.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'conversationId', label: 'Conversation ID', type: 'text' }] },
    { name: 'scheduleLiveVideo', label: 'Schedule Live Video', description: 'Schedule a pre-recorded video to go live.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'title', label: 'Title', type: 'text' }, { name: 'videoUrl', label: 'Video URL', type: 'text' }, { name: 'scheduledDate', label: 'Date', type: 'date' }, { name: 'scheduledTime', label: 'Time', type: 'time' }] },
    { name: 'getScheduledLiveVideos', label: 'Get Scheduled Live Videos', description: 'Retrieve a list of scheduled live streams.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'getAdCampaigns', label: 'Get Ad Campaigns', description: 'Retrieve a list of ad campaigns.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'getCatalogs', label: 'Get Catalogs', description: 'Get a list of product catalogs.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }] },
    { name: 'getProductsForCatalog', label: 'Get Products in Catalog', description: 'Get products for a specific catalog ID.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'catalogId', label: 'Catalog ID', type: 'text' }] },
    { name: 'addProductToCatalog', label: 'Add Product to Catalog', description: 'Add a new product to a catalog.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'catalogId', label: 'Catalog ID', type: 'text' }, { name: 'name', label: 'Name', type: 'text' }, { name: 'price', label: 'Price', type: 'number' }, { name: 'currency', label: 'Currency', type: 'text' }, { name: 'retailer_id', label: 'SKU', type: 'text' }, { name: 'image_url', label: 'Image URL', type: 'text' }, { name: 'description', label: 'Description', type: 'textarea' }] },
    { name: 'deleteProductFromCatalog', label: 'Delete Product from Catalog', description: 'Delete a product from a catalog.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'productId', label: 'Product ID', type: 'text' }] },
];

const crmActions = [
    { name: 'createLead', label: 'Create Lead and Deal', description: 'Create a new contact and an associated sales deal.', inputs: [{ name: 'contactName', label: 'Contact Name', type: 'text' }, { name: 'email', label: 'Email', type: 'text' }, { name: 'phone', label: 'Phone', type: 'text' }, { name: 'company', label: 'Company', type: 'text' }, { name: 'dealName', label: 'Deal Name', type: 'text' }, { name: 'dealValue', label: 'Deal Value', type: 'number' }, { name: 'stage', label: 'Stage', type: 'text' }] },
    { name: 'addNote', label: 'Add Note', description: 'Add a note to a contact, account, or deal.', inputs: [{ name: 'recordId', label: 'Record ID', type: 'text' }, { name: 'recordType', label: 'Record Type (contact, account, or deal)', type: 'text' }, { name: 'noteContent', label: 'Note Content', type: 'textarea' }] },
];

const emailActions = [
    { name: 'sendEmail', label: 'Send Email', description: 'Send an email to a recipient.', inputs: [{ name: 'to', label: 'To', type: 'text' }, { name: 'subject', label: 'Subject', type: 'text' }, { name: 'body', label: 'Body (HTML)', type: 'textarea' }] }
];

const smsActions = [
    { name: 'sendSms', label: 'Send SMS', description: 'Send a simple text message.', inputs: [{ name: 'to', label: 'To (Phone Number)', type: 'text' }, { name: 'message', label: 'Message', type: 'textarea' }] }
];

const urlShortenerActions = [
    { name: 'createShortLink', label: 'Create Short Link', description: 'Create a new trackable short link.', inputs: [{ name: 'longUrl', label: 'Original URL', type: 'text' }, { name: 'alias', label: 'Custom Alias (Optional)', type: 'text' }] }
];

const qrCodeMakerActions = [
    { name: 'generateQrCode', label: 'Generate QR Code', description: 'Generate a QR code from text or a URL.', inputs: [{ name: 'data', label: 'Data to Encode', type: 'text' }, { name: 'name', label: 'QR Code Name', type: 'text' }] }
];

const apiActions = [
    {
        name: 'apiRequest',
        label: 'API Request',
        description: 'Make a GET, POST, PUT, or DELETE request to any API endpoint.',
        inputs: []
    }
];

const apiFileProcessorActions = [
    {
        name: 'grabFileFromApiStep',
        label: 'Grab File from API Step',
        description: 'Processes a direct file response from a previous API step and saves it.',
        inputs: [
            { name: 'sourceApiStepName', label: 'Source API Step', type: 'dynamic-selector', fetch: 'apiSteps', required: true, placeholder: 'Select an API step...' },
            { name: 'filename', label: 'Filename (with extension)', type: 'text', placeholder: 'e.g., invoice.pdf or image.png', required: true }
        ],
        outputs: [
            { name: 'fileUrl', description: 'The public URL of the saved file.' }
        ]
    }
];


const googleSheetsActions = [
    {
        name: 'updatedOrEditedRow',
        label: 'On Row Updated/Edited',
        description: 'Triggers when a row is added or modified in the selected sheet.',
        isTrigger: true,
        inputs: []
    },
    {
        name: 'addRow',
        label: 'Add Row',
        description: 'Adds a new row to a Google Sheet.',
        isTrigger: false,
        inputs: [
            { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: 'The ID from your sheet URL', required: true },
            { name: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'e.g. Sheet1', required: true },
            { name: 'rowData', label: 'Row Data (JSON Array)', type: 'textarea', placeholder: '["Value for A", "Value for B"]', required: true },
        ]
    }
];

const arrayFunctionActions = [
    { name: 'getCount', label: 'Get Count', description: 'Get the number of items in an array.', inputs: [{ name: 'array', label: 'Array', type: 'textarea', placeholder: 'e.g., {{trigger.data.items}}' }], outputs: [{ name: 'count', description: 'The number of items in the array.' }] },
    { name: 'arrayReverse', label: 'Array Reverse', description: 'Reverse the order of items in an array.', inputs: [{ name: 'array', label: 'Array', type: 'textarea', placeholder: 'e.g., {{trigger.data.items}}' }], outputs: [{ name: 'reversedArray', description: 'The array in reverse order.' }] },
    { name: 'getValueByIndex', label: 'Get Value By Index', description: 'Retrieves a value at a specified index of an array.', inputs: [{ name: 'array', label: 'Array', type: 'textarea', placeholder: 'e.g., {{trigger.data.items}}' }, { name: 'index', label: 'Index', type: 'number', placeholder: '0' }], outputs: [{ name: 'value', description: 'The value at the specified index.' }] },
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
  { appId: 'api_file_processor', name: 'API File Processor', icon: FileUp, actions: apiFileProcessorActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-api_file_processor-icon' },
  { appId: 'array_function', name: 'Array Function', icon: Combine, actions: arrayFunctionActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-array_function-icon' },
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
    actions: googleSheetsActions,
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
