
export const wachatActions = [
    {
        name: 'sendMessage',
        label: 'Send Text Message',
        description: 'Sends a simple text message to a WhatsApp number.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', placeholder: 'e.g., 919876543210 or {{trigger.phone}}', required: true },
            { name: 'message', label: 'Message Text', type: 'textarea', required: true },
        ]
    },
    {
        name: 'sendTemplate',
        label: 'Send Template Message',
        description: 'Sends a pre-approved WhatsApp message template.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'templateName', label: 'Template Name', type: 'text', required: true },
            { name: 'languageCode', label: 'Language Code', type: 'text', placeholder: 'e.g., en_US', required: true },
            { name: 'bodyVariables', label: 'Body Variables (JSON Array)', type: 'textarea', placeholder: '["John", "Order #123"]' },
            { name: 'headerVariables', label: 'Header Variables (JSON Array)', type: 'textarea', placeholder: '["https://example.com/image.png"]' },
        ]
    },
    {
        name: 'sendImage',
        label: 'Send Image',
        description: 'Sends an image with an optional caption.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'imageUrl', label: 'Image URL', type: 'text', placeholder: 'https://.../image.png', required: true },
            { name: 'caption', label: 'Caption', type: 'textarea' },
        ]
    },
    {
        name: 'sendVideo',
        label: 'Send Video',
        description: 'Sends a video with an optional caption.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'videoUrl', label: 'Video URL', type: 'text', placeholder: 'https://.../video.mp4', required: true },
            { name: 'caption', label: 'Caption', type: 'textarea' },
        ]
    },
    {
        name: 'sendDocument',
        label: 'Send Document',
        description: 'Sends a document with a caption and filename.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'documentUrl', label: 'Document URL', type: 'text', placeholder: 'https://.../file.pdf', required: true },
            { name: 'filename', label: 'Filename', type: 'text', placeholder: 'e.g., invoice.pdf' },
            { name: 'caption', label: 'Caption', type: 'textarea' },
        ]
    },
    {
        name: 'createContact',
        label: 'Create Contact',
        description: 'Creates a new contact in a specific Wachat project.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'name', label: 'Contact Name', type: 'text', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
        ]
    },
    {
        name: 'updateContact',
        label: 'Update Contact',
        description: 'Updates an existing contact\'s variables.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'variables', label: 'Variables (JSON)', type: 'textarea', placeholder: '{ "order_status": "shipped" }' },
        ]
    },
    {
        name: 'addContactTag',
        label: 'Add Tag to Contact',
        description: 'Adds a tag to a specified contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
    {
        name: 'removeContactTag',
        label: 'Remove Tag from Contact',
        description: 'Removes a tag from a specified contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
    {
        name: 'getContact',
        label: 'Get Contact Details',
        description: 'Retrieves details and variables for a specific contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
        ]
    },
    {
        name: 'assignAgent',
        label: 'Assign Agent to Conversation',
        description: 'Assigns a chat conversation to a specific agent.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'agentId', label: 'Agent User ID', type: 'text', required: true },
        ]
    },
    {
        name: 'changeConversationStatus',
        label: 'Change Conversation Status',
        description: 'Changes the status of a conversation (e.g., open, resolved).',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'status', label: 'New Status', type: 'text', placeholder: 'e.g., resolved', required: true },
        ]
    },
    {
        name: 'markAsRead',
        label: 'Mark Conversation as Read',
        description: 'Marks a conversation as read, clearing the unread count.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
        ]
    },
    {
        name: 'triggerFlow',
        label: 'Trigger Flow for Contact',
        description: 'Starts a specific Flow Builder flow for a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'waId', label: 'WhatsApp ID (Phone)', type: 'text', required: true },
            { name: 'flowId', label: 'Flow ID', type: 'text', required: true },
        ]
    },
    {
        name: 'triggerMetaFlow',
        label: 'Trigger Meta Flow',
        description: 'Sends an interactive Meta Flow to a user.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'metaFlowId', label: 'Meta Flow ID', type: 'text', required: true },
            { name: 'header', label: 'Header Text', type: 'text' },
            { name: 'body', label: 'Body Text', type: 'textarea' },
            { name: 'footer', label: 'Footer Text', type: 'text' },
        ]
    },
    {
        name: 'requestRazorpayPayment',
        label: 'Request Razorpay Payment',
        description: 'Generates and sends a Razorpay payment link.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
    {
        name: 'requestWaPayPayment',
        label: 'Request WhatsApp Pay',
        description: 'Initiates a WhatsApp Pay request.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
    {
        name: 'createShortLink',
        label: 'Create Short Link',
        description: 'Creates a trackable short link.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'longUrl', label: 'Original URL', type: 'text', required: true },
            { name: 'alias', label: 'Custom Alias (Optional)', type: 'text' },
        ]
    },
    {
        name: 'createQrCode',
        label: 'Generate QR Code',
        description: 'Generates a QR code for a given text or URL.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'data', label: 'Data to Encode', type: 'text', required: true },
            { name: 'name', label: 'QR Code Name', type: 'text', required: true },
        ]
    },
    {
        name: 'syncTemplates',
        label: 'Sync Templates',
        description: 'Fetches the latest templates from Meta for a project.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
        ]
    }
];

