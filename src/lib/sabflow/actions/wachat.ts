
export const wachatActions = [
    {
        name: 'sendMessage',
        label: 'Send WhatsApp Message',
        description: 'Sends a text message to a WhatsApp number.',
        inputs: [
            { name: 'to', label: 'Recipient Phone', type: 'text', placeholder: 'e.g., 919876543210 or {{trigger.phone}}', required: true },
            { name: 'message', label: 'Message Text', type: 'textarea', required: true },
        ]
    },
    {
        name: 'sendTemplate',
        label: 'Send WhatsApp Template',
        description: 'Sends a pre-approved WhatsApp message template.',
        inputs: [
            { name: 'to', label: 'Recipient Phone', type: 'text', required: true },
            { name: 'templateName', label: 'Template Name', type: 'text', required: true },
            { name: 'variables', label: 'Template Variables (JSON)', type: 'textarea', placeholder: '{ "1": "John", "2": "your order" }' },
        ]
    }
];
