

'use server';

import { revalidatePath } from 'next/cache';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import axios from 'axios';
import { generateAutoReply } from '@/ai/flows/auto-reply-flow';
import { intelligentTranslate, detectLanguageFromWaId } from '@/ai/flows/intelligent-translate-flow';
import type { Project, Contact, OutgoingMessage, AutoReplySettings, Flow, FlowNode, FlowEdge } from '@/app/dashboard/page';

const BATCH_SIZE = 1000; // Increased batch size for faster queue processing
const LOCK_DURATION_MS = 2 * 60 * 1000; // 2 minute lock per project

// --- Flow Engine Utilities ---

/**
 * Interpolates variables in a string. e.g., "Hello {{name}}" -> "Hello John"
 */
function interpolate(text: string, variables: Record<string, any>): string {
    if (!text) return '';
    // This regex looks for {{variable_name}} or {{object.key}}
    return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
        // Basic property accessor for nested objects, e.g., {{user.name}}
        const value = key.split('.').reduce((o: any, i: string) => o?.[i], variables);
        return value !== undefined ? String(value) : match;
    });
}

/**
 * Safely gets a value from a nested object using a dot-notation path.
 * Supports array access with bracket notation, e.g., 'items[0].name'.
 */
function getValueFromPath(obj: any, path: string): any {
    if (!path) return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

/**
 * If a target language is set in the flow variables, translates the text.
 * Otherwise, returns the original text.
 */
async function maybeTranslate(text: string, variables: Record<string, any>): Promise<string> {
    const targetLanguage = variables.flowTargetLanguage;
    if (!targetLanguage || targetLanguage.toLowerCase().includes('english') || !text) {
        return text;
    }
    try {
        const result = await intelligentTranslate({ text, targetLanguage });
        return result.translatedText;
    } catch (e: any) {
        console.error(`Flow translation to '${targetLanguage}' failed:`, e.message);
        return text; // Return original text on failure
    }
}


// --- Flow Action Functions ---

async function sendFlowMessage(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, text: string, variables: Record<string, any>) {
    try {
        const translatedText = await maybeTranslate(text, variables);
        const interpolatedText = interpolate(translatedText, variables);

        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'text',
            text: { preview_url: false, body: interpolatedText },
        };
        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'text',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send text message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowImage(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const imageUrl = interpolate(node.data.imageUrl, variables);
    const caption = node.data.caption || '';
    if (!imageUrl) {
        console.error(`Flow: Image URL is missing or invalid after interpolation for node ${node.id}.`);
        return;
    }
    try {
        const translatedCaption = await maybeTranslate(caption, variables);
        const interpolatedCaption = interpolate(translatedCaption, variables);

        const messagePayload: any = {
            messaging_product: 'whatsapp', to: contact.waId, type: 'image',
            image: { link: imageUrl },
        };
        if (interpolatedCaption) messagePayload.image.caption = interpolatedCaption;
        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'image',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: interpolatedCaption || '[Flow]: Sent an image', lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send image message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowButtons(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const text = node.data.text || '';
    const buttons = (node.data.buttons || []).filter((btn: any) => btn.text && btn.type === 'QUICK_REPLY');
    if (!text || buttons.length === 0) return;

    try {
        const translatedText = await maybeTranslate(text, variables);
        const interpolatedText = interpolate(translatedText, variables);

        const finalButtons = await Promise.all(buttons.map(async (btn: any, index: number) => {
            const translatedBtnText = await maybeTranslate(btn.text, variables);
            return {
                type: 'reply',
                reply: {
                    id: `${node.id}-btn-${index}`, // Unique ID for the button reply
                    title: interpolate(translatedBtnText, variables).substring(0, 20),
                }
            };
        }));
        
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: interpolatedText },
                action: {
                    buttons: finalButtons
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send buttons message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendLanguageSelectionButtons(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const text = interpolate(node.data.promptMessage, variables);
    const languages = (node.data.languages || '').split(',').map((l: string) => l.trim()).filter(Boolean);
    if (!text || languages.length === 0) return;

    try {
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text },
                action: {
                    buttons: languages.map((lang: string) => ({
                        type: 'reply',
                        reply: {
                            id: `${node.id}-lang-${lang}`, // Special ID format for language selection
                            title: lang.substring(0, 20),
                        }
                    }))
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');
        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${text.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send language selection message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowCarousel(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, node: FlowNode, variables: Record<string, any>) {
    const { headerText, bodyText, footerText, catalogId, sections } = node.data;
    if (!bodyText || !catalogId || !sections || sections.length === 0) {
        console.error(`Flow: Carousel node ${node.id} is missing required data (body, catalogId, or sections).`);
        return;
    }

    try {
        const interpolatedBody = interpolate(await maybeTranslate(bodyText, variables), variables);

        const payload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'interactive',
            interactive: {
                type: 'catalog_message',
                body: { text: interpolatedBody },
                action: {
                    catalog_id: catalogId,
                    sections: (sections || []).map((section: any) => ({
                        title: interpolate(section.title, variables),
                        product_items: (section.products || []).map((prod: any) => ({
                            product_retailer_id: interpolate(prod.product_retailer_id, variables),
                        })),
                    })),
                },
            },
        };

        if (headerText) {
            payload.interactive.header = {
                type: 'text',
                text: interpolate(await maybeTranslate(headerText, variables), variables),
            };
        }
        if (footerText) {
            payload.interactive.footer = {
                text: interpolate(await maybeTranslate(footerText, variables), variables),
            };
        }
        
        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Flow]: ${interpolatedBody.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Flow: Failed to send carousel message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}


// --- Main Flow Engine ---

async function executeNode(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, flow: WithId<Flow>, nodeId: string, userInput?: string) {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
        return;
    }
    
    // Update contact's state to current node
    await db.collection('contacts').updateOne(
        { _id: contact._id },
        { $set: { "activeFlow.currentNodeId": nodeId, "activeFlow.variables": contact.activeFlow.variables } }
    );
    
    let nextNodeId: string | null = null;
    let edge: FlowEdge | undefined;

    switch (node.type) {
        case 'start':
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        case 'text':
            await sendFlowMessage(db, project, contact, contact.phoneNumberId, node.data.text, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
            
        case 'image':
            await sendFlowImage(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        case 'buttons':
            await sendFlowButtons(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            return;
            
        case 'delay': {
            const showTyping = node.data.showTyping === true;
            const delayMs = (node.data.delaySeconds || 1) * 1000;
            if (showTyping) {
                try {
                    axios.post(
                        `https://graph.facebook.com/v22.0/${contact.phoneNumberId}/messages`, 
                        { messaging_product: 'whatsapp', to: contact.waId, recipient_type: 'individual', type: 'typing', action: 'start' }, 
                        { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
                    ).catch(e => console.error(`Flow: Failed to send typing indicator to ${contact.waId}:`, e.message));
                } catch (e: any) {
                    console.error(`Flow: Error constructing typing indicator request for ${contact.waId}:`, e.message);
                }
            }
            if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }

        case 'input':
            if (userInput !== undefined) {
                if (node.data.variableToSave) contact.activeFlow.variables[node.data.variableToSave] = userInput;
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) nextNodeId = edge.target;
            } else {
                await sendFlowMessage(db, project, contact, contact.phoneNumberId, node.data.text, contact.activeFlow.variables);
                return;
            }
            break;

        case 'condition': {
            let valueToCheck: string = userInput || '';
            if (userInput === undefined) {
                const conditionType = node.data.conditionType || 'variable';
                if (conditionType === 'user_response') return;
                const variableName = node.data.variable?.replace(/{{|}}/g, '').trim();
                if (variableName) valueToCheck = contact.activeFlow.variables[variableName] || '';
            }
            
            const rawCheckValue = node.data.value || '';
            const interpolatedCheckValue = interpolate(rawCheckValue, contact.activeFlow.variables);
            const operator = node.data.operator || 'equals';
            let conditionMet = false;

            switch(operator) {
                case 'equals': conditionMet = valueToCheck.toLowerCase() === interpolatedCheckValue.toLowerCase(); break;
                case 'not_equals': conditionMet = valueToCheck.toLowerCase() !== interpolatedCheckValue.toLowerCase(); break;
                case 'contains': conditionMet = valueToCheck.toLowerCase().includes(interpolatedCheckValue.toLowerCase()); break;
                case 'is_one_of':
                    conditionMet = interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase()).includes(valueToCheck.toLowerCase());
                    break;
                case 'is_not_one_of':
                    conditionMet = !interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase()).includes(valueToCheck.toLowerCase());
                    break;
                case 'greater_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) > Number(interpolatedCheckValue); break;
                case 'less_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) < Number(interpolatedCheckValue); break;
                default: conditionMet = false;
            }

            const handle = conditionMet ? `${node.id}-output-yes` : `${node.id}-output-no`;
            edge = flow.edges.find(e => e.sourceHandle === handle);
            if (edge) nextNodeId = edge.target;
            break;
        }

        case 'language': {
            const mode = node.data.mode || 'automatic';
            if (mode === 'automatic') {
                const detectedLanguage = await detectLanguageFromWaId(contact.waId);
                contact.activeFlow.variables.flowTargetLanguage = detectedLanguage;
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) nextNodeId = edge.target;
            } else { // Manual mode
                await sendLanguageSelectionButtons(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
                return;
            }
            break;
        }
        
        case 'api':
        case 'webhook': {
            const apiRequest = node.data.apiRequest;
            if (apiRequest?.url) {
                try {
                    const interpolatedUrl = interpolate(apiRequest.url, contact.activeFlow.variables);
                    const rawHeaders = apiRequest.headers ? interpolate(apiRequest.headers, contact.activeFlow.variables) : '';
                    const rawBody = apiRequest.body ? interpolate(apiRequest.body, contact.activeFlow.variables) : '';
                    
                    const response = await axios({
                        method: apiRequest.method || 'GET',
                        url: interpolatedUrl,
                        data: rawBody ? JSON.parse(rawBody) : undefined,
                        headers: rawHeaders ? JSON.parse(rawHeaders) : undefined,
                    });
                    
                    const mappings = apiRequest.responseMappings;
                    if (Array.isArray(mappings)) {
                        for (const mapping of mappings) {
                            if (mapping.variable && mapping.path) {
                                const value = getValueFromPath(response.data, mapping.path);
                                if (value !== undefined) contact.activeFlow.variables[mapping.variable] = value;
                            }
                        }
                    }
                } catch (e: any) {
                    console.error(`[Flow Engine] API call failed for node ${node.id}. Error: ${e.message}`);
                }
            }
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }
        case 'carousel':
            await sendFlowCarousel(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        case 'addToCart':
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        default:
            nextNodeId = null;
            break;
    }

    if (nextNodeId) {
        await executeNode(db, project, contact, flow, nextNodeId, undefined);
    } else {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
    }
}

async function handleFlowLogic(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, message: any, phoneNumberId: string): Promise<boolean> {
    const messageText = message.text?.body?.trim();
    const buttonReply = message.interactive?.button_reply;
    const userResponse = buttonReply?.title?.trim() || messageText;

    if (contact.activeFlow?.flowId) {
        const flow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(contact.activeFlow.flowId) });
        if (!flow) {
            await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
            return false;
        }

        const currentNode = flow.nodes.find(n => n.id === contact.activeFlow.currentNodeId);
        if (!currentNode) {
            await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
            return false;
        }

        if (buttonReply) {
            const replyId = buttonReply.id?.trim();
            if (replyId.startsWith(`${currentNode.id}-lang-`)) {
                const selectedLanguage = buttonReply.title || '';
                if(selectedLanguage) {
                    contact.activeFlow.variables.flowTargetLanguage = selectedLanguage;
                    await db.collection('contacts').updateOne(
                        { _id: contact._id },
                        { $set: { "activeFlow.variables.flowTargetLanguage": selectedLanguage } }
                    );
                }
                const edge = flow.edges.find(e => e.source === currentNode.id);
                if (edge) await executeNode(db, project, contact, flow, edge.target, undefined);
                else await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
                return true;
            }
            if (currentNode.type === 'buttons') {
                const edge = flow.edges.find(e => e.sourceHandle?.trim() === replyId);
                if (edge) {
                    await executeNode(db, project, contact, flow, edge.target, buttonReply.title);
                    return true;
                }
            }
        }
        
        if (userResponse) {
             if (currentNode.type === 'input' || (currentNode.type === 'condition' && currentNode.data.conditionType === 'user_response') || (buttonReply && currentNode.type === 'condition')) {
                await executeNode(db, project, contact, flow, currentNode.id, userResponse);
                return true;
            }
        }
        
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
    }

    const triggerText = userResponse?.toLowerCase();
    if (!triggerText) return false;
    
    const flows = await db.collection<Flow>('flows').find({
        projectId: project._id,
        triggerKeywords: { $exists: true, $ne: [] }
    }).toArray();

    const triggeredFlow = flows.find(flow =>
        (flow.triggerKeywords || []).some(keyword => triggerText.includes(keyword.toLowerCase().trim()))
    );

    if (triggeredFlow) {
        const startNode = triggeredFlow.nodes.find(n => n.type === 'start');
        if (!startNode) return false;

        contact.activeFlow = {
            flowId: triggeredFlow._id.toString(),
            currentNodeId: startNode.id,
            variables: { ...(contact.variables || {}), name: contact.name, waId: contact.waId },
        };
        
        await executeNode(db, project, contact, triggeredFlow, startNode.id, userResponse);
        return true;
    }

    return false;
}


// --- Auto Reply & Opt-out Logic ---

async function sendAutoReplyMessage(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, messageText: string) {
    try {
        const messagePayload = {
            messaging_product: 'whatsapp', recipient_type: 'individual', to: contact.waId, type: 'text',
            text: { preview_url: false, body: messageText },
        };
        const response = await axios.post( `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'text',
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: `[Auto]: ${messageText.substring(0, 50)}`, lastMessageTimestamp: now } });
    } catch (e: any) {
        console.error(`Failed to send auto-reply to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function handleOptInOut(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string): Promise<boolean> {
    const settings = project.optInOutSettings;
    if (!settings?.enabled) return false;

    const messageText = message.text?.body?.trim().toLowerCase();
    if (!messageText) return false;

    if (settings.optOutKeywords?.includes(messageText)) {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { isOptedOut: true } });
        if (settings.optOutResponse) await sendAutoReplyMessage(db, project, contact, phoneNumberId, settings.optOutResponse);
        return true;
    }

    if (settings.optInKeywords?.includes(messageText)) {
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { isOptedOut: false } });
         if (settings.optInResponse) await sendAutoReplyMessage(db, project, contact, phoneNumberId, settings.optInResponse);
        return true;
    }
    return false;
}

async function triggerAutoReply(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string) {
    const settings = project.autoReplySettings;
    if (!settings || settings.masterEnabled === false) return;

    let replyMessage: string | null = null;
    
    if (contact.hasReceivedWelcome === false && settings.welcomeMessage?.enabled && settings.welcomeMessage.message) {
        replyMessage = settings.welcomeMessage.message;
        if (replyMessage) {
            await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
            await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { hasReceivedWelcome: true } });
            return;
        }
    }

    if (settings.inactiveHours?.enabled && settings.inactiveHours.message) {
        const { startTime, endTime, timezone, days, message: inactiveMessage } = settings.inactiveHours;
        try {
            const nowInTZ = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
            const currentDay = nowInTZ.getDay();
            const currentTime = nowInTZ.getHours() * 60 + nowInTZ.getMinutes();
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;
            const [endHour, endMinute] = endTime.split(':').map(Number);
            const endTimeInMinutes = endHour * 60 + endMinute;

            let isInactive = (startTimeInMinutes > endTimeInMinutes)
                ? (currentTime >= startTimeInMinutes || currentTime < endTimeInMinutes)
                : (currentTime < startTimeInMinutes || currentTime >= endTimeInMinutes);
            
            if (days.includes(currentDay) && isInactive) replyMessage = inactiveMessage;
        } catch (e) { console.error("Error processing inactive hours:", e); }
    }

    if (!replyMessage && settings.aiAssistant?.enabled && settings.aiAssistant.context && message.type === 'text') {
        try {
            const result = await generateAutoReply({
                incomingMessage: message.text.body,
                businessContext: settings.aiAssistant.context,
                userWaId: contact.waId,
                autoTranslate: settings.aiAssistant.autoTranslate,
            });
            replyMessage = result.replyMessage;
        } catch (e: any) { console.error("Error generating AI reply:", e.message); }
    }
    
    if (!replyMessage && contact.hasReceivedWelcome === false && settings.general?.enabled && settings.general.message) {
        replyMessage = settings.general.message;
        if (replyMessage) {
            await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
            await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { hasReceivedWelcome: true } });
            return;
        }
    }
    if (replyMessage) await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
}

async function handleSingleMessageEvent(db: Db, project: WithId<Project>, message: any, contactProfile: any) {
    const businessPhoneNumberId = message.metadata.phone_number_id;
    const senderWaId = message.from;
    const senderName = contactProfile.profile?.name || 'Unknown User';
    let lastMessageText = message.type === 'text' ? message.text.body : `[${message.type}]`;
    if (message.type === 'interactive') {
        lastMessageText = message.interactive?.button_reply?.title || '[Interactive Reply]';
    }
    
    const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
        { waId: senderWaId, projectId: project._id },
        { 
            $set: { name: senderName, phoneNumberId: businessPhoneNumberId, lastMessage: lastMessageText, lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000) },
            $inc: { unreadCount: 1 },
            $setOnInsert: { waId: senderWaId, projectId: project._id, createdAt: new Date(), hasReceivedWelcome: false }
        },
        { upsert: true, returnDocument: 'after' }
    );
    
    const contact = contactResult;
    if (!contact) throw new Error(`Failed to find or create contact for WA ID ${senderWaId}`);

    await db.collection('incoming_messages').insertOne({
        direction: 'in', projectId: project._id, contactId: contact._id,
        wamid: message.id, messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
        type: message.type, content: message, isRead: false, createdAt: new Date(),
    });

    const wasOptInOut = await handleOptInOut(db, project, contact, message, businessPhoneNumberId);
    if (!wasOptInOut) {
        const flowHandled = await handleFlowLogic(db, project, contact, message, businessPhoneNumberId);
        if (!flowHandled) {
            await triggerAutoReply(db, project, contact, message, businessPhoneNumberId);
        }
    }
}


// --- Main Webhook Processing Logic ---

async function processSingleWebhook(db: Db, project: WithId<Project>, payload: any, logId?: ObjectId) {
    try {
        if (payload.object !== 'whatsapp_business_account') throw new Error('Not a WhatsApp business account webhook.');
        
        const change = payload.entry?.[0]?.changes?.[0];
        if (!change) return;

        const value = change.value;
        const eventType = change.field;

        if (eventType === 'messages' || !value) return;

        let message = `Received a general update for ${eventType}.`;
        let link = `/dashboard/information`;

        switch (eventType) {
            case 'account_update':
                message = `Your business account has been updated. Review status: ${value.review_status?.toUpperCase() || 'N/A'}`;
                if (value.review_status) await db.collection('projects').updateOne({ _id: project._id }, { $set: { reviewStatus: value.review_status } });
                break;
            case 'phone_number_quality_update':
                message = `Phone number ${value.display_phone_number} quality is now ${value.event}. Current limit: ${value.current_limit}`;
                link = '/dashboard/numbers';
                break;
            case 'phone_number_name_update':
                message = `Name update for ${value.display_phone_number} was ${value.decision}. Verified name: ${value.verified_name}.`;
                link = '/dashboard/numbers';
                break;
            case 'message_template_status_update':
            case 'template_status_update':
                message = `Template '${value.message_template_name}' was ${value.event === 'approved' ? 'approved' : 'rejected'}. Reason: ${value.reason || 'N/A'}`;
                link = '/dashboard/templates';
                await db.collection('templates').updateOne({ name: value.message_template_name, projectId: project._id }, { $set: { status: value.event.toUpperCase() } });
                break;
            case 'message_template_quality_update':
                message = `Template '${value.message_template_name}' quality updated to ${value.new_quality_score}.`;
                link = '/dashboard/templates';
                await db.collection('templates').updateOne({ name: value.message_template_name, projectId: project._id }, { $set: { qualityScore: value.new_quality_score } });
                break;
        }

        await db.collection('notifications').insertOne({
            projectId: project._id, wabaId: project.wabaId, message, link,
            isRead: false, createdAt: new Date(), eventType,
        });

        if (logId) await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: null } });
    } catch (e: any) {
        if (logId) await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: e.message } });
        throw e;
    }
}


