
'use server';

import {
    handleSendMessage,

    findOrCreateContact,
    getConversation,
    markConversationAsRead,
    markConversationAsUnread,
} from '@/app/actions/whatsapp.actions';
import { handleAddNewContact, updateContactTags, handleUpdateContactDetails, handleUpdateContactStatus } from '@/app/actions/contact.actions';
// import { handleUpdateContactDetails, handleUpdateContactStatus } from '@/app/actions/project.actions'; // REMOVED
import { handleRequestWhatsAppPayment } from '@/app/actions/whatsapp.actions';
import { handlePaymentRequest } from '@/app/actions/integrations.actions';
import { getProjectByIdSystem } from '@/app/actions/project.actions';
import type { WithId, User, Project, Contact } from '@/lib/definitions';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { handleSendTemplateMessage } from '@/app/actions/send-template.actions';

const API_VERSION = 'v23.0';

async function getProjectAndContact(projectId: string, waId: string) {
    const project = await getProjectByIdSystem(projectId); // Using system access
    if (!project) {
        throw new Error(`Project with ID ${projectId} not found or access denied.`);
    }

    const phoneNumberId = project.phoneNumbers?.[0]?.id;
    if (!phoneNumberId) {
        throw new Error(`Project ${project.name} has no configured phone numbers.`);
    }

    const contactResult = await findOrCreateContact(projectId, phoneNumberId, waId, project);
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

        switch (actionName) {
            case 'sendMessage': {
                if (!inputs.message) throw new Error("Input 'message' is required.");
                const data = {
                    contactId: contact._id.toString(),
                    projectId: projectId,
                    phoneNumberId: phoneNumberId,
                    waId: to,
                    messageText: inputs.message
                };

                const result = await handleSendMessage(null, data, project);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'sendTemplate': {
                if (!inputs.templateId) throw new Error("Input 'templateId' is required.");
                const data = {
                    ...inputs,
                    contactId: contact._id.toString(),
                    phoneNumberId: phoneNumberId,
                    waId: to,
                };

                const result = await handleSendTemplateMessage(null, data, project);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'sendImage':
            case 'sendVideo':
            case 'sendDocument':
            case 'sendAudio':
            case 'sendSticker': {
                let mediaFile: { content: string; name: string; type: string };

                if (inputs.imageBase64) {
                    const matches = inputs.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        mediaFile = {
                            type: matches[1],
                            content: matches[2],
                            name: inputs.filename || 'media',
                        };
                    } else {
                        // Assume raw base64 if no data URI scheme, default to png/generic if unknown
                        mediaFile = {
                            type: 'image/png',
                            content: inputs.imageBase64,
                            name: inputs.filename || 'media',
                        };
                    }
                } else if (inputs.mediaUrl) {
                    const mediaResponse = await axios.get(inputs.mediaUrl, { responseType: 'arraybuffer' });
                    const contentType = mediaResponse.headers['content-type'] || 'application/octet-stream';
                    const base64Content = Buffer.from(mediaResponse.data).toString('base64');

                    mediaFile = {
                        content: base64Content,
                        name: inputs.filename || 'media',
                        type: contentType
                    };
                } else {
                    throw new Error('Media URL or Base64 data is required.');
                }

                const data = {
                    mediaFile,
                    messageText: inputs.caption || '',
                    contactId: contact._id.toString(),
                    projectId: projectId,
                    phoneNumberId: phoneNumberId,
                    waId: to,
                };

                const result = await handleSendMessage(null, data, project);
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
                const formData = new FormData();
                formData.append('projectId', projectId);
                formData.append('phoneNumberId', phoneNumberId);
                formData.append('name', inputs.name);
                formData.append('waId', inputs.waId);
                const result = await handleAddNewContact(null, formData, user);
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
            case 'sendListMessage': {
                if (!inputs.body || !inputs.buttonText || !inputs.sections) throw new Error('Body, Button Text, and Sections are required.');

                let sections = [];
                try {
                    sections = typeof inputs.sections === 'string' ? JSON.parse(inputs.sections) : inputs.sections;
                } catch (e) {
                    throw new Error('Invalid JSON format for Sections.');
                }

                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'list',
                        header: inputs.header ? { type: 'text', text: inputs.header } : undefined,
                        body: { text: inputs.body },
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            button: inputs.buttonText,
                            sections: sections
                        }
                    }
                };

                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true, wamid: response.data.messages?.[0]?.id } };
            }
            case 'sendButtonMessage': {
                if (!inputs.body || !inputs.buttons) throw new Error('Body and Buttons are required.');

                let buttons = [];
                try {
                    buttons = typeof inputs.buttons === 'string' ? JSON.parse(inputs.buttons) : inputs.buttons;
                } catch (e) {
                    throw new Error('Invalid JSON format for Buttons.');
                }

                if (buttons.length > 3) throw new Error('Maximum 3 buttons allowed.');

                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        header: inputs.header ? { type: 'text', text: inputs.header } : undefined,
                        body: { text: inputs.body },
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            buttons: buttons
                        }
                    }
                };

                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true, wamid: response.data.messages?.[0]?.id } };
            }
            case 'reactToMessage': {
                if (!inputs.messageId || !inputs.emoji) throw new Error('Message ID and Emoji are required.');

                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'reaction',
                    reaction: {
                        message_id: inputs.messageId,
                        emoji: inputs.emoji
                    }
                };

                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true } };
            }
            case 'addContactTag':
            case 'removeContactTag': {
                if (!inputs.tagId) throw new Error('Tag ID is required.');
                const targetTagId = String(inputs.tagId);
                const currentTags: any[] = contact.tagIds || [];
                // Normalize to string IDs for safe comparison (handles ObjectId vs string mismatch)
                const currentStringTags = currentTags.map((t: any) => String(t));
                let newTags: string[];
                if (actionName === 'addContactTag') {
                    newTags = Array.from(new Set([...currentStringTags, targetTagId]));
                } else {
                    newTags = currentStringTags.filter((t: string) => t !== targetTagId);
                }
                const result = await updateContactTags(contact._id.toString(), newTags);
                if (!result.success) throw new Error(result.error);
                return { output: { success: true, tags: newTags } };
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
                return { output: { message: 'Flow trigger initiated.' } };
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
            case 'sendProduct': {
                if (!inputs.catalogId || !inputs.productRetailerId) throw new Error('Catalog ID and Product SKU are required.');
                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'product',
                        body: inputs.body ? { text: inputs.body } : undefined,
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            catalog_id: inputs.catalogId,
                            product_retailer_id: inputs.productRetailerId
                        }
                    }
                };
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true } };
            }
            case 'sendProductList': {
                if (!inputs.header || !inputs.body || !inputs.catalogId || !inputs.sections) throw new Error('Header, Body, Catalog ID, and Sections are required.');
                let sections = [];
                try {
                    sections = typeof inputs.sections === 'string' ? JSON.parse(inputs.sections) : inputs.sections;
                } catch (e) { throw new Error('Invalid JSON for sections'); }

                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'product_list',
                        header: { type: 'text', text: inputs.header },
                        body: { text: inputs.body },
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            catalog_id: inputs.catalogId,
                            sections: sections
                        }
                    }
                };
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true } };
            }
            case 'sendCatalog': {
                if (!inputs.body || !inputs.thumbnailProductRetailerId) throw new Error('Body and Thumbnail Product SKU are required.');
                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'catalog_message',
                        body: { text: inputs.body },
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            name: 'catalog_message',
                            parameters: {
                                thumbnail_product_retailer_id: inputs.thumbnailProductRetailerId
                            }
                        }
                    }
                };
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true } };
            }
            case 'replyToMessage': {
                if (!inputs.message || !inputs.contextMessageId) throw new Error('Message and Context ID are required.');
                const payload = {
                    messaging_product: 'whatsapp',
                    to: to,
                    context: { message_id: inputs.contextMessageId },
                    type: 'text',
                    text: { body: inputs.message }
                };
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
                return { output: { success: true } };
            }
            case 'markAsUnread': {
                const result = await markConversationAsUnread(contact._id.toString());
                if (!result.success) throw new Error('Failed to mark as unread.');
                return { output: { success: true } };
            }
            default:
                throw new Error(`Wachat action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Wachat Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        if (e.response && e.response.data) {
            logger.log('Meta API Error Details (SabFlow):', { errorData: e.response.data });
            console.error('Meta API Error Details (SabFlow):', JSON.stringify(e.response.data, null, 2));
        }
        return { error: e.message };
    }
}
