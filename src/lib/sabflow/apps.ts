
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
  ListFilter
} from 'lucide-react';
import { WhatsAppIcon, MetaIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

import { googleSheetsActions } from './actions/google-sheets';
import { wachatActions } from './actions/wachat';
import { apiActions } from './actions/api';
import { sabChatActions } from './actions/sabchat';
import { crmActions } from './actions/crm';
import { smsActions } from './actions/sms';
import { emailActions } from './actions/email';
import { urlShortenerActions } from './actions/url-shortener';
import { qrCodeMakerActions } from './actions/qr-code';

export const metaActions = [
    // Content Management
    { name: 'createPost', label: 'Create Post', description: 'Publishes a new post to your Facebook Page.', icon: Pencil, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
        { name: 'imageUrl', label: 'Image URL (Optional)', type: 'text' },
    ]},
    { name: 'updatePost', label: 'Update Post', description: 'Updates the text message of an existing post.', icon: Pencil, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'postId', label: 'Post ID', type: 'text', required: true },
        { name: 'message', label: 'New Message', type: 'textarea', required: true },
    ]},
    { name: 'deletePost', label: 'Delete Post', description: 'Permanently deletes a post.', icon: TrashIcon, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'postId', label: 'Post ID', type: 'text', required: true },
    ]},
    
    // Engagement & Moderation
     { name: 'getComments', label: 'Get Post Comments', description: 'Retrieves comments for a specific post.', icon: MessageSquare, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post ID', type: 'text', required: true },
    ]},
    { name: 'postComment', label: 'Reply to Post/Comment', description: 'Posts a new comment or replies to an existing one.', icon: MessageCircle, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true },
        { name: 'message', label: 'Comment Text', type: 'textarea', required: true },
    ]},
    { name: 'likeObject', label: 'Like Post or Comment', description: 'Likes a specific post or comment.', icon: ThumbsUp, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true },
    ]},
    { name: 'deleteComment', label: 'Delete Comment', description: 'Permanently deletes a comment.', icon: TrashIcon, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'commentId', label: 'Comment ID', type: 'text', required: true },
    ]},

    // Data Retrieval
    { name: 'getPagePosts', label: 'Get Page Posts', description: 'Retrieves a list of recent posts from the page.', icon: Newspaper, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},
     { name: 'getPageInsights', label: 'Get Page Insights', description: 'Retrieves performance metrics for the page.', icon: Megaphone, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},

    // Messenger Actions
    { name: 'sendMessengerMessage', label: 'Send Messenger Message', description: 'Send a text message to a user.', icon: MessageSquare, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'recipientId', label: 'Recipient ID (PSID)', type: 'text', required: true },
        { name: 'messageText', label: 'Message Text', type: 'textarea', required: true },
    ]},
    { name: 'getPageConversations', label: 'Get Page Conversations', description: 'Retrieves a list of recent Messenger conversations.', icon: Inbox, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},
    { name: 'getConversationMessages', label: 'Get Conversation Messages', description: 'Fetches the message history for a specific conversation.', icon: HistoryIcon, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'conversationId', label: 'Conversation ID', type: 'text', required: true },
    ]},

    // Live Video Actions
    { name: 'scheduleLiveVideo', label: 'Schedule Live Video Premiere', description: 'Schedule a pre-recorded video to go live.', icon: Calendar, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'title', label: 'Video Title', type: 'text', required: true },
        { name: 'scheduledDate', label: 'Scheduled Date (YYYY-MM-DD)', type: 'text', required: true },
        { name: 'scheduledTime', label: 'Scheduled Time (HH:MM)', type: 'text', required: true },
        { name: 'videoUrl', label: 'Video File URL', type: 'text', required: true, placeholder: 'A public URL to an MP4 or MOV file.' },
    ]},
    { name: 'getScheduledLiveVideos', label: 'Get Scheduled Live Videos', description: 'Retrieves a list of scheduled and past live streams.', icon: ListFilter, inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},
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
    actions: googleSheetsActions
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
