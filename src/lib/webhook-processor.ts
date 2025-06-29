
'use server';

import { revalidatePath } from 'next/cache';
import { Db, ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { generateAutoReply } from '@/ai/flows/auto-reply-flow';
import { intelligentTranslate, detectLanguageFromWaId } from '@/ai/flows/intelligent-translate-flow';
import type { Project, Contact, OutgoingMessage, AutoReplySettings, Flow, FlowNode, FlowEdge } from '@/app/dashboard/page';

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
        revalidatePath('/dashboard/chat');
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
        revalidatePath('/dashboard/chat');
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

        const finalButtons = await Promise.all(buttons.map(async (btn: any) => {
            const translatedBtnText = await maybeTranslate(btn.text, variables);
            return {
                type: 'reply',
                reply: {
                    id: `${node.id}-btn-${buttons.indexOf(btn)}`, // Unique ID for the button reply
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
        revalidatePath('/dashboard/chat');
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
        revalidatePath('/dashboard/chat');
    } catch (e: any) {
        console.error(`Flow: Failed to send language selection message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}


// --- Main Flow Engine ---

async function executeNode(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, flow: WithId<Flow>, nodeId: string, userInput?: string) {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
        console.log(`Flow ended for contact ${contact.waId}: node ${nodeId} not found.`);
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
        return;
    }

    console.log(`[Flow Engine] Executing node ${node.id} (${node.type}) for contact ${contact.waId}. Input: "${userInput || 'N/A'}"`);
    
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
            // This node waits for user reply, so we don't proceed automatically.
            return;
            
        case 'delay': {
            const showTyping = node.data.showTyping === true;
            const delayMs = (node.data.delaySeconds || 1) * 1000;

            if (showTyping) {
                try {
                    const payload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: contact.waId,
                        type: 'typing',
                        status: 'start'
                    };
                    axios.post(
                        `https://graph.facebook.com/v22.0/${contact.phoneNumberId}/messages`, 
                        payload, 
                        { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
                    ).catch(e => console.error(`Flow: Failed to send typing indicator to ${contact.waId}:`, e.message));
                } catch (e: any) {
                    console.error(`Flow: Error constructing typing indicator request for ${contact.waId}:`, e.message);
                }
            }
            
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }

        case 'input': {
            if (userInput !== undefined) {
                // Input was provided directly (e.g., from a button click).
                // Save it and move on without asking the question again.
                console.log(`[Flow Engine] Input node ${node.id} received direct input: "${userInput}". Saving to variable.`);
                if (node.data.variableToSave) {
                    contact.activeFlow.variables[node.data.variableToSave] = userInput;
                }
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) {
                    nextNodeId = edge.target;
                }
            } else {
                // No direct input, so ask the question and wait.
                console.log(`[Flow Engine] Input node ${node.id} is asking question and waiting for user response.`);
                await sendFlowMessage(db, project, contact, contact.phoneNumberId, node.data.text, contact.activeFlow.variables);
                // We are now waiting for user input. The flow will be resumed by the next webhook event.
                return; 
            }
            break;
        }

        case 'condition': {
            let valueToCheck: string;

            if (userInput !== undefined) {
                // If input is piped from a previous node (like a button), use it directly.
                valueToCheck = userInput;
                console.log(`[Flow Engine] Condition node received direct input: "${valueToCheck}"`);
            } else {
                const conditionType = node.data.conditionType || 'variable';
                if (conditionType === 'user_response') {
                    // No direct input, so pause and wait for the user to type something.
                    console.log(`[Flow Engine] Pausing at condition node ${node.id}, waiting for user response.`);
                    return; // Pause the flow.
                } else { // conditionType is 'variable'
                    const variableName = node.data.variable?.replace(/{{|}}/g, '').trim();
                    valueToCheck = contact.activeFlow.variables[variableName] || '';
                    console.log(`[Flow Engine] Condition node checking variable "${variableName}": "${valueToCheck}"`);
                }
            }
            
            const rawCheckValue = node.data.value || '';
            const interpolatedCheckValue = interpolate(rawCheckValue, contact.activeFlow.variables);
            const operator = node.data.operator;
            let conditionMet = false;

            switch(operator) {
                case 'equals': conditionMet = valueToCheck.toLowerCase() === interpolatedCheckValue.toLowerCase(); break;
                case 'not_equals': conditionMet = valueToCheck.toLowerCase() !== interpolatedCheckValue.toLowerCase(); break;
                case 'contains': conditionMet = valueToCheck.toLowerCase().includes(interpolatedCheckValue.toLowerCase()); break;
                case 'is_one_of':
                    const list = interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase());
                    conditionMet = list.includes(valueToCheck.toLowerCase());
                    break;
                case 'is_not_one_of':
                    const notList = interpolatedCheckValue.split(',').map(item => item.trim().toLowerCase());
                    conditionMet = !notList.includes(valueToCheck.toLowerCase());
                    break;
                case 'greater_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) > Number(interpolatedCheckValue); break;
                case 'less_than': conditionMet = !isNaN(Number(valueToCheck)) && !isNaN(Number(interpolatedCheckValue)) && Number(valueToCheck) < Number(interpolatedCheckValue); break;
                default: conditionMet = false; break;
            }

            console.log(`[Flow Engine] Condition Check: '${valueToCheck}' ${operator} '${interpolatedCheckValue}' -> ${conditionMet ? 'Yes' : 'No'}`);

            const handle = conditionMet ? `${node.id}-output-yes` : `${node.id}-output-no`;
            edge = flow.edges.find(e => e.sourceHandle === handle);
            if (edge) {
                 nextNodeId = edge.target;
            } else {
                console.log(`[Flow Engine] No edge found for condition result '${conditionMet ? 'yes' : 'no'}' from node ${node.id}`);
            }
            break;
        }

        case 'language': {
            const mode = node.data.mode || 'automatic';
            if (mode === 'automatic') {
                const detectedLanguage = await detectLanguageFromWaId(contact.waId);
                contact.activeFlow.variables.flowTargetLanguage = detectedLanguage;
                console.log(`[Flow Engine] Auto language set to '${detectedLanguage}' for contact ${contact.waId}.`);
                
                edge = flow.edges.find(e => e.source === nodeId);
                if (edge) nextNodeId = edge.target;
            } else { // Manual mode
                await sendLanguageSelectionButtons(db, project, contact, contact.phoneNumberId, node, contact.activeFlow.variables);
                // Pause and wait for user's language selection
                return;
            }
            break;
        }
        
        case 'api':
        case 'webhook': {
            const url = interpolate(node.data.apiRequest?.url, contact.activeFlow.variables);
            try {
                const response = await axios({
                    method: node.data.apiRequest?.method || 'GET',
                    url: url,
                    data: node.data.apiRequest?.body ? JSON.parse(interpolate(node.data.apiRequest.body, contact.activeFlow.variables)) : undefined,
                    headers: node.data.apiRequest?.headers ? JSON.parse(interpolate(node.data.apiRequest.headers, contact.activeFlow.variables)) : undefined,
                });
                
                const mappings = node.data.apiRequest?.responseMappings;
                if (Array.isArray(mappings)) {
                    for (const mapping of mappings) {
                        if (mapping.variable && mapping.path) {
                            const value = getValueFromPath(response.data, mapping.path);
                            if (value !== undefined) {
                                contact.activeFlow.variables[mapping.variable] = value;
                                console.log(`[Flow Engine] API Response - Set variable '${mapping.variable}' to '${JSON.stringify(value)}'`);
                            } else {
                                console.log(`[Flow Engine] API Response - Path '${mapping.path}' not found for variable '${mapping.variable}'.`);
                            }
                        }
                    }
                }

            } catch (e: any) {
                console.error(`[Flow Engine] API call failed for node ${node.id}:`, e.message);
            }
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;
        }
        case 'carousel':
        case 'addToCart':
            console.log(`[Flow Engine] Placeholder for future node type '${node.type}'. Continuing flow.`);
            edge = flow.edges.find(e => e.source === nodeId);
            if (edge) nextNodeId = edge.target;
            break;

        default:
            console.log(`[Flow Engine] Unknown node type ${node.type}. Ending flow.`);
            nextNodeId = null;
            break;
    }

    if (nextNodeId) {
        // A user's input (from a button or text) is "consumed" by the node that uses it.
        // It is NOT passed along to subsequent nodes automatically.
        await executeNode(db, project, contact, flow, nextNodeId, undefined);
    } else {
        console.log(`[Flow Engine] Flow ended for contact ${contact.waId}. No further nodes.`);
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
    }
}

