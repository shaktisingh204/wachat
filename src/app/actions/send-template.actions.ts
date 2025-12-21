
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Contact, Template, OutgoingMessage, Project } from '@/lib/definitions';

export async function handleSendTemplateMessage(
    prevState: any, 
    data: { [key: string]: any }, 
    projectFromAction?: WithId<Project>
): Promise<{ message?: string; error?: string }> {
    const {
        contactId,
        templateId,
        mediaSource,
        headerMediaUrl,
        headerMediaFile, // This will be a base64 string or similar from the client
        ...variables
    } = data;

    if (!ObjectId.isValid(contactId) || !ObjectId.isValid(templateId)) {
        return { error: 'Invalid ID provided.' };
    }

    const { db } = await connectToDatabase();
    
    const [contact, template] = await Promise.all([
        db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) }),
        db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId) }),
    ]);
    
    if (!contact) return { error: 'Contact not found.' };
    const hasAccess = projectFromAction || await getProjectById(contact.projectId.toString(), contact.userId.toString());
    if (!hasAccess) return { error: 'Access Denied.' };
    if (!template) return { error: 'Template not found.' };
    if (template.status !== 'APPROVED') return { error: 'Cannot send a template that is not approved.' };
    
    const phoneNumberId = contact.phoneNumberId;
    const waId = contact.waId;
    const { accessToken, appId } = hasAccess;
    if (!appId) return { error: 'Project App ID is not configured.' };

    try {
        const getVars = (text: string): number[] => {
            if (!text) return [];
            const variableMatches = text.match(/{{\s*(\d+)\s*}}/g);
            return variableMatches 
                ? [...new Set(variableMatches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] 
                : [];
        };

        const payloadComponents: any[] = [];
        
        const headerComponent = template.components?.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let mediaId: string | null = null;
            const fileData = headerMediaFile as { content: string, name: string, type: string };
            
            if (mediaSource === 'file' && fileData?.content) {
                 const form = new FormData();
                 const buffer = Buffer.from(fileData.content, 'base64');
                 form.append('file', buffer, { filename: fileData.name, contentType: fileData.type });
                 form.append('messaging_product', 'whatsapp');
                 const uploadResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, form, { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${accessToken}` } });
                 mediaId = uploadResponse.data.id;
            }

            const format = headerComponent.format?.toUpperCase();
            let parameter;
            if (mediaId) {
                if (format === 'IMAGE') parameter = { type: 'image', image: { id: mediaId } };
                else if (format === 'VIDEO') parameter = { type: 'video', video: { id: mediaId } };
                else if (format === 'DOCUMENT') parameter = { type: 'document', document: { id: mediaId } };
            } else if (headerMediaUrl) {
                if (format === 'IMAGE') parameter = { type: 'image', image: { link: headerMediaUrl } };
                else if (format === 'VIDEO') parameter = { type: 'video', video: { link: headerMediaUrl } };
                else if (format === 'DOCUMENT') parameter = { type: 'document', document: { link: headerMediaUrl } };
            }
            
            if (parameter) {
                payloadComponents.push({ type: 'header', parameters: [parameter] });
            }
        }
        
        const bodyComponent = template.components?.find(c => c.type === 'BODY');
        const bodyText = bodyComponent?.text || template.body;
        if (bodyText) {
            const bodyVars = getVars(bodyText);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const varValue = variables[`variable_${varNum}`] as string || '';
                    return { type: 'text', text: varValue };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }

        const payload: any = {
            messaging_product: "whatsapp",
            to: waId,
            type: "template",
            template: {
                name: template.name,
                language: { code: template.language }
            }
        };

        if(payloadComponents.length > 0) {
            payload.template.components = payloadComponents;
        }

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: hasAccess._id, wamid, messageTimestamp: now, type: 'template',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        } as OutgoingMessage);
        
        const lastMessage = `[Template]: ${template.name}`;
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });

        revalidatePath('/dashboard/chat');
        return { message: `Template "${template.name}" sent successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred while sending the template.' };
    }
}
