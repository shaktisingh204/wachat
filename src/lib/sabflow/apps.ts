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
      bgColor: 'sabflow-bg-wachat',
    },
    {
      appId: 'sabchat',
      name: 'sabChat',
      icon: SabChatIcon,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-sabchat-icon',
      bgColor: 'sabflow-bg-sabchat',
    },
    {
      appId: 'meta',
      name: 'Meta Suite',
      icon: MetaIcon,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-meta-icon',
      bgColor: 'sabflow-bg-meta',
    },
    {
      appId: 'instagram',
      name: 'Instagram Suite',
      icon: InstagramIcon,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-instagram-icon',
      bgColor: 'sabflow-bg-instagram',
    },
    {
      appId: 'crm',
      name: 'CRM Suite',
      icon: Handshake,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-crm-icon',
      bgColor: 'sabflow-bg-crm',
    },
    {
      appId: 'email',
      name: 'Email Suite',
      icon: Mail,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-email-icon',
      bgColor: 'sabflow-bg-email',
    },
    {
      appId: 'sms',
      name: 'SMS Suite',
      icon: MessageSquare,
      actions: [],
      connectionType: 'internal',
      iconColor: 'text-sabflow-sms-icon',
      bgColor: 'sabflow-bg-sms',
    },
    { appId: 'url-shortener', name: 'URL Shortener', icon: LinkIcon, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-url-shortener-icon', bgColor: 'sabflow-bg-url-shortener' },
    { appId: 'qr-code-maker', name: 'QR Code Maker', icon: QrCode, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-qr-code-maker-icon', bgColor: 'sabflow-bg-qr-code-maker' },
    { appId: 'seo-suite', name: 'SEO Suite', icon: SeoIcon, actions: [], connectionType: 'internal', iconColor: 'text-sabflow-seo-suite-icon', bgColor: 'sabflow-bg-seo-suite' },

  // Core Apps
  { appId: 'api', name: 'API', icon: Server, actions: [], category: 'Core Apps', connectionType: 'apikey', iconColor: 'text-sabflow-api-icon', bgColor: 'sabflow-bg-api' },
  { appId: 'array_function', name: 'Array Function', icon: Combine, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-array_function-icon', bgColor: 'sabflow-bg-array_function' },
  { appId: 'code', name: 'Code', icon: Code2, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-code-icon', bgColor: 'sabflow-bg-code' },
  { appId: 'data_forwarder', name: 'Data Forwarder', icon: Forward, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_forwarder-icon', bgColor: 'sabflow-bg-data_forwarder' },
  { appId: 'data_transformer', name: 'Data Transformer', icon: Replace, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_transformer-icon', bgColor: 'sabflow-bg-data_transformer' },
  { appId: 'datetime_formatter', name: 'DateTime Formatter', icon: Calendar, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-datetime_formatter-icon', bgColor: 'sabflow-bg-datetime_formatter' },
  { appId: 'delay', name: 'Delay', icon: Timer, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-delay-icon', bgColor: 'sabflow-bg-delay' },
  { appId: 'dynamic_web_page', name: 'Dynamic Web Page', icon: Globe2, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-dynamic_web_page-icon', bgColor: 'sabflow-bg-dynamic_web_page' },
  { appId: 'file_uploader', name: 'File Uploader', icon: FileUp, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-file_uploader-icon', bgColor: 'sabflow-bg-file_uploader' },
  { appId: 'filter', name: 'Filter', icon: Filter, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-filter-icon', bgColor: 'sabflow-bg-filter' },
  { appId: 'iterator', name: 'Iterator', icon: IterationCcw, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-iterator-icon', bgColor: 'sabflow-bg-iterator' },
  { appId: 'json_extractor', name: 'JSON Extractor', icon: Braces, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-json_extractor-icon', bgColor: 'sabflow-bg-json_extractor' },
  { appId: 'lookup_table', name: 'Lookup Table', icon: Table, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-lookup_table-icon', bgColor: 'sabflow-bg-lookup_table' },
  { appId: 'number_formatter', name: 'Number Formatter', icon: Sigma, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-number_formatter-icon', bgColor: 'sabflow-bg-number_formatter' },
  { appId: 'connect_manager', name: 'Connect Manager', icon: Cable, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-connect_manager-icon', bgColor: 'sabflow-bg-connect_manager' },
  { appId: 'hook', name: 'Hook', icon: Webhook, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-hook-icon', bgColor: 'sabflow-bg-hook' },
  { appId: 'subscription_billing', name: 'Subscription Billing', icon: Repeat, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-subscription_billing-icon', bgColor: 'sabflow-bg-subscription_billing' },
  { appId: 'router', name: 'Router', icon: Route, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-router-icon', bgColor: 'sabflow-bg-router' },
  { appId: 'select_transform_json', name: 'Select Transform JSON', icon: Columns, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-select_transform_json-icon', bgColor: 'sabflow-bg-select_transform_json' },
  { appId: 'text_formatter', name: 'Text Formatter', icon: CaseSensitive, actions: [], category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-text_formatter-icon', bgColor: 'sabflow-bg-text_formatter' },

  // External Apps
  {
    appId: 'google_sheets',
    name: 'Google Sheets',
    category: 'Productivity',
    logo: 'https://picsum.photos/seed/gsheets/40/40',
    connectionType: 'webhook',
    description: "Connect Google Sheets by sending data to your flow's webhook URL from an Apps Script trigger.",
    iconColor: 'text-sabflow-google_sheets-icon',
    bgColor: 'sabflow-bg-google_sheets',
    actions: googleSheetsActions
  },
  { 
    appId: 'stripe',
    name: 'Stripe',
    category: 'Payment',
    logo: 'https://picsum.photos/seed/stripe/40/40',
    connectionType: 'apikey',
    credentials: [
        { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
    iconColor: 'text-sabflow-stripe-icon',
    bgColor: 'sabflow-bg-stripe',
    actions: []
  },
  { 
    appId: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    logo: 'https://picsum.photos/seed/shopify/40/40',
    connectionType: 'apikey',
    credentials: [
        { name: 'shopName', label: 'Shop Name', type: 'text', placeholder: 'your-store' },
        { name: 'accessToken', label: 'Admin API Access Token', type: 'password' },
    ],
    iconColor: 'text-sabflow-shopify-icon',
    bgColor: 'sabflow-bg-shopify',
    actions: []
  },
  {
    appId: 'slack',
    name: 'Slack',
    category: 'Communication',
    logo: 'https://picsum.photos/seed/slack/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-slack-icon',
    bgColor: 'sabflow-bg-slack',
    actions: []
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    category: 'Email',
    logo: 'https://picsum.photos/seed/gmail/40/40',
    connectionType: 'oauth',
    color: 'bg-gradient-to-br from-red-500 to-red-600',
    actions: []
  },
  { 
    appId: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    logo: 'https://picsum.photos/seed/hubspot/40/40',
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
    logo: 'https://picsum.photos/seed/discord/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-discord-icon',
    bgColor: 'sabflow-bg-discord',
    actions: []
  },
  {
    appId: 'notion',
    name: 'Notion',
    category: 'Productivity',
    logo: 'https://picsum.photos/seed/notion/40/40',
    connectionType: 'oauth',
    iconColor: 'text-sabflow-notion-icon',
    bgColor: 'sabflow-bg-notion',
    actions: []
  }
];