async function handleFlowLogic(db: Db, project: WithId<Project>, contact: WithId<Contact> & { activeFlow?: any }, message: any, phoneNumberId: string): Promise<boolean> {
    const messageText = message.text?.body?.trim();
    const buttonReplyText = message.interactive?.button_reply?.title?.trim();
    const interactiveReplyId = message.interactive?.button_reply?.id;

    const userResponse = buttonReplyText || messageText;

    // 1. Check if user is currently in a flow
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

        // --- Special handling for our "Set Language" node ---
        if (currentNode.type === 'language' && currentNode.data.mode === 'manual' && interactiveReplyId?.startsWith(`${currentNode.id}-lang-`)) {
            const selectedLanguage = buttonReplyText || '';
            if(selectedLanguage) {
                contact.activeFlow.variables.flowTargetLanguage = selectedLanguage;
                await db.collection('contacts').updateOne(
                    { _id: contact._id },
                    { $set: { "activeFlow.variables.flowTargetLanguage": selectedLanguage } }
                );
                console.log(`[Flow Engine] Manual language set to '${selectedLanguage}' for contact ${contact.waId}.`);
            }
            
            // After setting language, proceed to the main output
            const edge = flow.edges.find(e => e.source === currentNode.id);
            if (edge) {
                await executeNode(db, project, contact, flow, edge.target, undefined);
            } else {
                await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
            }
            return true; // Flow was handled
        }
        
        // --- RESUME FLOW LOGIC ---
        // A. Resuming from a 'buttons' node via a direct button click
        if (currentNode.type === 'buttons' && interactiveReplyId) {
            const edge = flow.edges.find(e => e.sourceHandle === interactiveReplyId);
            if (edge) {
                await executeNode(db, project, contact, flow, edge.target, buttonReplyText);
                return true;
            }
        }
        
        // B. Resuming from a node that was waiting for a text-based reply
        if (userResponse) {
             if (currentNode.type === 'input') {
                if (currentNode.data.variableToSave) {
                    contact.activeFlow.variables[currentNode.data.variableToSave] = userResponse;
                }
                const edge = flow.edges.find(e => e.source === currentNode.id);
                if (edge) {
                     await executeNode(db, project, contact, flow, edge.target, undefined);
                } else {
                    await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
                }
                return true;
            }
            if (currentNode.type === 'condition' && currentNode.data.conditionType === 'user_response') {
                await executeNode(db, project, contact, flow, currentNode.id, userResponse);
                return true;
            }
        }

        console.log(`[Flow Engine] User sent unexpected message. Ending active flow for contact ${contact.waId}.`);
        await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { activeFlow: "" } });
    }

    // 2. Check if starting a new flow (this runs if no active flow or if the active flow was just ended)
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
        console.log(`[Flow Engine] Starting new flow '${triggeredFlow.name}' for contact ${contact.waId} based on trigger: "${triggerText}"`);
        const startNode = triggeredFlow.nodes.find(n => n.type === 'start');
        if (!startNode) return false;

        // Set up initial state for the new flow
        contact.activeFlow = {
            flowId: triggeredFlow._id.toString(),
            currentNodeId: startNode.id,
            variables: {
                ...(contact.variables || {}),
                name: contact.name,
                waId: contact.waId,
            }
        };
        
        await executeNode(db, project, contact, triggeredFlow, startNode.id, userResponse);
        return true;
    }

    return false;
}


