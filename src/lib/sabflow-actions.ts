

import {
  MessageSquare,
  Send,
  UserPlus,
  Tag,
  AtSign,
  Briefcase,
  GitFork,
  FileText,
  ImageIcon,
  Video,
  File,
  Headphones,
  Sticker,
  MapPin,
  Contact,
  ClipboardList,
  List,
  ShoppingCart,
  ShoppingBag,
} from 'lucide-react';
import { WhatsAppIcon, CrmIcon, EmailIcon, SmsIcon } from '@/components/wabasimplify/custom-sidebar-components';

export const sabnodeAppActions = [
  {
    appId: 'wachat',
    name: 'Wachat',
    icon: WhatsAppIcon,
    actions: [
      {
        name: 'send_text',
        label: 'Send Text Message',
        description: 'Send a simple text message to a contact.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text', placeholder: 'e.g., 919876543210 or {{contact.phone}}' },
          { name: 'message', label: 'Message Body', type: 'textarea', placeholder: 'Hello, {{contact.name}}!' },
        ],
      },
      {
        name: 'send_image',
        label: 'Send Image Message',
        description: 'Send an image with an optional caption.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text', placeholder: 'e.g., 919876543210' },
          { name: 'imageUrl', label: 'Image URL', type: 'text', placeholder: 'https://example.com/image.png' },
          { name: 'caption', label: 'Caption (Optional)', type: 'textarea' },
        ],
      },
      {
        name: 'send_video',
        label: 'Send Video Message',
        description: 'Send a video with an optional caption.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'videoUrl', label: 'Video URL', type: 'text', placeholder: 'https://example.com/video.mp4' },
          { name: 'caption', label: 'Caption (Optional)', type: 'textarea' },
        ],
      },
      {
        name: 'send_document',
        label: 'Send Document',
        description: 'Send a document like a PDF.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'documentUrl', label: 'Document URL', type: 'text', placeholder: 'https://example.com/file.pdf' },
          { name: 'filename', label: 'Filename (Optional)', type: 'text', placeholder: 'e.g., invoice.pdf' },
          { name: 'caption', label: 'Caption (Optional)', type: 'textarea' },
        ],
      },
       {
        name: 'send_audio',
        label: 'Send Audio Message',
        description: 'Send an audio file.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'audioUrl', label: 'Audio URL', type: 'text', placeholder: 'https://example.com/audio.mp3' },
        ],
      },
      {
        name: 'send_sticker',
        label: 'Send Sticker',
        description: 'Send a sticker from a URL.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'stickerUrl', label: 'Sticker URL (.webp)', type: 'text', placeholder: 'https://example.com/sticker.webp' },
        ],
      },
      {
        name: 'send_location',
        label: 'Send Location',
        description: 'Send a map location.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'latitude', label: 'Latitude', type: 'text', placeholder: 'e.g., 26.8955' },
          { name: 'longitude', label: 'Longitude', type: 'text', placeholder: 'e.g., 75.8234' },
          { name: 'name', label: 'Location Name', type: 'text', placeholder: 'SabNode HQ' },
          { name: 'address', label: 'Address', type: 'text', placeholder: 'Jaipur, Rajasthan' },
        ],
      },
      {
        name: 'send_contact',
        label: 'Send Contact Card',
        description: 'Send a contact card (vCard).',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'contactName', label: 'Contact Name', type: 'text', placeholder: 'John Doe' },
          { name: 'contactPhone', label: 'Contact Phone', type: 'text', placeholder: '919999988888' },
        ],
      },
      {
        name: 'send_template',
        label: 'Send Template Message',
        description: 'Send a pre-approved WhatsApp message template.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'templateName', label: 'Template Name', type: 'text', placeholder: 'e.g., order_confirmation' },
          { name: 'languageCode', label: 'Language Code', type: 'text', placeholder: 'e.g., en_US' },
          { name: 'variables', label: 'Body Variables (JSON array)', type: 'textarea', placeholder: '["John", "Order #123"]' },
        ],
      },
       {
        name: 'send_interactive_buttons',
        label: 'Send Interactive Buttons',
        description: 'Send a message with up to 3 quick reply buttons.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'bodyText', label: 'Message Body', type: 'textarea' },
          { name: 'buttons', label: 'Buttons (JSON Array)', type: 'textarea', placeholder: '[{"title": "Yes"}, {"title": "No"}]' },
          { name: 'headerText', label: 'Header Text (Optional)', type: 'text' },
          { name: 'footerText', label: 'Footer Text (Optional)', type: 'text' },
        ],
      },
      {
        name: 'send_interactive_list',
        label: 'Send Interactive List Message',
        description: 'Send a message with a list of options.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'buttonText', label: 'Menu Button Text', type: 'text', placeholder: 'Choose an option' },
          { name: 'bodyText', label: 'Message Body', type: 'textarea' },
          { name: 'sections', label: 'List Sections (JSON)', type: 'textarea', placeholder: '[{"title": "Category 1", "rows": [{"id": "1", "title": "Item 1"}]}]' },
        ],
      },
      {
        name: 'send_single_product',
        label: 'Send Single Product Message',
        description: 'Send a single product from your catalog.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'catalogId', label: 'Catalog ID', type: 'text' },
          { name: 'productRetailerId', label: 'Product SKU / Retailer ID', type: 'text' },
          { name: 'bodyText', label: 'Message Body', type: 'textarea' },
          { name: 'footerText', label: 'Footer Text (Optional)', type: 'text' },
        ],
      },
      {
        name: 'send_multi_product',
        label: 'Send Multi-Product Message',
        description: 'Send a message with multiple products from your catalog.',
        inputs: [
          { name: 'recipient', label: 'Recipient Phone Number', type: 'text' },
          { name: 'catalogId', label: 'Catalog ID', type: 'text' },
          { name: 'headerText', label: 'Header Text', type: 'text' },
          { name: 'bodyText', label: 'Message Body', type: 'textarea' },
          { name: 'sections', label: 'Product Sections (JSON)', type: 'textarea', placeholder: '[{"title": "Featured", "product_items": [{"product_retailer_id": "SKU1"}]}]' },
        ],
      },
      {
        name: 'update_contact',
        label: 'Add/Update Contact',
        description: 'Create a new contact or update an existing one.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
          { name: 'name', label: 'Full Name', type: 'text' },
          { name: 'email', label: 'Email (Optional)', type: 'email' },
        ],
      },
      {
        name: 'add_tag',
        label: 'Add Tag to Contact',
        description: 'Add a tag to a contact.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
          { name: 'tagName', label: 'Tag Name', type: 'text' },
        ],
      },
      {
        name: 'remove_tag',
        label: 'Remove Tag from Contact',
        description: 'Remove a tag from a contact.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
          { name: 'tagName', label: 'Tag Name', type: 'text' },
        ],
      },
      {
        name: 'update_attribute',
        label: 'Update Contact Attribute',
        description: 'Set a value for a custom attribute on a contact.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
          { name: 'attributeName', label: 'Attribute Name', type: 'text' },
          { name: 'attributeValue', label: 'Attribute Value', type: 'text' },
        ],
      },
      {
        name: 'start_broadcast',
        label: 'Start a Broadcast',
        description: 'Initiate a broadcast campaign.',
        inputs: [
          { name: 'templateId', label: 'Template ID', type: 'text' },
          { name: 'tagIds', label: 'Contact Tag IDs (comma-separated)', type: 'text' },
        ],
      },
      {
        name: 'trigger_flow',
        label: 'Trigger Another Flow',
        description: 'Start another flow for the current contact.',
        inputs: [
          { name: 'flowId', label: 'Flow ID', type: 'text' },
        ],
      },
      {
        name: 'assign_agent',
        label: 'Assign to Agent',
        description: 'Assign the conversation to a specific agent.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
          { name: 'agentEmail', label: 'Agent Email', type: 'email' },
        ],
      },
      {
        name: 'resolve_conversation',
        label: 'Resolve Conversation',
        description: 'Mark the conversation with a contact as resolved.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
        ],
      },
       {
        name: 'create_template',
        label: 'Create Message Template',
        description: 'Create a new template for submission.',
        inputs: [
          { name: 'templateName', label: 'Template Name', type: 'text' },
          { name: 'category', label: 'Category', type: 'select', options: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] },
          { name: 'language', label: 'Language Code', type: 'text' },
          { name: 'body', label: 'Body Text', type: 'textarea' },
          { name: 'headerText', label: 'Header Text (Optional)', type: 'text' },
        ],
      },
       {
        name: 'opt_out_contact',
        label: 'Opt-Out Contact',
        description: 'Mark a contact as opted-out from receiving messages.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
        ],
      },
       {
        name: 'opt_in_contact',
        label: 'Opt-In Contact',
        description: 'Mark a contact as opted-in to receive messages.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
        ],
      },
      {
        name: 'get_contact_details',
        label: 'Get Contact Details',
        description: 'Retrieve details for a contact.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
        ],
      },
      {
        name: 'get_flow_status',
        label: 'Get Flow Status',
        description: 'Check the status of a contact\'s active flow.',
        inputs: [
          { name: 'phone', label: 'Phone Number', type: 'text' },
        ],
      },
    ],
  },
  {
    appId: 'crm',
    name: 'CRM Suite',
    icon: CrmIcon,
    actions: [
      {
        name: 'create_lead',
        label: 'Create Lead',
        description: 'Create a new lead in the CRM.',
        inputs: [
          { name: 'name', label: 'Lead Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', type: 'tel' },
        ],
      },
      {
        name: 'create_deal',
        label: 'Create Deal',
        description: 'Create a new deal associated with a contact or account.',
        inputs: [
          { name: 'dealName', label: 'Deal Name', type: 'text' },
          { name: 'value', label: 'Value', type: 'number' },
          { name: 'stage', label: 'Initial Stage', type: 'text' },
          { name: 'contactEmail', label: 'Contact Email', type: 'email' },
        ],
      },
    ],
  },
  {
    appId: 'email',
    name: 'Email Suite',
    icon: EmailIcon,
    actions: [
      {
        name: 'send_email',
        label: 'Send Email',
        description: 'Send an email to a recipient.',
        inputs: [
          { name: 'to', label: 'Recipient Email', type: 'email' },
          { name: 'subject', label: 'Subject', type: 'text' },
          { name: 'body', label: 'Body (HTML)', type: 'textarea' },
        ],
      },
    ],
  },
  {
    appId: 'sms',
    name: 'SMS Suite',
    icon: SmsIcon,
    actions: [
      {
        name: 'send_sms',
        label: 'Send SMS',
        description: 'Send an SMS message.',
        inputs: [
          { name: 'to', label: 'Recipient Phone Number', type: 'tel' },
          { name: 'message', label: 'Message', type: 'textarea' },
        ],
      },
    ],
  }
];
