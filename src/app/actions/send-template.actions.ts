
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Contact, Template, OutgoingMessage, Project } from '@/lib/definitions';

const API_VERSION = 'v23.0';

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
    const hasAccess = projectFromAction || await getProjectById(contact.projectId.toString());
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
        const templateComponents = template.components || [];

        // --- HEADER ---
        const headerComponentDef = templateComponents.find(c => c.type === 'HEADER');
        if (headerComponentDef) {
            const format = headerComponentDef.format?.toUpperCase();
            let parameter;
            const fileData = headerMediaFile as { content: string, name: string, type: string };

            if (mediaSource === 'file' && fileData?.content) {
                try {
                    const form = new FormData();
                    const buffer = Buffer.from(fileData.content, 'base64');
                    form.append('file', buffer, {
                        filename: fileData.name,
                        contentType: fileData.type,
                        knownLength: buffer.length
                    });
                    form.append('messaging_product', 'whatsapp');

                    console.log('Uploading media to Meta...', { size: buffer.length, type: fileData.type, name: fileData.name });

                    const uploadResponse = await axios.post(
                        `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
                        form,
                        {
                            headers: {
                                ...form.getHeaders(),
                                'Authorization': `Bearer ${accessToken}`
                            },
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity
                        }
                    );

                    const mediaId = uploadResponse.data.id;

                    if (mediaId) {
                        if (format === 'IMAGE') parameter = { type: 'image', image: { id: mediaId } };
                        else if (format === 'VIDEO') parameter = { type: 'video', video: { id: mediaId } };
                        else if (format === 'DOCUMENT') parameter = { type: 'document', document: { id: mediaId } };
                    }
                } catch (uploadError: any) {
                    console.error('Meta Media Upload Error:', uploadError.response?.data || uploadError.message);
                    throw new Error(`Failed to upload media: ${uploadError.response?.data?.error?.message || uploadError.message}`);
                }
            } else if (headerMediaUrl) {
                if (format === 'IMAGE') parameter = { type: 'image', image: { link: headerMediaUrl } };
                else if (format === 'VIDEO') parameter = { type: 'video', video: { link: headerMediaUrl } };
                else if (format === 'DOCUMENT') parameter = { type: 'document', document: { link: headerMediaUrl } };
            } else if (format === 'TEXT') {
                // Check if the header text definition actually contains a variable {{1}}
                // We need to check headerComponentDef.text for "{{1}}"
                if (headerComponentDef.text && headerComponentDef.text.includes('{{1}}')) {
                    const headerVar = (variables['variable_header_1'] as string || '').trim();
                    // Always send parameter if variable exists in template, default to zero-width space
                    parameter = { type: 'text', text: headerVar === '' ? '\u200B' : headerVar };
                }
            }

            if (parameter) {
                payloadComponents.push({ type: 'header', parameters: [parameter] });
            }
        }

        // --- BODY ---
        const bodyComponentDef = templateComponents.find(c => c.type === 'BODY');
        const bodyText = bodyComponentDef?.text || template.body;
        if (bodyText) {
            const bodyVars = getVars(bodyText);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a, b) => a - b).map(varNum => {
                    const varValue = (variables[`variable_body_${varNum}`] as string || '').trim();
                    return { type: 'text', text: varValue === '' ? '\u200B' : varValue };
                });
                if (parameters.length > 0) {
                    payloadComponents.push({ type: 'body', parameters });
                }
            }
        }

        // --- BUTTONS ---
        const buttonsComponentDef = templateComponents.find(c => c.type === 'BUTTONS');
        if (buttonsComponentDef && Array.isArray(buttonsComponentDef.buttons)) {
            buttonsComponentDef.buttons.forEach((button: any, index: number) => {
                if (button.type === 'URL' && button.url && button.url.includes('{{1}}')) {
                    const buttonVarKey = `variable_button_${index}`;
                    const buttonVarValue = (variables[buttonVarKey] as string || '').trim();
                    if (buttonVarValue) {
                        payloadComponents.push({
                            type: 'button',
                            sub_type: 'url',
                            index: index.toString(),
                            parameters: [{ type: 'text', text: buttonVarValue }]
                        });
                    }
                }
            });
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

        if (payloadComponents.length > 0) {
            payload.template.components = payloadComponents;
        }

        console.log('Sending Template Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();

        const finalTemplatePayloadForDb = {
            ...payload.template,
            original_components: template.components,
            sent_components: payload.template.components
        };

        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: hasAccess._id, wamid, messageTimestamp: now, type: 'template',
            content: { template: finalTemplatePayloadForDb }, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        } as OutgoingMessage);

        const lastMessage = `[Template]: ${template.name}`;
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });

        revalidatePath('/dashboard/chat');
        return { message: `Template "${template.name}" sent successfully.` };
    } catch (e: any) {
        if (e.response && e.response.data) {
            console.error('Meta Template Send Error Details:', JSON.stringify(e.response.data, null, 2));
        }
        return { error: getErrorMessage(e) || 'An unexpected error occurred while sending the template.' };
    }
}