export async function processStatusUpdateBatch(db: Db, statuses: any[]) {
    if (statuses.length === 0) return { success: 0, failed: 0 };
    
    try {
        const wamids = statuses.map(s => s.id).filter(Boolean);
        if (wamids.length === 0) return { success: 0, failed: 0 };

        const contactsMap = new Map<string, WithId<any>>();
        const contactsCursor = db.collection('broadcast_contacts').find({ messageId: { $in: wamids } });
        for await (const contact of contactsCursor) contactsMap.set(contact.messageId, contact);

        const liveChatOps: any[] = [];
        const broadcastContactOps: any[] = [];
        const broadcastCounterUpdates: Record<string, { delivered: number; read: number; failed: number; success: number }> = {};
        
        for (const status of statuses) {
            if (!status?.id) continue;
            const wamid = status.id;
            const newStatus = (status.status || 'unknown').toUpperCase();
            
            const liveChatUpdatePayload: any = { status: status.status, [`statusTimestamps.${status.status}`]: new Date(parseInt(status.timestamp, 10) * 1000) };
            if (newStatus === 'FAILED' && status.errors?.[0]) liveChatUpdatePayload.error = `${status.errors[0].title} (Code: ${status.errors[0].code})${status.errors[0].details ? `: ${status.errors[0].details}` : ''}`;
            liveChatOps.push({ updateOne: { filter: { wamid }, update: { $set: liveChatUpdatePayload } } });

            const contact = contactsMap.get(wamid);
            if (!contact) continue;

            const broadcastIdStr = contact.broadcastId.toString();
            if (!broadcastCounterUpdates[broadcastIdStr]) broadcastCounterUpdates[broadcastIdStr] = { delivered: 0, read: 0, failed: 0, success: 0 };

            const currentStatus = (contact.status || 'PENDING').toUpperCase();
            const statusHierarchy: Record<string, number> = { PENDING: 0, SENT: 1, FAILED: 1, DELIVERED: 2, READ: 3 };

            if (newStatus === 'FAILED' && currentStatus !== 'FAILED') {
                const error = status.errors?.[0] || { title: 'Unknown Failure', code: 'N/A' };
                const errorString = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
                broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: 'FAILED', error: errorString } } } });
                broadcastCounterUpdates[broadcastIdStr].success -= 1;
                broadcastCounterUpdates[broadcastIdStr].failed += 1;
            } else if (statusHierarchy[newStatus] > statusHierarchy[currentStatus]) {
                broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: newStatus } } } });
                if (newStatus === 'DELIVERED') broadcastCounterUpdates[broadcastIdStr].delivered += 1;
                if (newStatus === 'READ') broadcastCounterUpdates[broadcastIdStr].read += 1;
            }
        }

        const promises = [];
        if (liveChatOps.length > 0) promises.push(db.collection('outgoing_messages').bulkWrite(liveChatOps, { ordered: false }));
        if (broadcastContactOps.length > 0) promises.push(db.collection('broadcast_contacts').bulkWrite(broadcastContactOps, { ordered: false }));
        
        const broadcastCounterOps = Object.entries(broadcastCounterUpdates)
            .filter(([_, counts]) => Object.values(counts).some(v => v !== 0))
            .map(([broadcastId, counts]) => ({
                updateOne: { filter: { _id: new ObjectId(broadcastId) }, update: { $inc: { deliveredCount: counts.delivered, readCount: counts.read, errorCount: counts.failed, successCount: counts.success } } }
            }));

        if (broadcastCounterOps.length > 0) promises.push(db.collection('broadcasts').bulkWrite(broadcastCounterOps, { ordered: false }));
        
        if (promises.length > 0) await Promise.all(promises);

        return { success: statuses.length, failed: 0 };
    } catch(e: any) {
        console.error("Error in processStatusUpdateBatch:", e);
        return { success: 0, failed: statuses.length };
    }
}

