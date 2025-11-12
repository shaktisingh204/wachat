
'use server';

import {
    handleSendMessage,
    handleSendTemplateMessage,
    findOrCreateContact,
    getConversation,
    markConversationAsRead,
} from '@/app/actions/whatsapp.actions';
import { handleAddNewContact, updateContactTags } from '@/app/actions/contact.actions';
import { handleUpdateContactDetails, handleUpdateContactStatus } from '@/app/actions/project.actions';
import { handleRequestWhatsAppPayment } from '@/app/actions/whatsapp.actions';
import { handlePaymentRequest } from '@/app/actions/integrations.actions';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, User, Project, Contact } from '@/lib/definitions';
import FormData from 'form-data';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

async function getProjectAndContact(projectId: string, waId: string) {
    const project = await getProjectById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    
    // Ensure the project has at least one phone number to proceed
    const phoneNumberId = project.phoneNumbers?.[0]?.id;
    if (!phoneNumberId) {
        throw new Error(`Project ${project.name} has no configured phone numbers.`);
    }

    const contactResult = await findOrCreateContact(projectId, phoneNumberId, waId);
    if (contactResult.error || !contactResult.contact) {
        throw new Error(contactResult.error || 'Could not find or create contact.');
    }
    return { project, contact: contactResult.contact };
}

