
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
} from 'lucide-react';
import { WhatsAppIcon, MetaIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

import { googleSheetsActions } from './actions/google-sheets';
import { wachatActions } from './actions/wachat';
import { apiActions } from './actions/api';

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
      actions: [
          {
              name: 'sendMessage',
              label: 'Send Message',
              description: 'Sends a message to a visitor in an active chat session.',
              inputs: [
                  { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
                  { name: 'content', label: 'Message Text', type: 'textarea', required: true },
              ]
          },
          {
              name: 'closeSession',
              label: 'Close Session',
              description: 'Closes a live chat session.',
              inputs: [
                   { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
              ]
          },
          {
              name: 'addTagToSession',
              label: 'Add Tag to Session',
              description: 'Adds a descriptive tag to a chat session for categorization.',
              inputs: [
                   { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
                   { name: 'tagName', label: 'Tag Name', type: 'text', required: true },
              ]
          },
          {
              name: 'getOrCreateSession',
              label: 'Get or Create Session',
              description: "Finds an existing visitor's session by email or creates a new one.",
              inputs: [
                   { name: 'email', label: 'Visitor Email', type: 'email', required: true, placeholder: '{{trigger.email}}' },
                   { name: 'name', label: 'Visitor Name (Optional)', type: 'text', placeholder: '{{trigger.name}}' },
              ]
          },
          {
              name: 'getSessionDetails',
              label: 'Get Session Details',
              description: "Retrieves the full details of a session, including its status and visitor info.",
              inputs: [
                  { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
              ]
          },
          {
              name: 'updateVisitorInfo',
              label: 'Update Visitor Info',
              description: 'Adds or updates information about the visitor in a chat session.',
              inputs: [
                  { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
                  { name: 'name', label: 'Visitor Name', type: 'text', required: false },
                  { name: 'email', label: 'Visitor Email', type: 'email', required: false },
                  { name: 'phone', label: 'Visitor Phone', type: 'tel', required: false },
              ]
          },
           {
              name: 'assignAgent',
              label: 'Assign Agent',
              description: 'Assigns a team member to a chat session.',
              inputs: [
                   { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
                   { name: 'agentId', label: 'Agent', type: 'dynamic-selector', fetch: 'agents', required: true, placeholder: 'Select or enter Agent ID...' },
              ]
          },
           {
              name: 'getChatHistory',
              label: 'Get Chat History',
              description: 'Retrieves the message history for a specific session.',
              inputs: [
                  { name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions', required: true, placeholder: 'Select or enter Session ID...' },
              ]
          }
      ],
      connectionType: 'internal',
      iconColor: 'text-sabflow-sabchat-icon',
    },
    {
      appId: 'meta',
      name: 'Meta Suite',
      icon: MetaIcon,
      actions: [],
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
      actions: [
        {
            name: 'createCrmLead',
            label: 'Create Lead/Deal',
            description: 'Creates a new contact and an associated deal in the CRM.',
            inputs: [
                { name: 'title', label: 'Deal Name', type: 'text', placeholder: 'e.g. New Website for {{trigger.company}}', required: true },
                { name: 'value', label: 'Deal Value', type: 'number', placeholder: 'e.g. 5000' },
                { name: 'stage', label: 'Deal Stage', type: 'text', placeholder: 'e.g., New' },
                { name: 'contactName', label: 'Contact Name', type: 'text', placeholder: 'e.g., {{trigger.name}}', required: true },
                { name: 'email', label: 'Contact Email', type: 'email', placeholder: 'e.g., {{trigger.email}}', required: true },
                { name: 'phone', label: 'Contact Phone', type: 'tel', placeholder: 'e.g., {{trigger.phone}}' },
                { name: 'company', label: 'Company Name', type: 'text', placeholder: 'e.g., {{trigger.company}}' },
                { name: 'source', label: 'Lead Source', type: 'text', placeholder: 'e.g., Webhook' },
            ]
        }
      ],
      connectionType: 'internal',
      iconColor: 'text-sabflow-crm-icon',
    },
    {
      appId: 'email',
      name: 'Email Suite',
      icon: Mail,
      actions: [
          {
            name: 'sendEmail',
            label: 'Send Email',
            description: 'Sends an email to a recipient.',
            inputs: [
                { name: 'to', label: 'To Email', type: 'email', required: true },
                { name: 'subject', label: 'Subject', type: 'text', required: true },
                { name: 'body', label: 'Body (HTML)', type: 'textarea', required: true },
            ]
          }
      ],
      connectionType: 'internal',
      iconColor: 'text-sabflow-email-icon',
    },
    {
      appId: 'sms',
      name: 'SMS Suite',
      icon: MessageSquare,
      actions: [
          {
            name: 'sendSms',
            label: 'Send SMS',
            description: 'Sends an SMS to a phone number.',
            inputs: [
                 { name: 'to', label: 'Recipient Phone', type: 'tel', required: true },
                 { name: 'message', label: 'Message', type: 'textarea', required: true },
            ]
          }
      ],
      connectionType: 'internal',
      iconColor: 'text-sabflow-sms-icon',
    },
    { 
        appId: 'url-shortener', 
        name: 'URL Shortener', 
        icon: LinkIcon, 
        actions: [
            {
                name: 'createShortLink',
                label: 'Create Short Link',
                description: 'Creates a new short URL.',
                inputs: [
                    { name: 'longUrl', label: 'Original URL', type: 'text', required: true },
                    { name: 'alias', label: 'Custom Alias (Optional)', type: 'text' },
                    { name: 'saveAsVariable', label: 'Save Link to Variable', type: 'text' },
                ]
            }
        ], 
        connectionType: 'internal', 
        iconColor: 'text-sabflow-url-shortener-icon' 
    },
    { 
        appId: 'qr-code-maker', 
        name: 'QR Code Maker', 
        icon: QrCode, 
        actions: [
            {
                name: 'generateQrCode',
                label: 'Generate QR Code',
                description: 'Generates a QR Code for the given data and saves the image URL to a variable.',
                inputs: [
                     { name: 'data', label: 'Data to Encode', type: 'text', required: true },
                     { name: 'name', label: 'QR Code Name', type: 'text', required: true },
                     { name: 'saveAsVariable', label: 'Save Image URL to Variable', type: 'text', required: true },
                ]
            }
        ], 
        connectionType: 'internal', 
        iconColor: 'text-sabflow-qr-code-maker-icon' 
    },
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