export async function processIncomingMessageBatch(db: Db, messageGroups: any[]) {
    if (messageGroups.length === 0) return { success: 0, failed: 0 };
    
    // Fetch all unique projects in one go
    const projectIds = [...new Set(messageGroups.map(group => new ObjectId(group.projectId)))];
    const projectsArray = await db.collection<Project>('projects').find({ _id: { $in: projectIds } }).toArray();
    const projectsMap = new Map(projectsArray.map(p => [p._id.toString(), p]));

    const processingPromises = messageGroups.map(group => {
        return (async () => {
            try {
                const project = projectsMap.get(group.projectId.toString());
                if (!project) throw new Error(`Project ${group.projectId} not found for message batch processing`);
                
                // Note: The 'wabaId' from the payload is not used here, we trust the projectId mapping from ingestion.
                await handleSingleMessageEvent(db, project, group.messages[0], group.contacts[0]);
                return { success: true };
            } catch (e: any) {
                console.error(`Error processing a message from batch for project ${group.projectId}: ${e.message}`);
                return { success: false };
            }
        })();
    });

    const results = await Promise.all(processingPromises);
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        revalidatePath('/dashboard/notifications');
        revalidatePath('/dashboard', 'layout');
    }

    return { success: successCount, failed: results.length - successCount };
}


