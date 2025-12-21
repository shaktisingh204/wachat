
'use server';

import {
    handleSendMessage,
    
    findOrCreateContact,
    getConversation,
    markConversationAsRead,
} from '@/app/actions/whatsapp.actions';
import { handleAddNewContact, updateContactTags } from '@/app/actions/contact.actions';
import { handleUpdateContactDetails, handleUpdateContactStatus } from '@/app/actions/project.actions';
import { handleRequestWhatsAppPayment } from '@/app/actions/whatsapp.actions';
import { handlePaymentRequest } from '@/app/actions/integrations.actions';
import { getProjectById } from '@/lib/actions/user.actions';
import type { WithId, User, Project, Contact } from '@/lib/definitions';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { handleSendTemplateMessage } from './send-template.actions';

const API_VERSION = 'v23.0';

async function getProjectAndContact(projectId: string, waId: string) {
    const project = await getProjectById(projectId, null); // Pass null for system-level access
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
                 const mediaUrl = inputs.mediaUrl;
                 if (!mediaUrl) throw new Error('Media URL is required.');

                 const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                 const buffer = Buffer.from(mediaResponse.data);
                 const contentType = mediaResponse.headers['content-type'] || 'application/octet-stream';
                 
                 const data = {
                    mediaFile: new File([buffer], inputs.filename || 'media', { type: contentType }),
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
