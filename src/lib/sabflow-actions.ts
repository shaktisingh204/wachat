
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
  History,
  Sticker,
  MapPin,
  Contact,
  ClipboardList,
  List,
  ShoppingCart,
  ShoppingBag,
  LayoutDashboard,
  Megaphone,
  Wrench,
  Users,
  BarChart2,
  Newspaper,
  Calendar,
  ThumbsUp,
  Share2,
  Bot,
  Compass,
  Search,
  Clapperboard,
  ShieldCheck,
  Key,
  BookCopy,
  Rss,
  ChevronsUpDown,
  TrendingUp,
  PanelLeft,
  Sparkles,
  ChevronRight,
  Database,
  User as UserIcon,
  Eye,
  Link as LinkIcon,
  QrCode,
  Users2,
  UserMinus,
  UserCheck,
  Star,
  Pencil,
  LogOut,
  Inbox,
  LifeBuoy,
  HelpCircle,
} from 'lucide-react';
import { WhatsAppIcon, CrmIcon, EmailIcon, SmsIcon, MetaIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';

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
      {
        name: 'mark_as_read',
        label: 'Mark Message as Read',
        description: 'Mark a specific message as read.',
        inputs: [
          { name: 'messageId', label: 'Message ID (Wamid)', type: 'text' },
        ],
      },
      {
        name: 'create_group',
        label: 'Create Group',
        description: 'Create a new WhatsApp group.',
        inputs: [
          { name: 'subject', label: 'Group Subject', type: 'text' },
        ],
      },
      {
        name: 'update_group_subject',
        label: 'Update Group Subject',
        description: 'Change the subject of a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'newSubject', label: 'New Subject', type: 'text' },
        ],
      },
      {
        name: 'update_group_description',
        label: 'Update Group Description',
        description: 'Change the description of a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'newDescription', label: 'New Description', type: 'textarea' },
        ],
      },
      {
        name: 'add_group_participant',
        label: 'Add Group Participant',
        description: 'Add a contact to a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'phone', label: 'Participant Phone Number', type: 'text' },
        ],
      },
      {
        name: 'remove_group_participant',
        label: 'Remove Group Participant',
        description: 'Remove a participant from a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'phone', label: 'Participant Phone Number', type: 'text' },
        ],
      },
      {
        name: 'promote_to_admin',
        label: 'Promote to Group Admin',
        description: 'Make a group participant an admin.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'phone', label: 'Participant Phone Number', type: 'text' },
        ],
      },
      {
        name: 'demote_admin',
        label: 'Demote Group Admin',
        description: 'Remove admin privileges from a participant.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'phone', label: 'Participant Phone Number', type: 'text' },
        ],
      },
      {
        name: 'get_group_info',
        label: 'Get Group Info',
        description: 'Retrieve subject and participants of a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
        ],
      },
      {
        name: 'send_group_message',
        label: 'Send Group Message',
        description: 'Send a text message to a group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
          { name: 'message', label: 'Message Text', type: 'textarea' },
        ],
      },
      {
        name: 'leave_group',
        label: 'Leave Group',
        description: 'Leave a WhatsApp group.',
        inputs: [
          { name: 'groupId', label: 'Group ID', type: 'text' },
        ],
      }
    ],
  },
  {
    appId: 'sabchat',
    name: 'sabChat',
    icon: SabChatIcon,
    actions: [
      { name: 'send_message', label: 'Send Live Chat Message', icon: MessageSquare, description: 'Send a message to a visitor in an active chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'content', label: 'Message Content', type: 'textarea' }] },
      { name: 'close_session', label: 'Close Chat Session', icon: MessageSquare, description: 'Mark a live chat session as closed.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'get_visitor_details', label: 'Get Visitor Details', icon: UserIcon, description: 'Retrieve information about a visitor.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'update_visitor_details', label: 'Update Visitor Details', icon: Pencil, description: 'Update the name or email of a visitor.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'name', label: 'Name (Optional)', type: 'text' }, { name: 'email', label: 'Email (Optional)', type: 'email' }] },
      { name: 'assign_agent', label: 'Assign Chat to Agent', icon: UserCheck, description: 'Assign a chat session to a specific team member.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'agentId', label: 'Agent ID', type: 'text' }] },
      { name: 'add_tag_to_session', label: 'Add Tag to Session', icon: Tag, description: 'Add a tag to a chat session for categorization.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'tagName', label: 'Tag Name', type: 'text' }] },
      { name: 'remove_tag_from_session', label: 'Remove Tag from Session', icon: Tag, description: 'Remove a tag from a chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'tagName', label: 'Tag Name', type: 'text' }] },
      { name: 'send_quick_reply', label: 'Send Quick Reply', icon: LifeBuoy, description: 'Send a pre-defined quick reply.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'shortcut', label: 'Shortcut', type: 'text', placeholder: 'e.g. /welcome' }] },
      { name: 'send_faq', label: 'Send FAQ Answer', icon: HelpCircle, description: 'Send an answer from your FAQ knowledge base.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'faqId', label: 'FAQ ID', type: 'text' }] },
      { name: 'block_visitor', label: 'Block Visitor', icon: UserMinus, description: 'Block a visitor from starting new chat sessions.', inputs: [{ name: 'visitorId', label: 'Visitor ID', type: 'text' }] },
      { name: 'unblock_visitor', label: 'Unblock Visitor', icon: UserCheck, description: 'Unblock a previously blocked visitor.', inputs: [{ name: 'visitorId', label: 'Visitor ID', type: 'text' }] },
      { name: 'request_chat_rating', label: 'Request Chat Rating', icon: Star, description: 'Ask the visitor to rate their chat experience.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'add_private_note', label: 'Add Private Note', icon: FileText, description: 'Add a note to the chat history, visible only to agents.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'note', label: 'Note Content', type: 'textarea' }] },
      { name: 'get_chat_history', label: 'Get Chat History', icon: History, description: 'Retrieve the full message history for a session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'create_crm_contact', label: 'Create CRM Contact from Visitor', icon: UserPlus, description: 'Create a new contact in the CRM suite using the visitor\'s info.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'send_email_to_visitor', label: 'Send Email to Visitor', icon: Mail, description: 'Send an email to the visitor if their email is known.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }, { name: 'subject', label: 'Subject', type: 'text' }, { name: 'body', label: 'Email Body (HTML)', type: 'textarea' }] },
      { name: 'get_live_visitors', label: 'Get Live Visitors', icon: Users, description: 'Get a list of all currently active visitors on the site.', inputs: [] },
      { name: 'check_agent_online', label: 'Check if Agent is Online', icon: UserCheck, description: 'Check the online status of a specific agent.', inputs: [{ name: 'agentId', label: 'Agent ID', type: 'text' }] },
      { name: 'get_visitor_location', label: 'Get Visitor Location', icon: MapPin, description: 'Get the visitor\'s approximate location based on their IP.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'text' }] },
      { name: 'wait_for_message', label: 'Wait for Next Message', icon: Clock, description: 'Pause the flow until the visitor sends their next message.', inputs: [{ name: 'timeout', label: 'Timeout (seconds)', type: 'number', placeholder: '300' }] },
      { name: 'trigger_another_flow', label: 'Trigger Another Flow', icon: GitFork, description: 'Start another SabFlow workflow.', inputs: [{ name: 'flowId', label: 'Flow ID', type: 'text' }] }
    ]
  },
  {
    appId: 'meta',
    name: 'Meta Suite',
    icon: MetaIcon,
    actions: [
      { name: 'get_page_details', label: 'Get Page Details', icon: Wrench, description: 'Fetches details of the connected Facebook Page.', inputs: [] },
      { name: 'update_page_details', label: 'Update Page Details', icon: Pencil, description: 'Update the about section or contact info of your Page.', inputs: [{ name: 'about', label: 'About Text', type: 'textarea' }, { name: 'phone', label: 'Phone Number', type: 'tel' }] },
      { name: 'get_page_insights', label: 'Get Page Insights', icon: BarChart2, description: 'Retrieve performance metrics for your Page.', inputs: [{ name: 'period', label: 'Period', type: 'select', options: ['day', 'week', 'days_28'] }] },
      { name: 'create_text_post', label: 'Create Text Post', icon: Newspaper, description: 'Publish a simple text update to your Page feed.', inputs: [{ name: 'message', label: 'Message', type: 'textarea' }] },
      { name: 'create_photo_post', label: 'Create Photo Post', icon: Newspaper, description: 'Publish a photo to your Page feed.', inputs: [{ name: 'imageUrl', label: 'Image URL', type: 'text' }, { name: 'caption', label: 'Caption', type: 'textarea' }] },
      { name: 'create_video_post', label: 'Create Video Post', icon: Video, description: 'Publish a video to your Page feed.', inputs: [{ name: 'videoUrl', label: 'Video URL', type: 'text' }, { name: 'description', label: 'Description', type: 'textarea' }] },
      { name: 'update_post', label: 'Update Post', icon: Pencil, description: 'Edit the message of an existing post.', inputs: [{ name: 'postId', label: 'Post ID', type: 'text' }, { name: 'message', label: 'New Message', type: 'textarea' }] },
      { name: 'delete_post', label: 'Delete Post', icon: Trash2, description: 'Permanently delete a post from your Page.', inputs: [{ name: 'postId', label: 'Post ID', type: 'text' }] },
      { name: 'schedule_post', label: 'Schedule Post', icon: Calendar, description: 'Schedule a post to be published at a future time.', inputs: [{ name: 'message', label: 'Message', type: 'textarea' }, { name: 'publishTime', label: 'Publish Time (Unix Timestamp)', type: 'number' }] },
      { name: 'publish_scheduled_post', label: 'Publish Scheduled Post', icon: Send, description: 'Immediately publish a post that was previously scheduled.', inputs: [{ name: 'postId', label: 'Post ID', type: 'text' }] },
      { name: 'get_posts', label: 'Get Page Posts', icon: Newspaper, description: 'Retrieve a list of recent posts from your Page.', inputs: [{ name: 'limit', label: 'Limit', type: 'number', placeholder: '25' }] },
      { name: 'get_scheduled_posts', label: 'Get Scheduled Posts', icon: Calendar, description: 'Get a list of posts scheduled for future publication.', inputs: [] },
      { name: 'get_post_comments', label: 'Get Post Comments', icon: MessageSquare, description: 'Fetch all comments for a specific post.', inputs: [{ name: 'postId', label: 'Post ID', type: 'text' }] },
      { name: 'post_comment', label: 'Post a Comment', icon: MessageSquare, description: 'Post a comment or reply on a post.', inputs: [{ name: 'objectId', label: 'Post/Comment ID', type: 'text' }, { name: 'message', label: 'Comment Text', type: 'textarea' }] },
      { name: 'delete_comment', label: 'Delete a Comment', icon: Trash2, description: 'Delete a specific comment.', inputs: [{ name: 'commentId', label: 'Comment ID', type: 'text' }] },
      { name: 'like_object', label: 'Like Post/Comment', icon: ThumbsUp, description: 'Like a post or a comment.', inputs: [{ name: 'objectId', label: 'Post/Comment ID', type: 'text' }] },
      { name: 'send_messenger_message', label: 'Send Messenger Message', icon: MessageSquare, description: 'Send a private message to a user via Messenger.', inputs: [{ name: 'recipientPsid', label: 'Recipient PSID', type: 'text' }, { name: 'message', label: 'Message Text', type: 'textarea' }] },
      { name: 'create_ad_campaign', label: 'Create Ad Campaign', icon: Megaphone, description: 'Create a new ad campaign shell.', inputs: [{ name: 'name', label: 'Campaign Name', type: 'text' }, { name: 'objective', label: 'Objective', type: 'select', options: ['LINK_CLICKS', 'CONVERSIONS', 'POST_ENGAGEMENT', 'MESSAGES'] }] },
      { name: 'create_ad_set', label: 'Create Ad Set', icon: Megaphone, description: 'Create a new ad set within a campaign.', inputs: [{ name: 'campaignId', label: 'Campaign ID', type: 'text' }, { name: 'name', label: 'Ad Set Name', type: 'text' }, { name: 'dailyBudget', label: 'Daily Budget', type: 'number' }] },
      { name: 'create_ad_creative', label: 'Create Ad Creative', icon: Megaphone, description: 'Create a new ad creative (the visual part of the ad).', inputs: [{ name: 'name', label: 'Creative Name', type: 'text' }, { name: 'message', label: 'Ad Message', type: 'textarea' }, { name: 'link', label: 'Link URL', type: 'text' }] },
      { name: 'create_ad', label: 'Create Ad', icon: Megaphone, description: 'Create a new ad within an ad set.', inputs: [{ name: 'adSetId', label: 'Ad Set ID', type: 'text' }, { name: 'creativeId', label: 'Creative ID', type: 'text' }, { name: 'name', label: 'Ad Name', type: 'text' }] },
      { name: 'get_ad_campaigns', label: 'Get Ad Campaigns', icon: BarChart2, description: 'Retrieve a list of all ad campaigns.', inputs: [] },
      { name: 'get_custom_audiences', label: 'Get Custom Audiences', icon: Users, description: 'Fetch all custom audiences for the ad account.', inputs: [] },
      { name: 'get_conversations', label: 'Get Messenger Conversations', icon: MessageSquare, description: 'Retrieve a list of recent Messenger conversation threads.', inputs: [] },
      { name: 'get_conversation_messages', label: 'Get Conversation Messages', icon: MessageSquare, description: 'Get all messages from a specific Messenger conversation.', inputs: [{ name: 'conversationId', label: 'Conversation ID', type: 'text' }] },
      { name: 'mark_conversation_read', label: 'Mark Conversation as Read', icon: MessageSquare, description: 'Mark a Messenger conversation as read.', inputs: [{ name: 'conversationId', label: 'Conversation ID', type: 'text' }] },
      { name: 'get_commerce_merchant_settings', label: 'Get Commerce Merchant Settings', icon: ShoppingBag, description: 'Fetch settings for the connected Commerce account.', inputs: [] },
      { name: 'get_orders', label: 'Get Commerce Orders', icon: Package, description: 'Retrieve a list of recent orders from your Facebook Shop.', inputs: [] },
      { name: 'create_catalog', label: 'Create Product Catalog', icon: ShoppingBag, description: 'Create a new product catalog.', inputs: [{ name: 'name', label: 'Catalog Name', type: 'text' }] },
      { name: 'get_catalogs', label: 'Get Product Catalogs', icon: ShoppingBag, description: 'List all product catalogs associated with the business.', inputs: [] },
      { name: 'add_product_to_catalog', label: 'Add Product to Catalog', icon: ShoppingBag, description: 'Add a new product to a specified catalog.', inputs: [{ name: 'catalogId', label: 'Catalog ID', type: 'text' }, { name: 'productData', label: 'Product Data (JSON)', type: 'textarea' }] },
      { name: 'get_products_in_catalog', label: 'Get Products in Catalog', icon: ShoppingBag, description: 'Retrieve all products from a specific catalog.', inputs: [{ name: 'catalogId', label: 'Catalog ID', type: 'text' }] },
      { name: 'create_product_set', label: 'Create Product Set (Collection)', icon: ShoppingBag, description: 'Create a new collection within a catalog.', inputs: [{ name: 'catalogId', label: 'Catalog ID', type: 'text' }, { name: 'name', label: 'Set Name', type: 'text' }] },
      { name: 'get_product_sets', label: 'Get Product Sets (Collections)', icon: ShoppingBag, description: 'List all collections in a catalog.', inputs: [{ name: 'catalogId', label: 'Catalog ID', type: 'text' }] },
      { name: 'add_product_to_set', label: 'Add Product to Set', icon: ShoppingBag, description: 'Add a product to a collection.', inputs: [{ name: 'productSetId', label: 'Product Set ID', type: 'text' }, { name: 'productId', label: 'Product ID', type: 'text' }] },
      { name: 'process_comment_with_ai', label: 'Process Comment with AI', icon: Bot, description: 'Use AI to moderate or generate a reply for a comment.', inputs: [{ name: 'commentText', label: 'Comment Text', type: 'text' }, { name: 'moderationPrompt', label: 'Moderation Prompt (Optional)', type: 'textarea' }, { name: 'replyPrompt', label: 'Reply Prompt (Optional)', type: 'textarea' }] },
      { name: 'schedule_live_video', label: 'Schedule Live Video', icon: Video, description: 'Schedule a pre-recorded video to premiere as a live stream.', inputs: [{ name: 'title', label: 'Title', type: 'text' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'scheduledTime', label: 'Schedule Time (Unix Timestamp)', type: 'number' }, { name: 'videoUrl', label: 'Video Source URL', type: 'text' }] },
      { name: 'get_live_videos', label: 'Get Live Videos', icon: Video, description: 'Fetch a list of live and scheduled videos.', inputs: [] },
      { name: 'start_live_video', label: 'Start Live Video', icon: Video, description: 'Manually start a scheduled live video.', inputs: [{ name: 'liveVideoId', label: 'Live Video ID', type: 'text' }] },
      { name: 'end_live_video', label: 'End Live Video', icon: Video, description: 'End an ongoing live video stream.', inputs: [{ name: 'liveVideoId', label: 'Live Video ID', type: 'text' }] },
    ]
  },
  {
    appId: 'instagram',
    name: 'Instagram Suite',
    icon: InstagramIcon,
    actions: [
      { name: 'get_user_details', label: 'Get My User Details', icon: Wrench, description: 'Fetches details of the connected Instagram account.', inputs: [] },
      { name: 'get_user_media', label: 'Get My Recent Media', icon: Newspaper, description: 'Retrieves a list of recent posts and reels.', inputs: [] },
      { name: 'get_media_details', label: 'Get Media Details', icon: Newspaper, description: 'Get detailed information about a specific post or reel.', inputs: [{ name: 'mediaId', label: 'Media ID', type: 'text' }] },
      { name: 'get_media_comments', label: 'Get Media Comments', icon: MessageSquare, description: 'Fetch comments for a specific post.', inputs: [{ name: 'mediaId', label: 'Media ID', type: 'text' }] },
      { name: 'get_stories', label: 'Get My Active Stories', icon: Clapperboard, description: 'Retrieve a list of your current active stories.', inputs: [] },
      { name: 'discover_user', label: 'Discover User Profile', icon: Compass, description: 'Get public information about another Instagram business account.', inputs: [{ name: 'username', label: 'Username', type: 'text' }] },
      { name: 'create_image_post', label: 'Create Image Post', icon: Newspaper, description: 'Publish a single image post.', inputs: [{ name: 'imageUrl', label: 'Image URL', type: 'text' }, { name: 'caption', label: 'Caption', type: 'textarea' }] },
      { name: 'create_video_post', label: 'Create Video Post (Reel)', icon: Video, description: 'Publish a video (reel).', inputs: [{ name: 'videoUrl', label: 'Video URL', type: 'text' }, { name: 'caption', label: 'Caption', type: 'textarea' }] },
      { name: 'create_carousel_post', label: 'Create Carousel Post', icon: Newspaper, description: 'Publish a post with multiple images or videos.', inputs: [{ name: 'mediaUrls', label: 'Image/Video URLs (comma-separated)', type: 'textarea' }, { name: 'caption', label: 'Caption', type: 'textarea' }] },
      { name: 'search_hashtag_id', label: 'Search Hashtag ID', icon: Search, description: 'Get the unique ID for a hashtag.', inputs: [{ name: 'hashtag', label: 'Hashtag (without #)', type: 'text' }] },
      { name: 'get_hashtag_recent_media', label: 'Get Recent Hashtag Media', icon: Newspaper, description: 'Find recent posts for a specific hashtag.', inputs: [{ name: 'hashtagId', label: 'Hashtag ID', type: 'text' }] },
      { name: 'get_hashtag_top_media', label: 'Get Top Hashtag Media', icon: Star, description: 'Find top-performing posts for a specific hashtag.', inputs: [{ name: 'hashtagId', label: 'Hashtag ID', type: 'text' }] },
      { name: 'reply_to_comment', label: 'Reply to Comment', icon: MessageSquare, description: 'Post a reply to a specific comment.', inputs: [{ name: 'commentId', label: 'Comment ID', type: 'text' }, { name: 'message', label: 'Reply Text', type: 'textarea' }] },
      { name: 'delete_comment', label: 'Delete a Comment', icon: Trash2, description: 'Delete a comment you have made.', inputs: [{ name: 'commentId', label: 'Comment ID', type: 'text' }] },
      { name: 'like_comment', label: 'Like a Comment', icon: ThumbsUp, description: 'Like a specific comment.', inputs: [{ name: 'commentId', label: 'Comment ID', type: 'text' }] },
      { name: 'get_insights', label: 'Get Post Insights', icon: BarChart2, description: 'Get performance metrics for a post.', inputs: [{ name: 'mediaId', label: 'Media ID', type: 'text' }, { name: 'metrics', label: 'Metrics (comma-separated)', type: 'text', placeholder: 'impressions,reach,saved' }] },
      { name: 'get_story_insights', label: 'Get Story Insights', icon: BarChart2, description: 'Get performance metrics for a story.', inputs: [{ name: 'storyId', label: 'Story ID', type: 'text' }, { name: 'metrics', label: 'Metrics (comma-separated)', type: 'text', placeholder: 'exits,replies,taps_forward' }] },
      { name: 'discover_product', label: 'Discover Product from Post', icon: ShoppingBag, description: 'Get details of products tagged in a shopping post.', inputs: [{ name: 'mediaId', label: 'Media ID of a shopping post', type: 'text' }] },
      { name: 'get_mentioned_media', label: 'Get Mentioned Media', icon: AtSign, description: 'Find posts where your account has been mentioned.', inputs: [] },
      { name: 'get_tagged_media', label: 'Get Tagged Media', icon: Tag, description: 'Find posts where your account has been tagged in a photo.', inputs: [] }
    ]
  },
  {
    appId: 'crm',
    name: 'CRM Suite',
    icon: Briefcase,
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
    icon: Mail,
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
    icon: MessageSquare,
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
  },
  {
    appId: 'url-shortener',
    name: 'URL Shortener',
    icon: LinkIcon,
    actions: []
  },
  {
    appId: 'qr-code-maker',
    name: 'QR Code Maker',
    icon: QrCode,
    actions: []
  },
  {
    appId: 'seo-suite',
    name: 'SEO Suite',
    icon: SeoIcon,
    actions: []
  },
  {
    appId: 'google_sheets',
    name: 'Google Sheets',
    category: 'Productivity',
    logo: 'https://picsum.photos/seed/gsheets/40/40',
    connectionType: 'oauth',
    actions: []
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
    actions: []
  },
  {
    appId: 'slack',
    name: 'Slack',
    category: 'Communication',
    logo: 'https://picsum.photos/seed/slack/40/40',
    connectionType: 'oauth',
    actions: []
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    category: 'Email',
    logo: 'https://picsum.photos/seed/gmail/40/40',
    connectionType: 'oauth',
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
    actions: []
  },
  {
    appId: 'discord',
    name: 'Discord',
    category: 'Communication',
    logo: 'https://picsum.photos/seed/discord/40/40',
    connectionType: 'oauth',
    actions: []
  },
  {
    appId: 'notion',
    name: 'Notion',
    category: 'Productivity',
    logo: 'https://picsum.photos/seed/notion/40/40',
    connectionType: 'oauth',
    actions: []
  },
];
