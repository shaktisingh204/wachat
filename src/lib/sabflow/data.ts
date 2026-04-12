// SabFlow App Data Definitions
// This file contains pure data definitions for SabFlow apps and actions.
// It is safe to import in Server Actions and Shared code.


const wachatActions = [
  {
    name: 'onMessageReceived',
    label: 'Incoming Message',
    description: 'Triggers when a new WhatsApp message is received.',
    isTrigger: true,
    outputs: [
      { name: 'senderPhone', label: 'Sender Phone', type: 'text' },
      { name: 'senderName', label: 'Sender Name', type: 'text' },
      { name: 'messageBody', label: 'Message Text', type: 'text' },
      { name: 'messageId', label: 'Message ID', type: 'text' },
      { name: 'messageType', label: 'Message Type', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }
    ]
  },
  { name: 'sendMessage', label: 'Send Text Message', description: 'Sends a simple text message.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', placeholder: 'e.g. 919876543210', required: true }, { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello {{name}}!' }] },
  { name: 'sendImage', label: 'Send Image', description: 'Sends an image from a URL, Base64, or file upload.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Image URL', type: 'text' }, { name: 'imageBase64', label: 'Base64 Data', type: 'textarea' }, { name: 'caption', label: 'Caption', type: 'text' }] },
  { name: 'sendTemplate', label: 'Send Template Message', description: 'Sends a pre-approved WhatsApp template.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'templateId', label: 'Template', type: 'template-selector', fetch: 'templates', required: true }, { name: 'variables', label: 'Variables (JSON)', type: 'json-editor', placeholder: '{ "body": ["John"], "header": ["Order #123"] }' }] },
  { name: 'triggerMetaFlow', label: 'Trigger Meta Flow', description: 'Starts an interactive Meta Flow.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'metaFlowId', label: 'Meta Flow', type: 'dynamic-selector', fetch: 'metaFlows' }, { name: 'header', label: 'Header Text', type: 'text' }, { name: 'body', label: 'Body Text', type: 'textarea' }, { name: 'footer', label: 'Footer Text', type: 'text' }] },
  { name: 'requestRazorpayPayment', label: 'Request Razorpay Payment', description: 'Sends a Razorpay payment link.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'amount', label: 'Amount (INR)', type: 'number' }, { name: 'description', label: 'Description', type: 'text' }] },
  { name: 'requestWaPayPayment', label: 'Request WhatsApp Payment', description: 'Initiates a WhatsApp Pay request.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'amount', label: 'Amount (INR)', type: 'number' }, { name: 'description', label: 'Description', type: 'text' }] },
  { name: 'createContact', label: 'Create/Update Contact', description: 'Creates a new contact or updates an existing one.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'name', label: 'Name', type: 'text' }, { name: 'waId', label: 'WhatsApp ID', type: 'text', required: true }] },
  { name: 'updateContact', label: 'Update Contact Variables', description: 'Updates custom attributes for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'variables', label: 'Variables (JSON)', type: 'textarea', placeholder: '{"key": "value"}' }] },
  { name: 'addContactTag', label: 'Add Tag to Contact', description: 'Adds a tag to a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'tagId', label: 'Tag', type: 'tag-selector', fetch: 'tags', required: true }] },
  { name: 'removeContactTag', label: 'Remove Tag from Contact', description: 'Removes a tag from a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'tagId', label: 'Tag', type: 'tag-selector', fetch: 'tags', required: true }] },
  { name: 'getContact', label: 'Get Contact Details', description: 'Retrieves all data for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
  { name: 'getConversation', label: 'Get Conversation History', description: 'Retrieves recent messages for a contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
  { name: 'markAsRead', label: 'Mark Conversation as Read', description: 'Marks the conversation as read.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
  { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns the conversation to a team member.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'agentId', label: 'Agent ID', type: 'agent-selector', fetch: 'agents' }] },
  { name: 'changeConversationStatus', label: 'Change Conversation Status', description: 'Updates the Kanban status of the conversation.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'status', label: 'New Status', type: 'text' }] },
  { name: 'triggerFlow', label: 'Trigger Another Flow', description: 'Starts another flow for the current contact.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'flowId', label: 'Flow ID', type: 'text' }] },
  { name: 'sendSticker', label: 'Send Sticker', description: 'Sends a sticker.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Sticker URL', type: 'text', required: true }] },
  { name: 'sendVideo', label: 'Send Video', description: 'Sends a video file.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Video URL', type: 'text', required: true }, { name: 'caption', label: 'Caption', type: 'text' }] },
  { name: 'sendAudio', label: 'Send Audio', description: 'Sends an audio file.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Audio URL', type: 'text', required: true }] },
  { name: 'sendDocument', label: 'Send Document', description: 'Sends a document file.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'mediaUrl', label: 'Document URL', type: 'text', required: true }, { name: 'filename', label: 'Filename', type: 'text' }, { name: 'caption', label: 'Caption', type: 'text' }] },
  { name: 'sendLocation', label: 'Send Location', description: 'Sends a location pin.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'latitude', label: 'Latitude', type: 'number', required: true }, { name: 'longitude', label: 'Longitude', type: 'number', required: true }, { name: 'name', label: 'Location Name', type: 'text' }, { name: 'address', label: 'Address', type: 'text' }] },
  { name: 'sendListMessage', label: 'Send List Message', description: 'Sends a menu with up to 10 options.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'header', label: 'Header Text', type: 'text' }, { name: 'body', label: 'Body Text', type: 'textarea', required: true }, { name: 'footer', label: 'Footer Text', type: 'text' }, { name: 'buttonText', label: 'Button Text', type: 'text', required: true, placeholder: 'Menu' }, { name: 'sections', label: 'Sections (JSON)', type: 'json-editor', placeholder: '[{ "title": "Section 1", "rows": [{ "id": "opt1", "title": "Option 1" }] }]' }] },
  { name: 'sendButtonMessage', label: 'Send Button Message', description: 'Sends a message with up to 3 quick reply buttons.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'header', label: 'Header Text', type: 'text' }, { name: 'body', label: 'Body Text', type: 'textarea', required: true }, { name: 'footer', label: 'Footer Text', type: 'text' }, { name: 'buttons', label: 'Buttons (JSON)', type: 'json-editor', placeholder: '[{ "type": "reply", "reply": { "id": "btn1", "title": "Yes" } }]' }] },
  { name: 'reactToMessage', label: 'React to Message', description: 'Reacts to a message with an emoji.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'messageId', label: 'Message ID (WAMID)', type: 'text', required: true }, { name: 'emoji', label: 'Emoji', type: 'text', required: true }] },
  { name: 'sendContact', label: 'Send Contact (vCard)', description: 'Sends a contact card.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'contactName', label: 'Contact Name', type: 'text', required: true }, { name: 'contactPhone', label: 'Contact Phone', type: 'text', required: true }] },
  { name: 'sendProduct', label: 'Send Product', description: 'Sends a single product from your catalog.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'catalogId', label: 'Catalog ID', type: 'text', required: true }, { name: 'productRetailerId', label: 'Product SKU (Retailer ID)', type: 'text', required: true }, { name: 'body', label: 'Body Text', type: 'text' }, { name: 'footer', label: 'Footer Text', type: 'text' }] },
  { name: 'sendProductList', label: 'Send Product List', description: 'Sends a list of products.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'header', label: 'Header', type: 'text', required: true }, { name: 'body', label: 'Body', type: 'text', required: true }, { name: 'footer', label: 'Footer', type: 'text' }, { name: 'catalogId', label: 'Catalog ID', type: 'text', required: true }, { name: 'sections', label: 'Sections (JSON)', type: 'json-editor', placeholder: '[{ "title": "Best Sellers", "product_items": [{ "product_retailer_id": "sku1" }] }]' }] },
  { name: 'sendCatalog', label: 'Send Catalog', description: 'Sends the store catalog.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'body', label: 'Body Text', type: 'text', required: true }, { name: 'footer', label: 'Footer Text', type: 'text' }, { name: 'thumbnailProductRetailerId', label: 'Thumbnail Product SKU', type: 'text' }] },
  { name: 'replyToMessage', label: 'Reply To Message', description: 'Replies to a specific message.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }, { name: 'contextMessageId', label: 'Message ID (Context)', type: 'text', required: true }, { name: 'message', label: 'Reply Message', type: 'textarea', required: true }] },
  { name: 'markAsUnread', label: 'Mark as Unread', description: 'Marks the last message as unread.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'wachat', required: true }, { name: 'to', label: 'To (WA ID)', type: 'text', required: true }] },
];
const sabChatActions = [
  {
    name: 'onSessionStarted',
    label: 'Session Started',
    description: 'Triggers when a new chat session begins.',
    isTrigger: true,
    outputs: [
      { name: 'sessionId', label: 'Session ID', type: 'text' },
      { name: 'visitorName', label: 'Visitor Name', type: 'text' },
      { name: 'visitorEmail', label: 'Visitor Email', type: 'text' },
      { name: 'visitorPhone', label: 'Visitor Phone', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  { name: 'sendMessage', label: 'Send Message', description: 'Sends a message to a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'content', label: 'Message Content', type: 'textarea' }] },
  { name: 'closeSession', label: 'Close Session', description: 'Closes a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
  { name: 'addTagToSession', label: 'Add Tag to Session', description: 'Adds a tag to a live chat session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'tagName', label: 'Tag Name', type: 'dynamic-selector', fetch: 'sabChatTags' }] },
  { name: 'getOrCreateSession', label: 'Get or Create Session', description: 'Finds an existing session or creates a new one for a visitor.', inputs: [{ name: 'email', label: 'Visitor Email', type: 'text' }] },
  { name: 'getSessionDetails', label: 'Get Session Details', description: 'Retrieves full details for a session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
  { name: 'updateVisitorInfo', label: 'Update Visitor Info', description: 'Updates the name, email, or phone of a visitor.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'name', label: 'Name', type: 'text' }, { name: 'email', label: 'Email', type: 'text' }, { name: 'phone', label: 'Phone', type: 'text' }] },
  { name: 'assignAgent', label: 'Assign Agent', description: 'Assigns a chat session to a team member.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'agentId', label: 'Agent ID', type: 'agent-selector', fetch: 'agents' }] },
  { name: 'sendQuickReply', label: 'Send Quick Reply', description: 'Sends a pre-configured quick reply.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'replyId', label: 'Quick Reply', type: 'dynamic-selector', fetch: 'sabChatQuickReplies' }] },
  { name: 'sendFaq', label: 'Send FAQ Answer', description: 'Sends a pre-configured FAQ answer.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }, { name: 'faqId', label: 'FAQ', type: 'dynamic-selector', fetch: 'sabChatFaqs' }] },
  { name: 'blockVisitor', label: 'Block Visitor', description: 'Blocks the visitor associated with the session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
  { name: 'getChatHistory', label: 'Get Chat History', description: 'Retrieves the message history for a session.', inputs: [{ name: 'sessionId', label: 'Session ID', type: 'dynamic-selector', fetch: 'sabChatSessions' }] },
];

const metaActions = [
  {
    name: 'onLeadGen',
    label: 'New Lead (Instant Form)',
    description: 'Triggers when a lead is submitted via Facebook Instant Form.',
    isTrigger: true,
    outputs: [
      { name: 'leadId', label: 'Lead ID', type: 'text' },
      { name: 'formName', label: 'Form Name', type: 'text' },
      { name: 'fullName', label: 'Full Name', type: 'text' },
      { name: 'phoneNumber', label: 'Phone Number', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'customFields', label: 'Custom Fields (JSON)', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  {
    name: 'onPageComment',
    label: 'New Page Comment',
    description: 'Triggers when a user comments on a post.',
    isTrigger: true,
    outputs: [
      { name: 'commentId', label: 'Comment ID', type: 'text' },
      { name: 'postId', label: 'Post ID', type: 'text' },
      { name: 'commentText', label: 'Comment', type: 'text' },
      { name: 'senderName', label: 'Sender Name', type: 'text' },
      { name: 'senderId', label: 'Sender ID', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  {
    name: 'onMessengerMessage',
    label: 'Incoming Messenger Message',
    description: 'Triggers when a Messenger message is received.',
    isTrigger: true,
    outputs: [
      { name: 'senderId', label: 'Sender ID', type: 'text' },
      { name: 'messageText', label: 'Message Text', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  { name: 'createPost', label: 'Create Post', description: 'Create a new post on your Facebook Page.', inputs: [{ name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook' }, { name: 'message', label: 'Message', type: 'textarea' }, { name: 'imageUrl', label: 'Image URL (Optional)', type: 'text' }, { name: 'imageBase64', label: 'Image (Base64)', type: 'textarea' }] },
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
  {
    name: 'onLeadCreated',
    label: 'New CRM Lead',
    description: 'Triggers when a new lead is created.',
    isTrigger: true,
    outputs: [
      { name: 'leadId', label: 'Lead ID', type: 'text' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'status', label: 'Status', type: 'text' },
      { name: 'source', label: 'Source', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  {
    name: 'onDealStageUpdated',
    label: 'Deal Stage Updated',
    description: 'Triggers when a deal stage changes.',
    isTrigger: true,
    outputs: [
      { name: 'dealId', label: 'Deal ID', type: 'text' },
      { name: 'dealName', label: 'Deal Name', type: 'text' },
      { name: 'amount', label: 'Deal Value', type: 'number' },
      { name: 'newStage', label: 'New Stage', type: 'text' },
      { name: 'oldStage', label: 'Old Stage', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  { name: 'createLead', label: 'Create Lead and Deal', description: 'Create a new contact and an associated sales deal.', inputs: [{ name: 'contactName', label: 'Contact Name', type: 'text' }, { name: 'email', label: 'Email', type: 'text' }, { name: 'phone', label: 'Phone', type: 'text' }, { name: 'company', label: 'Company', type: 'text' }, { name: 'dealName', label: 'Deal Name', type: 'text' }, { name: 'dealValue', label: 'Deal Value', type: 'number' }, { name: 'stage', label: 'Stage', type: 'text' }] },
  { name: 'addNote', label: 'Add Note', description: 'Add a note to a contact, account, or deal.', inputs: [{ name: 'recordId', label: 'Record ID', type: 'text' }, { name: 'recordType', label: 'Record Type (contact, account, or deal)', type: 'text' }, { name: 'noteContent', label: 'Note Content', type: 'textarea' }] },
];

const emailActions = [
  { name: 'sendEmail', label: 'Send Email', description: 'Send an email to a recipient.', inputs: [{ name: 'to', label: 'To', type: 'text' }, { name: 'subject', label: 'Subject', type: 'text' }, { name: 'body', label: 'Body (HTML)', type: 'textarea' }] }
];

const smsActions = [
  {
    name: 'onSmsReceived',
    label: 'Incoming SMS',
    description: 'Triggers when an SMS is received.',
    isTrigger: true,
    outputs: [
      { name: 'fromNumber', label: 'Sender Number', type: 'text' },
      { name: 'messageBody', label: 'Message Text', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
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
    setupGuide: `
**How to Connect Google Sheets:**

1. **Create Webhook Link**:
   - Copy the Webhook URL shown below.
   - This URL is unique to this flow.

2. **Configure Google Sheet**:
   - Open your Google Sheet.
   - Go to **Extensions > Apps Script**.
   - Paste the provided SabFlow Script (from docs).
   - In the script, replace \`WEBHOOK_URL\` with the URL you copied.

3. **Set Trigger**:
   - In Apps Script, add a trigger for "On Change".
   - Now, any edit in the sheet will send data here!
`,
    outputs: [
      { name: 'sheetName', label: 'Sheet Name', type: 'text' },
      { name: 'rowNumber', label: 'Row Number', type: 'number' },
      // Single Letter Columns (A-Z)
      ...Array.from({ length: 26 }, (_, i) => ({ name: String.fromCharCode(65 + i), label: `Column ${String.fromCharCode(65 + i)}`, type: 'text' })),
      // Double Letter Columns (AA-AZ)
      ...Array.from({ length: 26 }, (_, i) => ({ name: `A${String.fromCharCode(65 + i)}`, label: `Column A${String.fromCharCode(65 + i)}`, type: 'text' })),
      { name: 'newValues', label: 'Raw Row Values (JSON)', type: 'text' }
    ],
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

const teamActions = [
  {
    name: 'onTaskAssigned',
    label: 'Task Assigned',
    description: 'Triggers when a task is assigned to a user.',
    isTrigger: true,
    outputs: [
      { name: 'taskId', label: 'Task ID', type: 'text' },
      { name: 'taskTitle', label: 'Task Title', type: 'text' },
      { name: 'assignedTo', label: 'Assigned User', type: 'text' },
      { name: 'dueDate', label: 'Due Date', type: 'text' }
    ],
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true }
    ]
  },
  {
    name: 'createTask',
    label: 'Create Task',
    description: 'Creates a new team task.',
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'assignedTo', label: 'Assigned User ID', type: 'text' },
      { name: 'priority', label: 'Priority (low/medium/high)', type: 'text', placeholder: 'medium' },
      { name: 'dueDate', label: 'Due Date (ISO)', type: 'text', placeholder: '2026-06-01' },
    ],
    outputs: [
      { name: 'taskId', label: 'Task ID', type: 'text' },
    ],
  },
  {
    name: 'updateTaskStatus',
    label: 'Update Task Status',
    description: 'Changes the status of a team task.',
    inputs: [
      { name: 'taskId', label: 'Task ID', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'text', required: true, placeholder: 'todo, in_progress, done' },
    ],
    outputs: [
      { name: 'success', label: 'Success', type: 'text' },
    ],
  },
  {
    name: 'assignTask',
    label: 'Assign Task',
    description: 'Assigns a team task to a user.',
    inputs: [
      { name: 'taskId', label: 'Task ID', type: 'text', required: true },
      { name: 'assignedTo', label: 'User ID', type: 'text', required: true },
    ],
    outputs: [
      { name: 'success', label: 'Success', type: 'text' },
    ],
  },
  {
    name: 'addTaskComment',
    label: 'Add Task Comment',
    description: 'Adds a comment to a team task.',
    inputs: [
      { name: 'taskId', label: 'Task ID', type: 'text', required: true },
      { name: 'comment', label: 'Comment', type: 'textarea', required: true },
    ],
    outputs: [
      { name: 'commentId', label: 'Comment ID', type: 'text' },
    ],
  },
  {
    name: 'listTasks',
    label: 'List Tasks',
    description: 'Retrieves tasks filtered by status and/or assignee.',
    inputs: [
      { name: 'projectId', label: 'Project', type: 'project-selector', required: true },
      { name: 'status', label: 'Status Filter', type: 'text' },
      { name: 'assignedTo', label: 'Assigned To Filter', type: 'text' },
    ],
    outputs: [
      { name: 'tasks', label: 'Tasks', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
];

// Core App Action Definitions

const codeActions = [
  { name: 'runJavascript', label: 'Run JavaScript', description: 'Execute custom JavaScript code within a sandbox. Use `input` variable to access data.', inputs: [{ name: 'code', label: 'Code', type: 'code-editor', language: 'javascript', placeholder: 'return "Hello " + input.name;' }] }
];

const dataForwarderActions = [
  { name: 'forwardData', label: 'Forward Data', description: 'Passes data through to the next step unchanged.', inputs: [] }
];

const dataTransformerActions = [
  { name: 'transformData', label: 'Transform Data', description: 'Transform input data using a predefined schema.', inputs: [{ name: 'schema', label: 'Schema (JSON)', type: 'json-editor' }] }
];

const datetimeFormatterActions = [
  { name: 'formatDate', label: 'Format Date', description: 'Format a date string.', inputs: [{ name: 'date', label: 'Date', type: 'text' }, { name: 'format', label: 'Format', type: 'text', placeholder: 'YYYY-MM-DD' }] },
  { name: 'addToDate', label: 'Add to Date', description: 'Add time to a date.', inputs: [{ name: 'date', label: 'Date', type: 'text' }, { name: 'amount', label: 'Amount', type: 'number' }, { name: 'unit', label: 'Unit', type: 'text', placeholder: 'days, hours, minutes' }] },
  { name: 'subtractFromDate', label: 'Subtract from Date', description: 'Subtract time from a date.', inputs: [{ name: 'date', label: 'Date', type: 'text' }, { name: 'amount', label: 'Amount', type: 'number' }, { name: 'unit', label: 'Unit', type: 'text', placeholder: 'days, hours, minutes' }] },
];

const delayActions = [
  { name: 'waitFor', label: 'Wait For', description: 'Pause execution for a specific duration.', inputs: [{ name: 'value', label: 'Duration', type: 'number' }, { name: 'unit', label: 'Unit', type: 'text', placeholder: 'seconds, minutes, hours' }] }
];

const filterActions = [
  { name: 'continueIf', label: 'Continue If', description: 'Continue execution only if a condition is met.', inputs: [{ name: 'field', label: 'Value A', type: 'text' }, { name: 'operator', label: 'Operator', type: 'text' }, { name: 'value', label: 'Value B', type: 'text' }] },
  { name: 'stopIf', label: 'Stop If', description: 'Stop execution if a condition is met.', inputs: [{ name: 'field', label: 'Value A', type: 'text' }, { name: 'operator', label: 'Operator', type: 'text' }, { name: 'value', label: 'Value B', type: 'text' }] }
];

const iteratorActions = [
  {
    name: 'spread',
    label: 'Spread Array',
    description: 'Expose an array and its first/last item as flow variables ({{step.items}}, {{step.first}}, {{step.last}}, {{step.count}}).',
    inputs: [
      { name: 'array', label: 'Array', type: 'textarea', required: true, placeholder: '{{trigger.items}} or JSON array' },
    ],
    outputs: [
      { name: 'items', label: 'Items', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
      { name: 'first', label: 'First Item', type: 'text' },
      { name: 'last', label: 'Last Item', type: 'text' },
    ],
  },
  {
    name: 'getFirst',
    label: 'Get First N',
    description: 'Return the first N items of an array.',
    inputs: [
      { name: 'array', label: 'Array', type: 'textarea', required: true },
      { name: 'n', label: 'Count', type: 'number', required: true, placeholder: '5' },
    ],
    outputs: [
      { name: 'items', label: 'Items', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
  {
    name: 'getLast',
    label: 'Get Last N',
    description: 'Return the last N items of an array.',
    inputs: [
      { name: 'array', label: 'Array', type: 'textarea', required: true },
      { name: 'n', label: 'Count', type: 'number', required: true, placeholder: '5' },
    ],
    outputs: [
      { name: 'items', label: 'Items', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
  {
    name: 'chunk',
    label: 'Chunk Array',
    description: 'Split an array into chunks of size N.',
    inputs: [
      { name: 'array', label: 'Array', type: 'textarea', required: true },
      { name: 'size', label: 'Chunk Size', type: 'number', required: true, placeholder: '10' },
    ],
    outputs: [
      { name: 'chunks', label: 'Chunks (array of arrays)', type: 'text' },
      { name: 'count', label: 'Chunk Count', type: 'number' },
    ],
  },
  {
    name: 'mapField',
    label: 'Pluck Field',
    description: 'Extract a single field from each object in an array (e.g. list of emails from a list of users).',
    inputs: [
      { name: 'array', label: 'Array of Objects', type: 'textarea', required: true },
      { name: 'field', label: 'Field Name', type: 'text', required: true, placeholder: 'email' },
    ],
    outputs: [
      { name: 'values', label: 'Values', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
  {
    name: 'filterByField',
    label: 'Filter by Field',
    description: 'Return only array items where a field equals a given value.',
    inputs: [
      { name: 'array', label: 'Array of Objects', type: 'textarea', required: true },
      { name: 'field', label: 'Field Name', type: 'text', required: true },
      { name: 'value', label: 'Value', type: 'text', required: true },
    ],
    outputs: [
      { name: 'items', label: 'Filtered Items', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
];

const jsonExtractorActions = [
  { name: 'parseJson', label: 'Parse JSON', description: 'Parse a JSON string into an object.', inputs: [{ name: 'jsonString', label: 'JSON String', type: 'textarea' }] }
];

const numberFormatterActions = [
  { name: 'formatCurrency', label: 'Format Currency', description: 'Format a number as currency.', inputs: [{ name: 'amount', label: 'Amount', type: 'number' }, { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD, EUR' }] },
  { name: 'calculateMath', label: 'Math Operation', description: 'Perform a math operation.', inputs: [{ name: 'expression', label: 'Expression', type: 'text', placeholder: '{{value}} * 2' }] }
];

const routerActions = [
  { name: 'route', label: 'Route', description: 'Route execution based on conditions.', inputs: [{ name: 'routes', label: 'Routes (JSON)', type: 'json-editor' }] }
];

const textFormatterActions = [
  { name: 'capitalize', label: 'Capitalize', description: 'Capitalize the first letter of a string.', inputs: [{ name: 'text', label: 'Text', type: 'textarea' }] },
  { name: 'lowercase', label: 'Lowercase', description: 'Convert string to lowercase.', inputs: [{ name: 'text', label: 'Text', type: 'textarea' }] },
  { name: 'uppercase', label: 'Uppercase', description: 'Convert string to uppercase.', inputs: [{ name: 'text', label: 'Text', type: 'textarea' }] },
  { name: 'trim', label: 'Trim', description: 'Remove whitespace from ends of a string.', inputs: [{ name: 'text', label: 'Text', type: 'textarea' }] },
  { name: 'split', label: 'Split', description: 'Split a string into an array.', inputs: [{ name: 'text', label: 'Text', type: 'textarea' }, { name: 'separator', label: 'Separator', type: 'text' }] }
];

// ────────────────────────────────────────────────────────────────
// Tier-1 implementations (previously empty stubs)
// ────────────────────────────────────────────────────────────────

const dynamicWebPageActions = [
  {
    name: 'renderTemplate',
    label: 'Render HTML Template',
    description: 'Render an HTML template with variable substitution. Use {{var}} placeholders.',
    inputs: [
      { name: 'template', label: 'HTML Template', type: 'textarea', required: true, placeholder: '<h1>Hello {{name}}</h1>' },
      { name: 'data', label: 'Data (JSON)', type: 'textarea', placeholder: '{ "name": "World" }' },
    ],
    outputs: [
      { name: 'html', label: 'Rendered HTML', type: 'text' },
      { name: 'length', label: 'Length (chars)', type: 'number' },
    ],
  },
  {
    name: 'publishPage',
    label: 'Publish Page',
    description: 'Store an HTML page at a permanent slug accessible via a public URL.',
    inputs: [
      { name: 'slug', label: 'Slug', type: 'text', required: true, placeholder: 'welcome-page' },
      { name: 'title', label: 'Page Title', type: 'text', required: true },
      { name: 'content', label: 'HTML Content', type: 'textarea', required: true },
    ],
    outputs: [
      { name: 'url', label: 'Public URL', type: 'text' },
      { name: 'slug', label: 'Slug', type: 'text' },
    ],
  },
  {
    name: 'getPage',
    label: 'Get Published Page',
    description: 'Retrieves a previously published page by slug.',
    inputs: [
      { name: 'slug', label: 'Slug', type: 'text', required: true },
    ],
    outputs: [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'content', label: 'Content', type: 'text' },
      { name: 'views', label: 'Views', type: 'number' },
    ],
  },
];

const fileUploaderActions = [
  {
    name: 'inspectUrl',
    label: 'Inspect File URL',
    description: 'Fetches metadata about a file at a public URL (size, content-type, validates reachability).',
    inputs: [
      { name: 'sourceUrl', label: 'File URL', type: 'text', required: true, placeholder: 'https://example.com/image.png' },
    ],
    outputs: [
      { name: 'url', label: 'URL', type: 'text' },
      { name: 'contentType', label: 'Content Type', type: 'text' },
      { name: 'size', label: 'Size (bytes)', type: 'number' },
      { name: 'reachable', label: 'Reachable', type: 'text' },
    ],
  },
  {
    name: 'uploadFromUrl',
    label: 'Upload from URL',
    description: 'Downloads a remote file and stores it internally, returning a new URL.',
    inputs: [
      { name: 'sourceUrl', label: 'Source URL', type: 'text', required: true },
      { name: 'filename', label: 'Filename', type: 'text', placeholder: 'optional-override.pdf' },
    ],
    outputs: [
      { name: 'fileId', label: 'File ID', type: 'text' },
      { name: 'url', label: 'Internal URL', type: 'text' },
      { name: 'size', label: 'Size (bytes)', type: 'number' },
    ],
  },
  {
    name: 'uploadBase64',
    label: 'Upload Base64 Data',
    description: 'Decodes a Base64 payload and stores it as a file.',
    inputs: [
      { name: 'base64Data', label: 'Base64 Data', type: 'textarea', required: true },
      { name: 'filename', label: 'Filename', type: 'text', required: true },
      { name: 'contentType', label: 'Content Type', type: 'text', placeholder: 'image/png' },
    ],
    outputs: [
      { name: 'fileId', label: 'File ID', type: 'text' },
      { name: 'url', label: 'Internal URL', type: 'text' },
      { name: 'size', label: 'Size (bytes)', type: 'number' },
    ],
  },
];

const lookupTableActions = [
  {
    name: 'findByKey',
    label: 'Find by Key',
    description: 'Look up a value in a JSON table by its key field.',
    inputs: [
      { name: 'table', label: 'Table (JSON Array)', type: 'textarea', required: true, placeholder: '[{"key":"US","value":"United States"}]' },
      { name: 'keyField', label: 'Key Field', type: 'text', placeholder: 'key' },
      { name: 'lookupValue', label: 'Value to Look Up', type: 'text', required: true },
    ],
    outputs: [
      { name: 'match', label: 'Matched Row', type: 'text' },
      { name: 'found', label: 'Found', type: 'text' },
    ],
  },
  {
    name: 'findByField',
    label: 'Find by Field',
    description: 'Find the first row in a table where a field equals a given value.',
    inputs: [
      { name: 'table', label: 'Table (JSON Array)', type: 'textarea', required: true },
      { name: 'field', label: 'Field Name', type: 'text', required: true },
      { name: 'value', label: 'Value', type: 'text', required: true },
    ],
    outputs: [
      { name: 'match', label: 'Matched Row', type: 'text' },
      { name: 'found', label: 'Found', type: 'text' },
    ],
  },
  {
    name: 'filterRows',
    label: 'Filter Rows',
    description: 'Returns all rows where a field equals a given value.',
    inputs: [
      { name: 'table', label: 'Table (JSON Array)', type: 'textarea', required: true },
      { name: 'field', label: 'Field Name', type: 'text', required: true },
      { name: 'value', label: 'Value', type: 'text', required: true },
    ],
    outputs: [
      { name: 'matches', label: 'Matched Rows', type: 'text' },
      { name: 'count', label: 'Match Count', type: 'number' },
    ],
  },
];

const connectManagerActions = [
  {
    name: 'listConnections',
    label: 'List Connections',
    description: 'Returns all connections configured for the current user.',
    inputs: [],
    outputs: [
      { name: 'connections', label: 'Connections', type: 'text' },
      { name: 'count', label: 'Count', type: 'number' },
    ],
  },
  {
    name: 'checkConnection',
    label: 'Check Connection',
    description: 'Check whether a specific app connection exists for this user.',
    inputs: [
      { name: 'appName', label: 'App Name', type: 'text', required: true, placeholder: 'Slack' },
    ],
    outputs: [
      { name: 'connected', label: 'Connected', type: 'text' },
      { name: 'appName', label: 'App Name', type: 'text' },
    ],
  },
  {
    name: 'getConnectionDetails',
    label: 'Get Connection Details',
    description: 'Retrieves non-sensitive details about an existing connection.',
    inputs: [
      { name: 'appName', label: 'App Name', type: 'text', required: true },
    ],
    outputs: [
      { name: 'details', label: 'Details', type: 'text' },
    ],
  },
];

const hookActions = [
  {
    name: 'sendWebhook',
    label: 'Send Webhook',
    description: 'Makes an outbound HTTP request to any URL (fire and forget or await response).',
    inputs: [
      { name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com/hook' },
      { name: 'method', label: 'Method', type: 'text', placeholder: 'POST' },
      { name: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{ "X-Api-Key": "..." }' },
      { name: 'body', label: 'Body (JSON or text)', type: 'textarea' },
    ],
    outputs: [
      { name: 'status', label: 'Status Code', type: 'number' },
      { name: 'ok', label: 'OK', type: 'text' },
      { name: 'response', label: 'Response Body', type: 'text' },
    ],
  },
  {
    name: 'pingUrl',
    label: 'Ping URL',
    description: 'Sends a GET request to a URL and returns the status.',
    inputs: [
      { name: 'url', label: 'URL', type: 'text', required: true },
    ],
    outputs: [
      { name: 'status', label: 'Status Code', type: 'number' },
      { name: 'ok', label: 'OK', type: 'text' },
      { name: 'durationMs', label: 'Duration (ms)', type: 'number' },
    ],
  },
];

const subscriptionBillingActions = [
  {
    name: 'getCurrentPlan',
    label: 'Get Current Plan',
    description: 'Returns the current plan of the user running this flow.',
    inputs: [],
    outputs: [
      { name: 'planId', label: 'Plan ID', type: 'text' },
      { name: 'planName', label: 'Plan Name', type: 'text' },
      { name: 'status', label: 'Status', type: 'text' },
    ],
  },
  {
    name: 'checkFeature',
    label: 'Check Feature Access',
    description: 'Checks whether the current plan includes a specific feature.',
    inputs: [
      { name: 'feature', label: 'Feature Key', type: 'text', required: true, placeholder: 'sabflow' },
    ],
    outputs: [
      { name: 'hasFeature', label: 'Has Feature', type: 'text' },
      { name: 'planName', label: 'Plan Name', type: 'text' },
    ],
  },
  {
    name: 'getUsage',
    label: 'Get Usage Metrics',
    description: 'Returns current usage counters for the user (messages, storage, flows, etc).',
    inputs: [],
    outputs: [
      { name: 'usage', label: 'Usage Object', type: 'text' },
    ],
  },
];

const selectTransformJsonActions = [
  {
    name: 'pickFields',
    label: 'Pick Fields',
    description: 'Returns only the specified fields from an input object.',
    inputs: [
      { name: 'source', label: 'Source (JSON)', type: 'textarea', required: true },
      { name: 'fields', label: 'Fields (comma-separated)', type: 'text', required: true, placeholder: 'name,email,phone' },
    ],
    outputs: [
      { name: 'result', label: 'Picked Object', type: 'text' },
    ],
  },
  {
    name: 'omitFields',
    label: 'Omit Fields',
    description: 'Returns the input object without the specified fields.',
    inputs: [
      { name: 'source', label: 'Source (JSON)', type: 'textarea', required: true },
      { name: 'fields', label: 'Fields (comma-separated)', type: 'text', required: true },
    ],
    outputs: [
      { name: 'result', label: 'Object without fields', type: 'text' },
    ],
  },
  {
    name: 'renameField',
    label: 'Rename Field',
    description: 'Renames a field inside an object.',
    inputs: [
      { name: 'source', label: 'Source (JSON)', type: 'textarea', required: true },
      { name: 'fromKey', label: 'From Key', type: 'text', required: true },
      { name: 'toKey', label: 'To Key', type: 'text', required: true },
    ],
    outputs: [
      { name: 'result', label: 'Renamed Object', type: 'text' },
    ],
  },
  {
    name: 'flatten',
    label: 'Flatten Object',
    description: 'Flattens a nested object into dot-notation keys.',
    inputs: [
      { name: 'source', label: 'Source (JSON)', type: 'textarea', required: true },
    ],
    outputs: [
      { name: 'result', label: 'Flat Object', type: 'text' },
    ],
  },
];

const seoSuiteActions = [
  {
    name: 'analyzeUrl',
    label: 'Analyze URL',
    description: 'Fetches a URL and extracts basic SEO metrics (title, meta description, H1, word count).',
    inputs: [
      { name: 'url', label: 'Page URL', type: 'text', required: true, placeholder: 'https://example.com' },
    ],
    outputs: [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'metaDescription', label: 'Meta Description', type: 'text' },
      { name: 'h1', label: 'First H1', type: 'text' },
      { name: 'wordCount', label: 'Word Count', type: 'number' },
      { name: 'score', label: 'Quick Score (0-100)', type: 'number' },
    ],
  },
  {
    name: 'checkMetaTags',
    label: 'Check Meta Tags',
    description: 'Returns all meta tags on a page as a JSON object.',
    inputs: [
      { name: 'url', label: 'Page URL', type: 'text', required: true },
    ],
    outputs: [
      { name: 'meta', label: 'Meta Tags (JSON)', type: 'text' },
      { name: 'ogTags', label: 'OpenGraph Tags (JSON)', type: 'text' },
    ],
  },
  {
    name: 'countKeywords',
    label: 'Count Keywords',
    description: 'Counts occurrences of a keyword in a body of text.',
    inputs: [
      { name: 'text', label: 'Text', type: 'textarea', required: true },
      { name: 'keyword', label: 'Keyword', type: 'text', required: true },
    ],
    outputs: [
      { name: 'count', label: 'Occurrences', type: 'number' },
      { name: 'density', label: 'Density (%)', type: 'number' },
    ],
  },
];



export const sabnodeAppData = [
  // SabNode Internal Apps
  {
    appId: 'wachat',
    name: 'Wachat',
    actions: wachatActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-wachat-icon',
  },
  {
    appId: 'sabchat',
    name: 'sabChat',
    actions: sabChatActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-sabchat-icon',
  },
  {
    appId: 'meta',
    name: 'Meta Suite',
    actions: metaActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-meta-icon',
    setupGuide: `
**How it Works:**
Select the **Project** associated with your Facebook Page.
This trigger will automatically listen for events (Lead Forms, Comments) from the Facebook assets connected to that project.
`,
  },
  {
    appId: 'instagram',
    name: 'Instagram Suite',
    iconColor: 'text-sabflow-instagram-icon',
    setupGuide: `
**How it Works:**
Select the **Project** with a connected Instagram Account.
The automation will trigger when:
- A user comments on your post.
- You are mentioned in a Story/Post.
- A Direct Message is received.
`,
    actions: [
      {
        name: 'onComment',
        label: 'New Post Comment',
        description: 'Triggers on new post comments.',
        isTrigger: true,
        outputs: [
          { name: 'commentId', label: 'Comment ID', type: 'text' },
          { name: 'mediaId', label: 'Media ID', type: 'text' },
          { name: 'text', label: 'Comment Text', type: 'text' },
          { name: 'username', label: 'Username', type: 'text' },
          { name: 'permalink', label: 'Post Link', type: 'text' }
        ],
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true }
        ]
      },
      {
        name: 'onMention',
        label: 'New Mention',
        description: 'Triggers when you are mentioned in a Story/Post.',
        isTrigger: true,
        outputs: [
          { name: 'mediaId', label: 'Media ID', type: 'text' },
          { name: 'mediaType', label: 'Type (Story/Post)', type: 'text' },
          { name: 'username', label: 'Username', type: 'text' },
          { name: 'url', label: 'Media URL', type: 'text' }
        ],
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true }
        ]
      },
      {
        name: 'onDirectMessage',
        label: 'Incoming Direct Message',
        description: 'Triggers when an Instagram DM is received.',
        isTrigger: true,
        outputs: [
          { name: 'senderId', label: 'Sender ID', type: 'text' },
          { name: 'messageText', label: 'Message Text', type: 'text' }
        ],
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true }
        ]
      },
      // ── Actions ──────────────────────────────────────────────
      {
        name: 'sendDirectMessage',
        label: 'Send Direct Message',
        description: 'Sends an Instagram DM to a user (requires an active conversation within 24h).',
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true },
          { name: 'recipientId', label: 'Recipient IGSID', type: 'text', required: true, placeholder: 'Instagram-scoped user ID' },
          { name: 'messageText', label: 'Message', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'messageId', label: 'Message ID', type: 'text' },
          { name: 'recipientId', label: 'Recipient ID', type: 'text' },
        ],
      },
      {
        name: 'replyToComment',
        label: 'Reply to Comment',
        description: 'Posts a reply under an Instagram comment.',
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true },
          { name: 'commentId', label: 'Comment ID', type: 'text', required: true },
          { name: 'message', label: 'Reply Message', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'replyId', label: 'Reply ID', type: 'text' },
        ],
      },
      {
        name: 'getComments',
        label: 'Get Post Comments',
        description: 'Retrieve comments on an Instagram media post.',
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true },
          { name: 'mediaId', label: 'Media ID', type: 'text', required: true },
        ],
        outputs: [
          { name: 'comments', label: 'Comments (array)', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
      {
        name: 'getRecentMedia',
        label: 'Get Recent Media',
        description: 'Returns the latest Instagram posts for the connected account.',
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true },
        ],
        outputs: [
          { name: 'media', label: 'Media (array)', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
      {
        name: 'publishImagePost',
        label: 'Publish Image Post',
        description: 'Publishes an image to the connected Instagram Business account.',
        inputs: [
          { name: 'projectId', label: 'Project', type: 'project-selector', appType: 'facebook', required: true },
          { name: 'imageUrl', label: 'Image URL', type: 'text', required: true, placeholder: 'https://...' },
          { name: 'caption', label: 'Caption', type: 'textarea' },
        ],
        outputs: [
          { name: 'mediaId', label: 'Media ID', type: 'text' },
        ],
      },
    ],
  },
  {
    appId: 'crm',
    name: 'CRM Suite',
    actions: crmActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-crm-icon',
    setupGuide: `
**How it Works:**
Select the **Project** to monitor.
This trigger connects directly to the CRM module for that project and fires whenever:
- A new Lead is created.
- A Deal moves to a new Stage.
`,
  },
  {
    appId: 'team',
    name: 'Team Module',
    actions: teamActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-team-icon',
    setupGuide: `
**How it Works:**
Select the **Project** where you manage tasks.
This trigger fires when a new task is assigned to any team member in that project.
`,
  },
  {
    appId: 'email',
    name: 'Email Suite',
    actions: emailActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-email-icon',
  },
  {
    appId: 'sms',
    name: 'SMS Suite',
    actions: smsActions,
    connectionType: 'internal',
    iconColor: 'text-sabflow-sms-icon',
    setupGuide: `
**SMS Automation:**
1. Go to **Settings > SMS** to configure your provider (Twilio, Kaleyra, etc.).
2. Once verified, incoming SMS will trigger this flow.
`,
  },
  { appId: 'url-shortener', name: 'URL Shortener', actions: urlShortenerActions, connectionType: 'internal', iconColor: 'text-sabflow-url-shortener-icon' },
  { appId: 'qr-code-maker', name: 'QR Code Maker', actions: qrCodeMakerActions, connectionType: 'internal', iconColor: 'text-sabflow-qr-code-maker-icon' },
  { appId: 'seo-suite', name: 'SEO Suite', actions: seoSuiteActions, connectionType: 'internal', iconColor: 'text-sabflow-seo-suite-icon' },




  // Core Apps
  { appId: 'api', name: 'API Request', actions: apiActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-api-icon' },
  { appId: 'api_file_processor', name: 'API File Processor', actions: apiFileProcessorActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-api_file_processor-icon' },
  { appId: 'array_function', name: 'Array Function', actions: arrayFunctionActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-array_function-icon' },
  { appId: 'code', name: 'Code', actions: codeActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-code-icon' },
  { appId: 'data_forwarder', name: 'Data Forwarder', actions: dataForwarderActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_forwarder-icon' },
  { appId: 'data_transformer', name: 'Data Transformer', actions: dataTransformerActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-data_transformer-icon' },
  { appId: 'datetime_formatter', name: 'DateTime Formatter', actions: datetimeFormatterActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-datetime_formatter-icon' },
  { appId: 'delay', name: 'Delay', actions: delayActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-delay-icon' },
  { appId: 'dynamic_web_page', name: 'Dynamic Web Page', actions: dynamicWebPageActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-dynamic_web_page-icon' },
  { appId: 'file_uploader', name: 'File Uploader', actions: fileUploaderActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-file_uploader-icon' },
  { appId: 'filter', name: 'Filter', actions: filterActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-filter-icon' },
  { appId: 'iterator', name: 'Iterator', actions: iteratorActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-iterator-icon' },
  { appId: 'json_extractor', name: 'JSON Extractor', actions: jsonExtractorActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-json_extractor-icon' },
  { appId: 'lookup_table', name: 'Lookup Table', actions: lookupTableActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-lookup_table-icon' },
  { appId: 'number_formatter', name: 'Number Formatter', actions: numberFormatterActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-number_formatter-icon' },
  { appId: 'connect_manager', name: 'Connect Manager', actions: connectManagerActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-connect_manager-icon' },
  { appId: 'hook', name: 'Hook', actions: hookActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-hook-icon' },
  { appId: 'subscription_billing', name: 'Subscription Billing', actions: subscriptionBillingActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-subscription_billing-icon' },
  { appId: 'router', name: 'Router', actions: routerActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-router-icon' },
  { appId: 'select_transform_json', name: 'Select Transform JSON', actions: selectTransformJsonActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-select_transform_json-icon' },
  { appId: 'text_formatter', name: 'Text Formatter', actions: textFormatterActions, category: 'Core Apps', connectionType: 'internal', iconColor: 'text-sabflow-text_formatter-icon' },

  // External Apps
  {
    appId: 'google_sheets',
    name: 'Google Sheets',
    category: 'Productivity',
    description: "Connect Google Sheets by sending data to your flow's webhook URL from an Apps Script trigger.",
    connectionType: 'webhook',
    iconColor: 'text-sabflow-google_sheets-icon',
    actions: googleSheetsActions,
  },
  {
    appId: 'stripe',
    name: 'Stripe',
    category: 'Payment',
    description: "Connect your Stripe account to create customers, manage subscriptions, and process payments.",
    connectionType: 'apikey',
    credentials: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
    iconColor: 'text-sabflow-stripe-icon',
    setupGuide: `
**How to Connect Stripe:**
1. Log in to your Stripe Dashboard.
2. Go to **Developers > API Keys**.
3. Create a **Restricted Key** with "Read" access to Payments and Customers.
4. Copy the key and paste it here.
`,
    actions: [
      {
        name: 'onPaymentSuccess',
        label: 'Payment Successful',
        description: 'Triggers when a payment succeeds.',
        isTrigger: true,
        outputs: [
          { name: 'amount', label: 'Amount', type: 'number' },
          { name: 'currency', label: 'Currency', type: 'text' },
          { name: 'customerEmail', label: 'Customer Email', type: 'text' },
          { name: 'paymentIntentId', label: 'Payment Intent ID', type: 'text' }
        ]
      },
      {
        name: 'createCustomer',
        label: 'Create Customer',
        description: 'Creates a new customer in Stripe.',
        inputs: [
          { name: 'email', label: 'Email', type: 'text', required: true },
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
        ],
        outputs: [
          { name: 'customerId', label: 'Customer ID', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' },
        ],
      },
      {
        name: 'getCustomer',
        label: 'Get Customer',
        description: 'Retrieves a Stripe customer by ID.',
        inputs: [
          { name: 'customerId', label: 'Customer ID', type: 'text', required: true },
        ],
        outputs: [
          { name: 'customer', label: 'Customer', type: 'text' },
        ],
      },
      {
        name: 'createPaymentLink',
        label: 'Create Payment Link',
        description: 'Creates a shareable Stripe payment link for a price ID.',
        inputs: [
          { name: 'priceId', label: 'Price ID', type: 'text', required: true, placeholder: 'price_...' },
          { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '1' },
        ],
        outputs: [
          { name: 'url', label: 'Payment URL', type: 'text' },
          { name: 'id', label: 'Link ID', type: 'text' },
        ],
      },
      {
        name: 'createInvoice',
        label: 'Create Invoice',
        description: 'Creates a draft invoice for an existing customer.',
        inputs: [
          { name: 'customerId', label: 'Customer ID', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'text' },
        ],
        outputs: [
          { name: 'invoiceId', label: 'Invoice ID', type: 'text' },
        ],
      },
      {
        name: 'refundPayment',
        label: 'Refund Payment',
        description: 'Issues a refund for a payment intent.',
        inputs: [
          { name: 'paymentIntentId', label: 'Payment Intent ID', type: 'text', required: true },
          { name: 'amount', label: 'Amount (smallest unit)', type: 'number' },
        ],
        outputs: [
          { name: 'refundId', label: 'Refund ID', type: 'text' },
          { name: 'status', label: 'Status', type: 'text' },
        ],
      },
    ]
  },
  {
    appId: 'shopify',
    name: 'Shopify',
    category: 'E-Commerce',
    description: "Connect your Shopify store to manage customers, orders, and products.",
    connectionType: 'apikey',
    credentials: [
      { name: 'shopName', label: 'Shop Name', type: 'text', placeholder: 'your-store' },
      { name: 'accessToken', label: 'Admin API Access Token', type: 'password' },
    ],
    iconColor: 'text-sabflow-shopify-icon',
    setupGuide: `
**How to Connect Shopify:**
1. Go to **Settings > Apps and sales channels > Develop apps**.
2. Create an app and configure Admin API scopes (Orders: Read).
3. Install the app and reveal the **Admin API access token**.
4. Enter your Shop Name (e.g., my-store) and the Access Token.
`,
    actions: [
      {
        name: 'onOrderCreated',
        label: 'New Order',
        description: 'Triggers when a new order is created.',
        isTrigger: true,
        outputs: [
          { name: 'orderId', label: 'Order ID', type: 'text' },
          { name: 'orderNumber', label: 'Order Number', type: 'text' },
          { name: 'totalPrice', label: 'Total Price', type: 'number' },
          { name: 'customerEmail', label: 'Customer Email', type: 'text' }
        ]
      },
      {
        name: 'createProduct',
        label: 'Create Product',
        description: 'Creates a new product in Shopify.',
        inputs: [
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'bodyHtml', label: 'Description (HTML)', type: 'textarea' },
          { name: 'vendor', label: 'Vendor', type: 'text' },
          { name: 'price', label: 'Price', type: 'number', required: true },
          { name: 'sku', label: 'SKU', type: 'text' },
        ],
        outputs: [
          { name: 'productId', label: 'Product ID', type: 'text' },
          { name: 'handle', label: 'Handle', type: 'text' },
        ],
      },
      {
        name: 'getOrder',
        label: 'Get Order',
        description: 'Retrieves a Shopify order by ID.',
        inputs: [
          { name: 'orderId', label: 'Order ID', type: 'text', required: true },
        ],
        outputs: [
          { name: 'order', label: 'Order', type: 'text' },
        ],
      },
      {
        name: 'listProducts',
        label: 'List Products',
        description: 'Returns up to 50 products.',
        inputs: [
          { name: 'limit', label: 'Limit (1-50)', type: 'number', placeholder: '10' },
        ],
        outputs: [
          { name: 'products', label: 'Products', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
      {
        name: 'createCustomer',
        label: 'Create Customer',
        description: 'Creates a new Shopify customer.',
        inputs: [
          { name: 'email', label: 'Email', type: 'text', required: true },
          { name: 'firstName', label: 'First Name', type: 'text' },
          { name: 'lastName', label: 'Last Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
        ],
        outputs: [
          { name: 'customerId', label: 'Customer ID', type: 'text' },
        ],
      },
      {
        name: 'updateOrderStatus',
        label: 'Fulfill Order',
        description: 'Marks an order as fulfilled.',
        inputs: [
          { name: 'orderId', label: 'Order ID', type: 'text', required: true },
          { name: 'locationId', label: 'Location ID', type: 'text' },
        ],
        outputs: [
          { name: 'fulfillmentId', label: 'Fulfillment ID', type: 'text' },
        ],
      },
    ]
  },
  {
    appId: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: "Connect your Slack workspace to send messages to channels or users.",
    connectionType: 'oauth',
    iconColor: 'text-sabflow-slack-icon',
    setupGuide: `
**How to Connect Slack:**
1. Click the **Connect** button below.
2. A popup will open asking for permission to access your Slack workspace.
3. Select the channel you want to post to (optional, often handled per action).
4. Click **Allow**.
`,
    actions: [
      {
        name: 'onMessageReceived',
        label: 'New Channel Message',
        description: 'Triggers when a new message is posted to a channel.',
        isTrigger: true,
        outputs: [
          { name: 'user', label: 'User ID', type: 'text' },
          { name: 'channel', label: 'Channel ID', type: 'text' },
          { name: 'text', label: 'Message Text', type: 'text' },
          { name: 'ts', label: 'Timestamp', type: 'text' }
        ]
      },
      {
        name: 'sendMessage',
        label: 'Send Message',
        description: 'Send a message to a channel.',
        inputs: [
          { name: 'channel', label: 'Channel', type: 'text', required: true, placeholder: '#general or C01234' },
          { name: 'text', label: 'Message', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'ts', label: 'Timestamp', type: 'text' },
          { name: 'channel', label: 'Channel', type: 'text' },
        ],
      },
      {
        name: 'sendDirectMessage',
        label: 'Send DM',
        description: 'Opens a DM channel and sends a message to a user.',
        inputs: [
          { name: 'userId', label: 'User ID', type: 'text', required: true, placeholder: 'U01234' },
          { name: 'text', label: 'Message', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'ts', label: 'Timestamp', type: 'text' },
          { name: 'channel', label: 'DM Channel', type: 'text' },
        ],
      },
      {
        name: 'updateMessage',
        label: 'Update Message',
        description: 'Edits a previously sent Slack message.',
        inputs: [
          { name: 'channel', label: 'Channel', type: 'text', required: true },
          { name: 'ts', label: 'Message Timestamp', type: 'text', required: true },
          { name: 'text', label: 'New Text', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'ok', label: 'OK', type: 'text' },
        ],
      },
      {
        name: 'addReaction',
        label: 'Add Reaction',
        description: 'Adds an emoji reaction to a message.',
        inputs: [
          { name: 'channel', label: 'Channel', type: 'text', required: true },
          { name: 'ts', label: 'Message Timestamp', type: 'text', required: true },
          { name: 'emoji', label: 'Emoji Name', type: 'text', required: true, placeholder: 'thumbsup' },
        ],
        outputs: [
          { name: 'ok', label: 'OK', type: 'text' },
        ],
      },
      {
        name: 'listChannels',
        label: 'List Channels',
        description: 'Lists public channels in the workspace.',
        inputs: [],
        outputs: [
          { name: 'channels', label: 'Channels', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
    ]
  },
  {
    appId: 'gmail',
    name: 'Gmail',
    category: 'Email',
    description: "Connect your Gmail account to send and receive emails.",
    connectionType: 'oauth',
    setupGuide: `
**How to Connect Gmail:**
1. Click the **Connect** button below.
2. Sign in with your Google Account.
3. Grant SabFlow permission to view/manage your emails.
4. Once connected, your emails will trigger this flow.
`,
    actions: [
      {
        name: 'onEmailReceived',
        label: 'New Email',
        description: 'Triggers when a new email is received.',
        isTrigger: true,
        outputs: [
          { name: 'from', label: 'From', type: 'text' },
          { name: 'subject', label: 'Subject', type: 'text' },
          { name: 'snippet', label: 'Snippet', type: 'text' },
          { name: 'messageId', label: 'Message ID', type: 'text' }
        ]
      },
      {
        name: 'sendEmail',
        label: 'Send Email',
        description: 'Sends an email via the connected Gmail account.',
        inputs: [
          { name: 'to', label: 'To', type: 'text', required: true },
          { name: 'subject', label: 'Subject', type: 'text', required: true },
          { name: 'body', label: 'Body (plain text or HTML)', type: 'textarea', required: true },
          { name: 'cc', label: 'CC (comma-separated)', type: 'text' },
          { name: 'bcc', label: 'BCC (comma-separated)', type: 'text' },
        ],
        outputs: [
          { name: 'messageId', label: 'Message ID', type: 'text' },
          { name: 'threadId', label: 'Thread ID', type: 'text' },
        ],
      },
      {
        name: 'listMessages',
        label: 'List Messages',
        description: 'Returns recent Gmail messages matching a query.',
        inputs: [
          { name: 'query', label: 'Gmail Search Query', type: 'text', placeholder: 'from:example.com is:unread' },
          { name: 'maxResults', label: 'Max Results', type: 'number', placeholder: '10' },
        ],
        outputs: [
          { name: 'messages', label: 'Messages', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
      {
        name: 'getMessage',
        label: 'Get Message',
        description: 'Retrieves a full Gmail message by ID.',
        inputs: [
          { name: 'messageId', label: 'Message ID', type: 'text', required: true },
        ],
        outputs: [
          { name: 'message', label: 'Message', type: 'text' },
        ],
      },
      {
        name: 'markAsRead',
        label: 'Mark as Read',
        description: 'Removes the UNREAD label from a Gmail message.',
        inputs: [
          { name: 'messageId', label: 'Message ID', type: 'text', required: true },
        ],
        outputs: [
          { name: 'success', label: 'Success', type: 'text' },
        ],
      },
    ]
  },
  {
    appId: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: "Connect your HubSpot account to sync contacts, deals, and companies.",
    connectionType: 'apikey',
    credentials: [
      { name: 'accessToken', label: 'Private App Access Token', type: 'password' },
    ],
    setupGuide: `
**How to Connect HubSpot:**
1. Go to **Settings > Integrations > Private Apps**.
2. Create a new Private App.
3. Select scopes (CRM > Contacts > Read).
4. copy the **Access Token** and paste it here.
`,
    actions: [
      {
        name: 'onContactCreated',
        label: 'New Contact',
        description: 'Triggers when a new contact is created.',
        isTrigger: true,
        outputs: [
          { name: 'contactId', label: 'Contact ID', type: 'text' },
          { name: 'firstname', label: 'First Name', type: 'text' },
          { name: 'lastname', label: 'Last Name', type: 'text' },
          { name: 'email', label: 'Email', type: 'text' }
        ]
      },
      {
        name: 'createContact',
        label: 'Create Contact',
        description: 'Creates a new contact in HubSpot.',
        inputs: [
          { name: 'email', label: 'Email', type: 'text', required: true },
          { name: 'firstname', label: 'First Name', type: 'text' },
          { name: 'lastname', label: 'Last Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
          { name: 'company', label: 'Company', type: 'text' },
        ],
        outputs: [
          { name: 'contactId', label: 'Contact ID', type: 'text' },
        ],
      },
      {
        name: 'updateContact',
        label: 'Update Contact',
        description: 'Updates properties on an existing HubSpot contact.',
        inputs: [
          { name: 'contactId', label: 'Contact ID', type: 'text', required: true },
          { name: 'firstname', label: 'First Name', type: 'text' },
          { name: 'lastname', label: 'Last Name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'text' },
        ],
        outputs: [
          { name: 'contactId', label: 'Contact ID', type: 'text' },
        ],
      },
      {
        name: 'getContactByEmail',
        label: 'Find Contact by Email',
        description: 'Searches HubSpot contacts by email.',
        inputs: [
          { name: 'email', label: 'Email', type: 'text', required: true },
        ],
        outputs: [
          { name: 'contact', label: 'Contact', type: 'text' },
          { name: 'found', label: 'Found', type: 'text' },
        ],
      },
      {
        name: 'createDeal',
        label: 'Create Deal',
        description: 'Creates a new deal in HubSpot.',
        inputs: [
          { name: 'dealname', label: 'Deal Name', type: 'text', required: true },
          { name: 'amount', label: 'Amount', type: 'number' },
          { name: 'pipeline', label: 'Pipeline ID', type: 'text' },
          { name: 'dealstage', label: 'Stage', type: 'text' },
        ],
        outputs: [
          { name: 'dealId', label: 'Deal ID', type: 'text' },
        ],
      },
      {
        name: 'addNote',
        label: 'Add Note',
        description: 'Adds a note to a HubSpot contact.',
        inputs: [
          { name: 'contactId', label: 'Contact ID', type: 'text', required: true },
          { name: 'note', label: 'Note Content', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'noteId', label: 'Note ID', type: 'text' },
        ],
      },
    ]
  },
  {
    appId: 'discord',
    name: 'Discord',
    category: 'Communication',
    description: "Connect your Discord server to send messages and manage roles.",
    connectionType: 'oauth',
    iconColor: 'text-sabflow-discord-icon',
    setupGuide: `
**How to Connect Discord:**
1. Click **Connect** to authorize the SabFlow Bot.
2. Select the server you want to add the bot to.
3. Ensure the bot has "Read Messages" and "Send Messages" permissions.
`,
    actions: [
      {
        name: 'onMessageReceived',
        label: 'New Channel Message',
        description: 'Triggers when a new message is posted to a channel.',
        isTrigger: true,
        outputs: [
          { name: 'channelId', label: 'Channel ID', type: 'text' },
          { name: 'authorname', label: 'Author Name', type: 'text' },
          { name: 'content', label: 'Message Text', type: 'text' },
          { name: 'messageId', label: 'Message ID', type: 'text' }
        ]
      },
      {
        name: 'sendMessage',
        label: 'Send Message',
        description: 'Sends a message to a Discord channel.',
        inputs: [
          { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'messageId', label: 'Message ID', type: 'text' },
        ],
      },
      {
        name: 'sendEmbed',
        label: 'Send Embed',
        description: 'Sends an embedded rich message.',
        inputs: [
          { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'color', label: 'Color (decimal)', type: 'number', placeholder: '5814783' },
          { name: 'url', label: 'URL', type: 'text' },
        ],
        outputs: [
          { name: 'messageId', label: 'Message ID', type: 'text' },
        ],
      },
      {
        name: 'sendWebhook',
        label: 'Send via Webhook',
        description: 'Posts a message to a Discord webhook URL (no bot token required).',
        inputs: [
          { name: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true },
          { name: 'content', label: 'Content', type: 'textarea', required: true },
          { name: 'username', label: 'Override Username', type: 'text' },
        ],
        outputs: [
          { name: 'ok', label: 'OK', type: 'text' },
        ],
      },
      {
        name: 'createThread',
        label: 'Create Thread',
        description: 'Creates a new thread in a channel.',
        inputs: [
          { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
          { name: 'name', label: 'Thread Name', type: 'text', required: true },
        ],
        outputs: [
          { name: 'threadId', label: 'Thread ID', type: 'text' },
        ],
      },
    ]
  },
  {
    appId: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: "Connect your Notion workspace to create pages and database entries.",
    connectionType: 'oauth',
    iconColor: 'text-sabflow-notion-icon',
    setupGuide: `
**How to Connect Notion:**
1. Click **Connect** to open the Notion authorization page.
2. Select the pages/databases you want SabFlow to access.
3. Click **Allow Access**.
`,
    actions: [
      {
        name: 'onDatabaseItemCreated',
        label: 'New Database Item',
        description: 'Triggers when a new item is created in a database.',
        isTrigger: true,
        outputs: [
          { name: 'databaseId', label: 'Database ID', type: 'text' },
          { name: 'pageId', label: 'Page ID', type: 'text' },
          { name: 'title', label: 'Page Title', type: 'text' },
          { name: 'url', label: 'Page URL', type: 'text' }
        ]
      },
      {
        name: 'createPage',
        label: 'Create Database Page',
        description: 'Creates a new page in a Notion database.',
        inputs: [
          { name: 'databaseId', label: 'Database ID', type: 'text', required: true },
          { name: 'title', label: 'Page Title', type: 'text', required: true },
          { name: 'titleProperty', label: 'Title Property Name', type: 'text', placeholder: 'Name' },
        ],
        outputs: [
          { name: 'pageId', label: 'Page ID', type: 'text' },
          { name: 'url', label: 'Page URL', type: 'text' },
        ],
      },
      {
        name: 'updatePage',
        label: 'Update Page',
        description: 'Archives or updates page properties.',
        inputs: [
          { name: 'pageId', label: 'Page ID', type: 'text', required: true },
          { name: 'archived', label: 'Archive?', type: 'text', placeholder: 'true or false' },
        ],
        outputs: [
          { name: 'pageId', label: 'Page ID', type: 'text' },
        ],
      },
      {
        name: 'queryDatabase',
        label: 'Query Database',
        description: 'Returns pages from a Notion database.',
        inputs: [
          { name: 'databaseId', label: 'Database ID', type: 'text', required: true },
          { name: 'pageSize', label: 'Page Size (1-100)', type: 'number', placeholder: '20' },
        ],
        outputs: [
          { name: 'pages', label: 'Pages', type: 'text' },
          { name: 'count', label: 'Count', type: 'number' },
        ],
      },
      {
        name: 'appendBlock',
        label: 'Append Text Block',
        description: 'Appends a paragraph block to a page.',
        inputs: [
          { name: 'pageId', label: 'Page ID', type: 'text', required: true },
          { name: 'text', label: 'Text', type: 'textarea', required: true },
        ],
        outputs: [
          { name: 'ok', label: 'OK', type: 'text' },
        ],
      },
    ]
  }
];