export async function processWebhooksForProject(db: Db, projectId: ObjectId) {
    const lockId = `webhook_process_lock_${projectId.toString()}`;
    let lockAcquired = false;

    const results = {
        projectId: projectId.toString(),
        processed: 0,
        success: 0,
        failed: 0,
        error: ''
    };

    try {
        const now = new Date();
        const lockHeldUntil = new Date(now.getTime() + LOCK_DURATION_MS);

        const lockResult = await db.collection('locks').findOneAndUpdate(
            { _id: lockId, $or: [{ lockHeldUntil: { $exists: false } }, { lockHeldUntil: { $lt: now } }] },
            { $set: { lockHeldUntil } },
            { upsert: true, returnDocument: 'after' }
        ).catch(e => (e.code === 11000 ? null : Promise.reject(e)));

        if (!lockResult) return { ...results, error: 'Lock already held' };
        lockAcquired = true;

        const project = await db.collection<Project>('projects').findOne({ _id: projectId });
        if (!project) return { ...results, error: 'Project not found' };

        while (true) {
            const queueItems = await db.collection('webhook_queue').find({
                projectId: projectId,
                status: 'PENDING'
            }).limit(BATCH_SIZE).toArray();

            if (queueItems.length === 0) break;

            const processingIds = queueItems.map(item => item._id);
            await db.collection('webhook_queue').updateMany(
                { _id: { $in: processingIds } },
                { $set: { status: 'PROCESSING', processedAt: new Date() } }
            );

            const statusUpdates: any[] = [];
            const incomingMessages: any[] = [];
            const otherEvents: any[] = [];

            for (const item of queueItems) {
                const value = item.payload.entry?.[0]?.changes?.[0]?.value;
                const field = item.payload.entry?.[0]?.changes?.[0]?.field;

                if (field === 'messages' && value) {
                    if (value.statuses) statusUpdates.push(...value.statuses);
                    if (value.messages) incomingMessages.push({ ...value, projectId: item.projectId });
                } else {
                    otherEvents.push(item);
                }
            }
            
            const batchPromises = [
                processStatusUpdateBatch(db, statusUpdates),
                processIncomingMessageBatch(db, incomingMessages),
                ...otherEvents.map(item => 
                    processSingleWebhook(db, project, item.payload, item.logId)
                        .then(() => ({ success: 1, failed: 0 }))
                        .catch(() => ({ success: 0, failed: 1 }))
                )
            ];

            const batchResults = await Promise.all(batchPromises);

            await db.collection('webhook_queue').updateMany(
                { _id: { $in: processingIds } },
                { $set: { status: 'COMPLETED' } }
            );
            
            results.processed += queueItems.length;
            batchResults.forEach(res => {
                if (res) {
                    results.success += res.success;
                    results.failed += res.failed;
                }
            });
        }
    } catch (e: any) {
        console.error(`[Worker] Error during webhook processing for project ${projectId}:`, e);
        results.error = e.message;
    } finally {
        if (lockAcquired) {
            await db.collection('locks').updateOne({ _id: lockId }, { $set: { lockHeldUntil: new Date(0) } });
        }
    }

    return results;
}