export async function executeWachatAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { projectId, to, ...restInputs } = inputs;
        if (!projectId) throw new Error("Wachat actions require a 'projectId' to be selected.");
        if (!to) throw new Error("A 'To' phone number (waId) is required for most Wachat actions.");

        const { project, contact } = await getProjectAndContact(projectId, to);
        const phoneNumberId = contact.phoneNumberId || project.phoneNumbers[0]?.id;
        
        if (!phoneNumberId) {
            throw new Error(`No valid phone number found for project ${project.name} to execute action.`);
        }

        const formData = new FormData();
        Object.keys(inputs).forEach(key => {
             if (inputs[key] !== undefined && inputs[key] !== null) {
                formData.append(key, String(inputs[key]));
            }
        });
        formData.append('contactId', contact._id.toString());
        formData.append('phoneNumberId', phoneNumberId);
        formData.append('waId', to);

        switch (actionName) {
            case 'sendMessage': {
                if (!inputs.message) throw new Error("Input 'message' is required.");
                formData.append('messageText', inputs.message);
                const result = await handleSendMessage(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'sendTemplate': {
                 if (!inputs.templateId) throw new Error("Input 'templateId' is required.");
                 const result = await handleSendTemplateMessage(null, formData);
                 if (result.error) throw new Error(result.error);
                 return { output: result };
            }
            case 'sendImage':
            case 'sendVideo':
            case 'sendDocument':
            case 'sendAudio':
            case 'sendSticker': {
                 const mediaUrl = inputs.mediaUrl;
                 if (!mediaUrl) throw new Error('Media URL is required.');

                 const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                 const buffer = Buffer.from(mediaResponse.data);
                 const contentType = mediaResponse.headers['content-type'] || 'application/octet-stream';
                 
                 const mediaFormData = new FormData();
                 mediaFormData.append('mediaFile', buffer, { contentType, filename: inputs.filename || 'media' });
                 mediaFormData.append('messageText', inputs.caption || '');
                 mediaFormData.append('contactId', contact._id.toString());
                 mediaFormData.append('projectId', projectId);
                 mediaFormData.append('phoneNumberId', phoneNumberId);
                 mediaFormData.append('waId', to);

                 const result = await handleSendMessage(null, mediaFormData);
                 if (result.error) throw new Error(result.error);
                 return { output: result };
            }
            case 'sendLocation': {
                 if (!inputs.latitude || !inputs.longitude) throw new Error('Latitude and Longitude are required.');
                 const payload = {
                    messaging_product: 'whatsapp', to, type: 'location',
                    location: { latitude: inputs.latitude, longitude: inputs.longitude, name: inputs.name, address: inputs.address }
                 };
                 await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                 return { output: { success: true } };
            }
            case 'sendContact': {
                 if (!inputs.contactName || !inputs.contactPhone) throw new Error('Contact Name and Phone are required.');
                 const payload = {
                    messaging_product: 'whatsapp', to, type: 'contacts',
                    contacts: [{ name: { formatted_name: inputs.contactName, first_name: inputs.contactName }, phones: [{ phone: inputs.contactPhone, type: 'CELL' }] }]
                 };
                 await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                 return { output: { success: true } };
            }
            case 'createContact': {
                const contactFormData = new FormData();
                contactFormData.append('projectId', projectId);
                contactFormData.append('phoneNumberId', phoneNumberId);
                contactFormData.append('name', inputs.name);
                contactFormData.append('waId', inputs.waId);
                const result = await handleAddNewContact(null, contactFormData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'updateContact': {
                 const variables = JSON.parse(inputs.variables || '{}');
                 const updateFormData = new FormData();
                 updateFormData.append('contactId', contact._id.toString());
                 updateFormData.append('variables', JSON.stringify(variables));
                 const result = await handleUpdateContactDetails(null, updateFormData);
                 if (!result.success) throw new Error(result.error);
                 return { output: result };
            }
            case 'addContactTag':
            case 'removeContactTag': {
                if (!inputs.tagId) throw new Error('Tag ID is required.');
                const currentTags = contact.tagIds || [];
                let newTags;
                if (actionName === 'addContactTag') {
                    newTags = [...new Set([...currentTags, inputs.tagId])];
                } else {
                    newTags = currentTags.filter(t => t !== inputs.tagId);
                }
                const result = await updateContactTags(contact._id.toString(), newTags);
                if (!result.success) throw new Error(result.error);
                return { output: { success: true, tags: newTags }};
            }
             case 'getContact': {
                return { output: { contact: JSON.parse(JSON.stringify(contact)) } };
            }
            case 'getConversation': {
                const messages = await getConversation(contact._id.toString());
                return { output: { messages: JSON.parse(JSON.stringify(messages)) } };
            }
            case 'markAsRead': {
                const result = await markConversationAsRead(contact._id.toString());
                if (!result.success) throw new Error('Failed to mark as read.');
                return { output: { success: true } };
            }
            case 'assignAgent': {
                const result = await handleUpdateContactStatus(contact._id.toString(), contact.status || 'open', inputs.agentId);
                 if (!result.success) throw new Error(result.error);
                return { output: { success: true } };
            }
            case 'changeConversationStatus': {
                 const result = await handleUpdateContactStatus(contact._id.toString(), inputs.status, contact.assignedAgentId || '');
                 if (!result.success) throw new Error(result.error);
                return { output: { success: true } };
            }
            case 'triggerFlow': {
                logger.log('Triggering flow is a complex action handled by the main processor. This action is a placeholder.');
                return { output: { message: 'Flow trigger initiated.' }};
            }
             case 'requestRazorpayPayment': {
                 const paymentFormData = new FormData();
                 paymentFormData.append('contactId', contact._id.toString());
                 paymentFormData.append('amount', inputs.amount);
                 paymentFormData.append('description', inputs.description);
                 const result = await handlePaymentRequest(null, paymentFormData);
                 if (result.error) throw new Error(result.error);
                 return { output: result };
            }
             case 'requestWaPayPayment': {
                 const paymentFormData = new FormData();
                 paymentFormData.append('contactId', contact._id.toString());
                 paymentFormData.append('amount', inputs.amount);
                 paymentFormData.append('description', inputs.description);
                 const result = await handleRequestWhatsAppPayment(null, paymentFormData);
                 if (result.error) throw new Error(result.error);
                 return { output: result };
            }
            default:
                throw new Error(`Wachat action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        logger.log(`Wachat Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: e.message };
    }
}

export const wachatActions = [
    {
        name: 'sendMessage',
        label: 'Send Text Message',
        description: 'Sends a simple text message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', placeholder: 'e.g., 919876543210', required: true },
            { name: 'message', label: 'Message Text', type: 'textarea', required: true },
        ]
    },
    {
        name: 'sendTemplate',
        label: 'Send Template Message',
        description: 'Sends a pre-approved message template.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'templateId', label: 'Template ID', type: 'text', required: true },
        ]
    },
    {
        name: 'sendImage',
        label: 'Send Image',
        description: 'Sends an image message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Image URL', type: 'text', required: true },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
    {
        name: 'sendVideo',
        label: 'Send Video',
        description: 'Sends a video message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Video URL', type: 'text', required: true },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
    {
        name: 'sendDocument',
        label: 'Send Document',
        description: 'Sends a document.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Document URL', type: 'text', required: true },
            { name: 'filename', label: 'Filename (Optional)', type: 'text' },
            { name: 'caption', label: 'Caption (Optional)', type: 'text' },
        ]
    },
     {
        name: 'sendAudio',
        label: 'Send Audio',
        description: 'Sends an audio message.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Audio URL', type: 'text', required: true },
        ]
    },
    {
        name: 'sendSticker',
        label: 'Send Sticker',
        description: 'Sends a sticker.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'mediaUrl', label: 'Sticker URL', type: 'text', required: true },
        ]
    },
    {
        name: 'sendLocation',
        label: 'Send Location',
        description: 'Sends a map location.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'latitude', label: 'Latitude', type: 'number', required: true },
            { name: 'longitude', label: 'Longitude', type: 'number', required: true },
            { name: 'name', label: 'Location Name', type: 'text' },
            { name: 'address', label: 'Address', type: 'text' },
        ]
    },
    {
        name: 'sendContact',
        label: 'Send Contact Card',
        description: 'Sends a contact card.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'contactName', label: 'Contact\'s Full Name', type: 'text', required: true },
            { name: 'contactPhone', label: 'Contact\'s Phone Number', type: 'tel', required: true },
        ]
    },
    {
        name: 'createContact',
        label: 'Create Contact',
        description: 'Creates a new contact in Wachat.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'waId', label: 'WhatsApp ID', type: 'text', required: true },
        ]
    },
    {
        name: 'updateContact',
        label: 'Update Contact Variables',
        description: 'Updates custom attributes for a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'variables', label: 'Variables (JSON)', type: 'textarea', placeholder: '{"membership_level": "gold"}', required: true },
        ]
    },
    {
        name: 'addContactTag',
        label: 'Add Tag to Contact',
        description: 'Adds a specific tag to a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
    {
        name: 'removeContactTag',
        label: 'Remove Tag from Contact',
        description: 'Removes a specific tag from a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'tagId', label: 'Tag ID', type: 'text', required: true },
        ]
    },
     {
        name: 'getContact',
        label: 'Get Contact Details',
        description: 'Retrieves all information for a specific contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'getConversation',
        label: 'Get Conversation History',
        description: 'Retrieves the recent message history for a contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'markAsRead',
        label: 'Mark Conversation as Read',
        description: 'Marks a contact\'s conversation as read.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
        ]
    },
    {
        name: 'assignAgent',
        label: 'Assign Agent to Conversation',
        description: 'Assigns a team member to a conversation.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'agentId', label: 'Agent User ID', type: 'text', required: true },
        ]
    },
    {
        name: 'changeConversationStatus',
        label: 'Change Conversation Status',
        description: 'Updates the status of a conversation (e.g., open, resolved).',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'status', label: 'New Status', type: 'text', required: true },
        ]
    },
    {
        name: 'triggerFlow',
        label: 'Trigger Another Flow',
        description: 'Starts another Wachat flow for the contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'flowId', label: 'Flow ID', type: 'text', required: true },
        ]
    },
    {
        name: 'requestRazorpayPayment',
        label: 'Request Razorpay Payment',
        description: 'Sends a Razorpay payment link to the contact.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
    {
        name: 'requestWaPayPayment',
        label: 'Request WhatsApp Pay',
        description: 'Sends a native WhatsApp Pay request.',
        inputs: [
            { name: 'projectId', label: 'Wachat Project', type: 'project-selector', required: true },
            { name: 'to', label: 'To (waId)', type: 'text', required: true },
            { name: 'amount', label: 'Amount (INR)', type: 'number', required: true },
            { name: 'description', label: 'Description', type: 'text', required: true },
        ]
    },
];
