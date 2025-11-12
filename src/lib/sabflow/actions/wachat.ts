
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
import type { WithId, User, Project } from '@/lib/definitions';
import FormData from 'form-data';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

async function getProjectAndContact(projectId: string, waId: string) {
    const project = await getProjectById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    
    const contactResult = await findOrCreateContact(projectId, project.phoneNumbers[0].id, waId);
    if (contactResult.error || !contactResult.contact) {
        throw new Error(contactResult.error || 'Could not find or create contact.');
    }
    return { project, contact: contactResult.contact };
}

export async function executeWachatAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { projectId, to, ...restInputs } = inputs;
        if (!projectId) throw new Error("Wachat actions require a 'projectId' to be selected.");

        const { project, contact } = await getProjectAndContact(projectId, to);
        const phoneNumberId = contact.phoneNumberId || project.phoneNumbers[0]?.id;
        
        if (!phoneNumberId) {
            throw new Error(`No valid phone number found for project ${project.name} to execute action.`);
        }

        const formData = new FormData();
        Object.keys(inputs).forEach(key => formData.append(key, inputs[key]));
        formData.append('contactId', contact._id.toString());
        formData.append('phoneNumberId', phoneNumberId);
        formData.append('waId', to);

        switch (actionName) {
            case 'sendMessage': {
                formData.append('messageText', inputs.message);
                const result = await handleSendMessage(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'sendTemplate': {
                 const result = await handleSendTemplateMessage(null, formData);
                 if (result.error) throw new Error(result.error);
                 return { output: result };
            }
            case 'sendImage':
            case 'sendVideo':
            case 'sendDocument': {
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
                 if (result.error) throw new Error(result.error);
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
                // This will need a dedicated implementation in webhook processor or similar
                logger.log('Triggering flow is a complex action that needs to be handled by the main processor.');
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