// --- Auto Reply Logic ---

async function sendAutoReplyMessage(db: Db, project: WithId<Project>, contact: WithId<Contact>, phoneNumberId: string, messageText: string) {
    try {
        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'text',
            text: { preview_url: false, body: messageText },
        };

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            messagePayload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) {
            throw new Error('Message sent but no WAMID returned from Meta.');
        }

        const now = new Date();
        const outgoingMessageDoc: Omit<OutgoingMessage, '_id'> = {
            direction: 'out',
            contactId: contact._id,
            projectId: project._id,
            wamid,
            messageTimestamp: now,
            type: 'text',
            content: messagePayload,
            status: 'sent',
            statusTimestamps: { sent: now },
            createdAt: now,
        };
        await db.collection('outgoing_messages').insertOne(outgoingMessageDoc);

        await db.collection('contacts').updateOne(
            { _id: contact._id },
            { $set: { lastMessage: `[Auto]: ${messageText.substring(0, 50)}`, lastMessageTimestamp: now } }
        );
        revalidatePath('/dashboard/chat');
    } catch (e: any) {
        console.error(`Failed to send auto-reply to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function triggerAutoReply(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string) {
    const settings = project.autoReplySettings;
    if (!settings || settings.masterEnabled === false) return;

    let replyMessage: string | null = null;
    
    // 1. Check Inactive Hours
    if (settings.inactiveHours?.enabled && settings.inactiveHours.message) {
        const { startTime, endTime, timezone, days, message } = settings.inactiveHours;
        try {
            const now = new Date();
            const nowInTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            
            const currentDay = nowInTZ.getDay(); // 0 = Sunday
            const currentTime = nowInTZ.getHours() * 60 + nowInTZ.getMinutes();
            
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;

            const [endHour, endMinute] = endTime.split(':').map(Number);
            const endTimeInMinutes = endHour * 60 + endMinute;

            let isInactive = false;

            if (startTimeInMinutes > endTimeInMinutes) {
                // Overnight case (e.g., 18:00 to 09:00)
                if (currentTime >= startTimeInMinutes || currentTime < endTimeInMinutes) {
                    isInactive = true;
                }
            } else {
                // Same day case (e.g., 09:00 to 18:00)
                if (currentTime < startTimeInMinutes || currentTime >= endTimeInMinutes) {
                    isInactive = true;
                }
            }

            if (days.includes(currentDay) && isInactive) {
                replyMessage = message;
            }
        } catch (e) {
            console.error("Error processing inactive hours:", e);
        }
    }

    // 2. Check AI Assistant (if no inactive reply was triggered)
    if (!replyMessage && settings.aiAssistant?.enabled && settings.aiAssistant.context && message.type === 'text') {
        try {
            const result = await generateAutoReply({
                incomingMessage: message.text.body,
                businessContext: settings.aiAssistant.context,
                userWaId: contact.waId,
            });
            replyMessage = result.replyMessage;
        } catch (e: any) {
            console.error("Error generating AI reply:", e.message);
        }
    }
    
    // 3. Check General Reply (if no other reply was triggered)
    if (!replyMessage && settings.general?.enabled && settings.general.message) {
        replyMessage = settings.general.message;
    }

    if (replyMessage) {
        await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
    }
}


// --- Main Webhook Processing Logic ---

async function findOrCreateProjectByWabaId(db: Db, wabaId: string): Promise<WithId<Project> | null> {
    const existingProject = await db.collection('projects').findOne({ wabaId });
    if (existingProject) {
        return existingProject;
    }

    const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN;
    const apiVersion = 'v22.0';
    if (!accessToken) {
        console.error("META_SYSTEM_USER_ACCESS_TOKEN is not set. Cannot create new project automatically for WABA:", wabaId);
        return null;
    }
    try {
        const wabaDetailsResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}?access_token=${accessToken}&fields=name`);
        const wabaDetails = await wabaDetailsResponse.json();
        if (wabaDetails.error) {
            throw new Error(`Meta API error getting WABA details: ${wabaDetails.error.message}`);
        }
        const phoneNumbersResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`);
        const phoneNumbersData = await phoneNumbersResponse.json();
        if (phoneNumbersData.error) {
            throw new Error(`Meta API error getting phone numbers: ${phoneNumbersData.error.message}`);
        }
        const phoneNumbers = phoneNumbersData.data ? phoneNumbersData.data.map((num: any) => ({
            id: num.id, display_phone_number: num.display_phone_number, verified_name: num.verified_name,
            code_verification_status: num.code_verification_status, quality_rating: num.quality_rating,
            platform_type: num.platform_type, throughput: num.throughput,
        })) : [];
        const projectDoc = {
            name: wabaDetails.name, wabaId: wabaId, accessToken: accessToken, phoneNumbers: phoneNumbers,
            messagesPerSecond: 1000, reviewStatus: 'UNKNOWN',
        };
        const result = await db.collection('projects').findOneAndUpdate(
            { wabaId: wabaId },
            { $set: { name: projectDoc.name, accessToken: projectDoc.accessToken, phoneNumbers: projectDoc.phoneNumbers, reviewStatus: projectDoc.reviewStatus, },
              $setOnInsert: { createdAt: new Date(), messagesPerSecond: projectDoc.messagesPerSecond, } },
            { upsert: true, returnDocument: 'after' }
        );
        const newProject = result;
        if (newProject) {
            await db.collection('notifications').insertOne({
                projectId: newProject._id, wabaId: wabaId,
                message: `New project '${wabaDetails.name}' was automatically created from a webhook event.`,
                link: '/dashboard', isRead: false, createdAt: new Date(), eventType: 'project_auto_created',
            });
            revalidatePath('/dashboard'); revalidatePath('/dashboard', 'layout');
        }
        return newProject;
    } catch (e: any) {
        console.error(`Failed to automatically create project for WABA ${wabaId}:`, e.message);
        return null;
    }
}


export async function processSingleWebhook(db: Db, payload: any, logId?: ObjectId) {
    try {
        if (payload.object !== 'whatsapp_business_account') {
            throw new Error('Not a WhatsApp business account webhook.');
        }

        for (const entry of payload.entry || []) {
            const wabaId = entry.id;
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value) continue;

                // High-volume message events are handled by the cron job, so we skip them here.
                if (change.field === 'messages') continue;
                
                const phone_number_id = value.metadata?.phone_number_id;

                let project = await db.collection<Project>('projects').findOne(
                     { $or: [ { wabaId: wabaId }, ...(phone_number_id ? [{ 'phoneNumbers.id': phone_number_id }] : [])] }
                );

                if (!project) {
                     project = await findOrCreateProjectByWabaId(db, wabaId);
                     if (!project) continue;
                }

                switch (change.field) {
                    case 'account_update': {
                        // ... same logic as before
                        break;
                    }
                     case 'phone_number_quality_update': {
                        // ... same logic as before
                        break;
                    }
                    case 'phone_number_name_update': {
                        // ... same logic as before
                        break;
                    }
                    case 'message_template_status_update':
                    case 'template_status_update': {
                        // ... same logic as before
                        break;
                    }
                    case 'message_template_quality_update': {
                        // ... same logic as before
                        break;
                    }
                    default:
                        console.log(`Webhook processor: Unhandled event type: "${change.field}"`);
                        break;
                }
            }
        }
        
        // Mark as processed at the end of successful execution
        if (logId) {
            await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true } });
        }
    } catch (e: any) {
        console.error(`Error processing webhook with logId ${logId}:`, e.message);
        if (logId) {
            await db.collection('webhook_logs').updateOne({ _id: logId }, { $set: { processed: true, error: e.message } });
        }
        // re-throw to let the caller (e.g., cron job) know it failed
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
        for await (const contact of contactsCursor) {
            contactsMap.set(contact.messageId, contact);
        }

        const liveChatOps: any[] = [];
        const broadcastContactOps: any[] = [];
        const broadcastCounterUpdates: Record<string, { delivered: number; read: number; failed: number; success: number }> = {};
        
        for (const status of statuses) {
            if (!status || !status.id) continue;
            const wamid = status.id;
            const newStatus = (status.status || 'unknown').toUpperCase();
            const timestamp = new Date(parseInt(status.timestamp, 10) * 1000);
            
            const liveChatUpdatePayload: any = { status: status.status, [`statusTimestamps.${status.status}`]: timestamp };
            if (newStatus === 'FAILED' && status.errors && status.errors.length > 0) {
                const error = status.errors[0];
                liveChatUpdatePayload.error = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
            }
            liveChatOps.push({ updateOne: { filter: { wamid }, update: { $set: liveChatUpdatePayload } } });

            const contact = contactsMap.get(wamid);
            if (!contact) continue;
            const broadcastIdStr = contact.broadcastId.toString();
            if (!broadcastCounterUpdates[broadcastIdStr]) {
                broadcastCounterUpdates[broadcastIdStr] = { delivered: 0, read: 0, failed: 0, success: 0 };
            }

            const currentStatus = (contact.status || 'PENDING').toUpperCase();
            if (currentStatus === 'FAILED') continue;
            if (newStatus === 'FAILED') {
                const error = status.errors?.[0] || { title: 'Unknown Failure', code: 'N/A' };
                const errorString = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
                broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: 'FAILED', error: errorString } } } });
                broadcastCounterUpdates[broadcastIdStr].success -= 1;
                broadcastCounterUpdates[broadcastIdStr].failed += 1;
            } else {
                const statusHierarchy: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
                if (statusHierarchy[newStatus] !== undefined && statusHierarchy[newStatus] > statusHierarchy[currentStatus]) {
                    broadcastContactOps.push({ updateOne: { filter: { _id: contact._id }, update: { $set: { status: newStatus } } } });
                    if (newStatus === 'DELIVERED') broadcastCounterUpdates[broadcastIdStr].delivered += 1;
                    if (newStatus === 'READ') broadcastCounterUpdates[broadcastIdStr].read += 1;
                }
            }
        }

        const promises = [];
        if (liveChatOps.length > 0) promises.push(db.collection('outgoing_messages').bulkWrite(liveChatOps, { ordered: false }));
        if (broadcastContactOps.length > 0) promises.push(db.collection('broadcast_contacts').bulkWrite(broadcastContactOps, { ordered: false }));
        const broadcastCounterOps = Object.entries(broadcastCounterUpdates)
            .filter(([_, counts]) => counts.delivered > 0 || counts.read > 0 || counts.failed > 0 || counts.success !== 0)
            .map(([broadcastId, counts]) => ({ updateOne: { filter: { _id: new ObjectId(broadcastId) }, update: { $inc: { deliveredCount: counts.delivered, readCount: counts.read, errorCount: counts.failed, successCount: counts.success, } } } }));
        if (broadcastCounterOps.length > 0) promises.push(db.collection('broadcasts').bulkWrite(broadcastCounterOps, { ordered: false }));
        
        if (promises.length > 0) await Promise.all(promises);
        
        if (liveChatOps.length > 0) revalidatePath('/dashboard/chat');
        if (broadcastContactOps.length > 0) {
            revalidatePath('/dashboard/broadcasts/[broadcastId]', 'page');
            revalidatePath('/dashboard/broadcasts');
        }

        return { success: statuses.length, failed: 0 };

    } catch(e: any) {
        console.error("Error in processStatusUpdateBatch:", e);
        return { success: 0, failed: statuses.length };
    }
}

export async function processIncomingMessageBatch(db: Db, messageGroups: any[]) {
    if (messageGroups.length === 0) return { success: 0, failed: 0 };
    
    let processedCount = 0;
    try {
        const contactOps: any[] = [];
        const projectsCache = new Map<string, WithId<Project>>();

        for (const group of messageGroups) {
            const businessPhoneNumberId = group.metadata.phone_number_id;
            let project = projectsCache.get(businessPhoneNumberId);
            if (!project) {
                project = await db.collection<Project>('projects').findOne({ 'phoneNumbers.id': businessPhoneNumberId });
                if (project) projectsCache.set(businessPhoneNumberId, project);
            }

            if (!project) {
                console.error(`No project found for phone number ID ${businessPhoneNumberId}`);
                continue;
            }

            const message = group.messages[0];
            const contactProfile = group.contacts[0];
            const senderWaId = message.from;
            const senderName = contactProfile.profile?.name || 'Unknown User';

            let lastMessageText = `[${message.type}]`;
            if (message.type === 'text') lastMessageText = message.text.body;
            else if (message.type === 'interactive') lastMessageText = message.interactive?.button_reply?.title || '[Interactive Reply]';
            
            contactOps.push({
                updateOne: {
                    filter: { waId: senderWaId, projectId: project._id },
                    update: { 
                        $set: { name: senderName, phoneNumberId: businessPhoneNumberId, lastMessage: lastMessageText, lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000) },
                        $inc: { unreadCount: 1 },
                        $setOnInsert: { waId: senderWaId, projectId: project._id, createdAt: new Date() }
                    },
                    upsert: true
                }
            });
        }
        
        if (contactOps.length > 0) await db.collection('contacts').bulkWrite(contactOps, { ordered: false });

        const incomingMessageOps: any[] = [];
        const notificationOps: any[] = [];
        const flowLogicTasks: (() => Promise<any>)[] = [];

        // We need to fetch the contacts again to get their _ids for relations
        const allWaIds = messageGroups.map(g => g.messages[0].from);
        const contactsCursor = db.collection('contacts').find({ waId: { $in: allWaIds } });
        const contactsMap = new Map<string, WithId<Contact>>();
        for await (const contact of contactsCursor) {
            contactsMap.set(`${contact.projectId.toString()}-${contact.waId}`, contact);
        }

        for (const group of messageGroups) {
            const businessPhoneNumberId = group.metadata.phone_number_id;
            const project = projectsCache.get(businessPhoneNumberId);
            if (!project) continue;

            const message = group.messages[0];
            const senderWaId = message.from;
            const contact = contactsMap.get(`${project._id.toString()}-${senderWaId}`);

            if (!contact) continue;
            
            processedCount++;

            incomingMessageOps.push({ insertOne: { document: {
                direction: 'in', projectId: project._id, contactId: contact._id,
                wamid: message.id, messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
                type: message.type, content: message, isRead: false, createdAt: new Date(),
            }}});
            
            notificationOps.push({ insertOne: { document: {
                projectId: project._id, wabaId: project.wabaId,
                message: `New message from ${contact.name}.`,
                link: `/dashboard/chat?contactId=${contact._id.toString()}&phoneId=${businessPhoneNumberId}`,
                isRead: false, createdAt: new Date(), eventType: 'messages',
            }}});
            
            flowLogicTasks.push(async () => {
                const flowHandled = await handleFlowLogic(db, project, contact, message, businessPhoneNumberId);
                if (!flowHandled) {
                    await triggerAutoReply(db, project, contact, message, businessPhoneNumberId);
                }
            });
        }
        
        const bulkWritePromises = [];
        if (incomingMessageOps.length > 0) bulkWritePromises.push(db.collection('incoming_messages').bulkWrite(incomingMessageOps, { ordered: false }));
        if (notificationOps.length > 0) bulkWritePromises.push(db.collection('notifications').bulkWrite(notificationOps, { ordered: false }));
        
        await Promise.all(bulkWritePromises);

        for (const task of flowLogicTasks) {
            await task(); // Run sequentially to avoid race conditions within a single contact's logic
        }

        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        revalidatePath('/dashboard/notifications');
        revalidatePath('/dashboard', 'layout');
        
        return { success: processedCount, failed: messageGroups.length - processedCount };

    } catch (e: any) {
        console.error("Error in processIncomingMessageBatch:", e);
        return { success: processedCount, failed: messageGroups.length - processedCount };
    }
}
