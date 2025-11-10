
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
  Route,
  Columns,
  Calendar,
  CaseSensitive,
  Link as LinkIcon,
  QrCode,
  Handshake,
  Repeat
} from 'lucide-react';
import { WhatsAppIcon, MetaIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

import { googleSheetsActions } from './actions/google-sheets';
import { wachatActions } from './actions/wachat';

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
      actions: [],
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
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-crm-icon',
    },
    {
      appId: 'email',
      name: 'Email Suite',
      icon: Mail,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-email-icon',
    },
    {
      appId: 'sms',
      name: 'SMS Suite',
      icon: MessageSquare,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-sms-icon',
    },
    { appId: 'url-shortener', name: 'URL Shortener', icon: LinkIcon, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-url-shortener-icon' },
    { appId: 'qr-code-maker', name: 'QR Code Maker', icon: QrCode, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-qr-code-maker-icon' },
    { appId: 'seo-suite', name: 'SEO Suite', icon: SeoIcon, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-seo-suite-icon' },

  // Core Apps
  { appId: 'api', name: 'API', icon: Server, actions: [], category: 'Core Apps', connectionType: 'apikey', iconColor: 'text-sabflow-api-icon' },
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
    logo: 'https://picsum.photos/seed/gsheets/40/40',
    connectionType: 'webhook',
    description: "Connect Google Sheets by sending data to your flow's webhook URL from an Apps Script trigger.",
    iconColor: 'text-sabflow-google-sheets-icon',
    actions: googleSheetsActions
  },
  { 
    appId: 'stripe',
    name: 'Stripe',
    category: 'Payment',
    description: "Connect your Stripe account to create customers, manage subscriptions, and process payments.",
    logo: 'https://picsum.photos/seed/stripe/40/40',
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
    logo: 'https://picsum.photos/seed/shopify/40/40',
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
    logo: 'https://picsum.photos/seed/slack/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-slack-icon',
    actions: []
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    category: 'Email',
    description: "Connect your Gmail account to send and receive emails.",
    logo: 'https://picsum.photos/seed/gmail/40/40',
    connectionType: 'oauth',
    actions: []
  },
  { 
    appId: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: "Connect your HubSpot account to sync contacts, deals, and companies.",
    logo: 'https://picsum.photos/seed/hubspot/40/40',
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
    logo: 'https://picsum.photos/seed/discord/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-discord-icon',
    actions: []
  },
  {
    appId: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: "Connect your Notion workspace to create pages and database entries.",
    logo: 'https://picsum.photos/seed/notion/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-notion-icon',
    actions: []
  }
];
