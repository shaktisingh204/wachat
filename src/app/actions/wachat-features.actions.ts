'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';

// =================================================================
//  CHAT LABELS
// =================================================================

export async function getChatLabels(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const labels = await db.collection('wa_chat_labels').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return { labels: JSON.parse(JSON.stringify(labels)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveChatLabel(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const color = formData.get('color') as string || '#3b82f6';
    if (!projectId || !name) return { error: 'Label name is required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_chat_labels').insertOne({ projectId: new ObjectId(projectId), name, color, createdAt: new Date() });
        revalidatePath('/dashboard/chat-labels');
        return { message: `Label "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteChatLabel(labelId: string) {
    if (!ObjectId.isValid(labelId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_chat_labels').deleteOne({ _id: new ObjectId(labelId) });
        revalidatePath('/dashboard/chat-labels');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

export async function assignLabelToContact(contactId: string, labelId: string) {
    try {
        const { db } = await connectToDatabase();
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $addToSet: { labelIds: labelId } });
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  MESSAGE SCHEDULING
// =================================================================

export async function getScheduledMessages(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const messages = await db.collection('wa_scheduled_messages').find({ projectId: new ObjectId(projectId), status: { $ne: 'sent' } }).sort({ scheduledAt: 1 }).toArray();
        return { messages: JSON.parse(JSON.stringify(messages)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function scheduleMessage(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const recipientPhone = formData.get('recipientPhone') as string;
    const messageText = formData.get('messageText') as string;
    const scheduledAt = formData.get('scheduledAt') as string;
    if (!projectId || !recipientPhone || !messageText || !scheduledAt) return { error: 'All fields are required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) return { error: 'Scheduled time must be in the future.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_scheduled_messages').insertOne({
            projectId: new ObjectId(projectId), recipientPhone, messageText, scheduledAt: scheduledDate, status: 'pending', createdAt: new Date(),
        });
        revalidatePath('/dashboard/scheduled-messages');
        return { message: 'Message scheduled successfully.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function cancelScheduledMessage(messageId: string) {
    if (!ObjectId.isValid(messageId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_scheduled_messages').updateOne({ _id: new ObjectId(messageId) }, { $set: { status: 'cancelled' } });
        revalidatePath('/dashboard/scheduled-messages');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  CHAT NOTES
// =================================================================

export async function getContactNotes(contactId: string) {
    try {
        const { db } = await connectToDatabase();
        const notes = await db.collection('wa_contact_notes').find({ contactId }).sort({ createdAt: -1 }).toArray();
        return { notes: JSON.parse(JSON.stringify(notes)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function addContactNote(prevState: any, formData: FormData) {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const text = formData.get('text') as string;
    if (!contactId || !text) return { error: 'Note text is required.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_contact_notes').insertOne({ contactId, projectId, text, createdAt: new Date() });
        return { message: 'Note added.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteContactNote(noteId: string) {
    if (!ObjectId.isValid(noteId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_contact_notes').deleteOne({ _id: new ObjectId(noteId) });
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  CHAT EXPORT
// =================================================================

export async function exportChatHistory(contactId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const messages = await db.collection('messages').find({ contactId, projectId: new ObjectId(projectId) }).sort({ timestamp: 1 }).toArray();
        return { messages: JSON.parse(JSON.stringify(messages)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  AUTO-REPLY RULES ENGINE
// =================================================================

export async function getAutoReplyRules(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const rules = await db.collection('wa_auto_reply_rules').find({ projectId: new ObjectId(projectId) }).sort({ priority: 1 }).toArray();
        return { rules: JSON.parse(JSON.stringify(rules)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveAutoReplyRule(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const ruleId = formData.get('ruleId') as string;
    const name = formData.get('name') as string;
    const keywords = formData.get('keywords') as string;
    const matchType = formData.get('matchType') as string || 'contains';
    const responseType = formData.get('responseType') as string || 'text';
    const responseText = formData.get('responseText') as string;
    const templateName = formData.get('templateName') as string;
    const isActive = formData.get('isActive') === 'on';
    const timeFrom = formData.get('timeFrom') as string;
    const timeTo = formData.get('timeTo') as string;
    if (!projectId || !name || !keywords) return { error: 'Name and keywords are required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const keywordList = keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        const doc: any = { projectId: new ObjectId(projectId), name, keywords: keywordList, matchType, responseType, responseText: responseText || '', templateName: templateName || '', isActive, timeFrom: timeFrom || '', timeTo: timeTo || '', updatedAt: new Date() };
        if (ruleId && ObjectId.isValid(ruleId)) {
            await db.collection('wa_auto_reply_rules').updateOne({ _id: new ObjectId(ruleId) }, { $set: doc });
        } else {
            doc.createdAt = new Date();
            doc.priority = 0;
            await db.collection('wa_auto_reply_rules').insertOne(doc);
        }
        revalidatePath('/dashboard/auto-reply-rules');
        return { message: 'Rule saved.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteAutoReplyRule(ruleId: string) {
    if (!ObjectId.isValid(ruleId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_auto_reply_rules').deleteOne({ _id: new ObjectId(ruleId) });
        revalidatePath('/dashboard/auto-reply-rules');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  BROADCAST SEGMENTS
// =================================================================

export async function getBroadcastSegments(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const segments = await db.collection('wa_broadcast_segments').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();
        return { segments: JSON.parse(JSON.stringify(segments)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveBroadcastSegment(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const filterTags = formData.get('filterTags') as string;
    const filterLastActive = formData.get('filterLastActive') as string;
    const filterCity = formData.get('filterCity') as string;
    if (!projectId || !name) return { error: 'Segment name is required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const filters: any = {};
        if (filterTags) filters.tags = filterTags.split(',').map(t => t.trim()).filter(Boolean);
        if (filterLastActive) filters.lastActive = filterLastActive;
        if (filterCity) filters.city = filterCity;
        await db.collection('wa_broadcast_segments').insertOne({ projectId: new ObjectId(projectId), name, filters, createdAt: new Date() });
        revalidatePath('/dashboard/broadcast-segments');
        return { message: `Segment "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteBroadcastSegment(segmentId: string) {
    if (!ObjectId.isValid(segmentId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_broadcast_segments').deleteOne({ _id: new ObjectId(segmentId) });
        revalidatePath('/dashboard/broadcast-segments');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  TEMPLATE ANALYTICS
// =================================================================

export async function getTemplateAnalytics(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const pipeline = [
            { $match: { projectId: new ObjectId(projectId), direction: 'out', type: 'template' } },
            { $group: { _id: '$content.templateName', sent: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } }, read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
            { $sort: { sent: -1 } },
        ];
        const analytics = await db.collection('messages').aggregate(pipeline).toArray();
        return { analytics: JSON.parse(JSON.stringify(analytics)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  MESSAGE ANALYTICS (ENHANCED)
// =================================================================

export async function getMessageAnalytics(projectId: string, days: number = 7) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const since = new Date(); since.setDate(since.getDate() - days);
        const pipeline = [
            { $match: { projectId: new ObjectId(projectId), timestamp: { $gte: since } } },
            { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, direction: '$direction' }, count: { $sum: 1 } } },
            { $sort: { '_id.date': 1 } },
        ];
        const data = await db.collection('messages').aggregate(pipeline).toArray();
        // Response time calculation
        const responsePipeline = [
            { $match: { projectId: new ObjectId(projectId), direction: 'out', timestamp: { $gte: since } } },
            { $group: { _id: null, avgResponseMs: { $avg: '$responseTimeMs' }, count: { $sum: 1 } } },
        ];
        const responseData = await db.collection('messages').aggregate(responsePipeline).toArray();
        return { dailyData: JSON.parse(JSON.stringify(data)), responseMetrics: JSON.parse(JSON.stringify(responseData[0] || {})) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  CONTACT GROUPS
// =================================================================

export async function getContactGroups(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const groups = await db.collection('wa_contact_groups').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return { groups: JSON.parse(JSON.stringify(groups)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveContactGroup(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    if (!projectId || !name) return { error: 'Group name is required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_contact_groups').insertOne({ projectId: new ObjectId(projectId), name, description: description || '', memberCount: 0, createdAt: new Date() });
        revalidatePath('/dashboard/contact-groups');
        return { message: `Group "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteContactGroup(groupId: string) {
    if (!ObjectId.isValid(groupId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_contact_groups').deleteOne({ _id: new ObjectId(groupId) });
        revalidatePath('/dashboard/contact-groups');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  OPT-OUT / DND MANAGEMENT
// =================================================================

export async function getOptOutList(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const list = await db.collection('wa_opt_outs').find({ projectId: new ObjectId(projectId) }).sort({ optedOutAt: -1 }).toArray();
        return { optOuts: JSON.parse(JSON.stringify(list)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function addToOptOut(projectId: string, phone: string, reason?: string) {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_opt_outs').updateOne(
            { projectId: new ObjectId(projectId), phone },
            { $set: { reason: reason || 'manual', optedOutAt: new Date() }, $setOnInsert: { projectId: new ObjectId(projectId), phone } },
            { upsert: true }
        );
        revalidatePath('/dashboard/opt-out');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

export async function removeFromOptOut(optOutId: string) {
    if (!ObjectId.isValid(optOutId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_opt_outs').deleteOne({ _id: new ObjectId(optOutId) });
        revalidatePath('/dashboard/opt-out');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  QUICK REPLY CATEGORIES
// =================================================================

export async function getQuickReplyCategories(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const categories = await db.collection('wa_quick_reply_categories').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return { categories: JSON.parse(JSON.stringify(categories)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveQuickReplyCategory(projectId: string, name: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_quick_reply_categories').insertOne({ projectId: new ObjectId(projectId), name, createdAt: new Date() });
        return { message: `Category "${name}" created.` };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  TEAM PERFORMANCE
// =================================================================

export async function getAgentPerformance(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const since = new Date(); since.setDate(since.getDate() - 30);
        const pipeline = [
            { $match: { projectId: new ObjectId(projectId), direction: 'out', timestamp: { $gte: since }, agentId: { $exists: true, $ne: null } } },
            { $group: { _id: '$agentId', messagesSent: { $sum: 1 }, avgResponseMs: { $avg: '$responseTimeMs' } } },
        ];
        const performance = await db.collection('messages').aggregate(pipeline).toArray();
        // Get agent names
        const agentIds = performance.map(p => p._id).filter(Boolean);
        const agents = agentIds.length > 0 ? await db.collection('agents').find({ _id: { $in: agentIds.map((id: string) => new ObjectId(id)) } }).toArray() : [];
        const agentMap = new Map(agents.map(a => [a._id.toString(), a.name]));
        const enriched = performance.map(p => ({ ...p, agentName: agentMap.get(p._id) || 'Unknown' }));
        return { performance: JSON.parse(JSON.stringify(enriched)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  CONVERSATION TAGS
// =================================================================

export async function getConversationTags(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const tags = await db.collection('contacts').distinct('tags', { projectId: new ObjectId(projectId) });
        return { tags: tags.filter(Boolean) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  BLOCKED CONTACTS
// =================================================================

export async function getBlockedContacts(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection('wa_blocked_contacts').find({ projectId: new ObjectId(projectId) }).sort({ blockedAt: -1 }).toArray();
        return { contacts: JSON.parse(JSON.stringify(contacts)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function blockContact(projectId: string, phone: string, reason?: string) {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_blocked_contacts').updateOne(
            { projectId: new ObjectId(projectId), phone },
            { $set: { reason: reason || '', blockedAt: new Date() }, $setOnInsert: { projectId: new ObjectId(projectId), phone } },
            { upsert: true }
        );
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

export async function unblockContact(blockedId: string) {
    if (!ObjectId.isValid(blockedId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_blocked_contacts').deleteOne({ _id: new ObjectId(blockedId) });
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  SAVED REPLIES (ENHANCED CANNED MESSAGES)
// =================================================================

export async function getSavedReplies(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const replies = await db.collection('wa_saved_replies').find({ projectId: new ObjectId(projectId) }).sort({ category: 1, shortcut: 1 }).toArray();
        return { replies: JSON.parse(JSON.stringify(replies)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveSavedReply(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const replyId = formData.get('replyId') as string;
    const shortcut = formData.get('shortcut') as string;
    const title = formData.get('title') as string;
    const body = formData.get('body') as string;
    const category = formData.get('category') as string;
    const mediaUrl = formData.get('mediaUrl') as string;
    if (!projectId || !shortcut || !body) return { error: 'Shortcut and body are required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const doc: any = { projectId: new ObjectId(projectId), shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`, title: title || shortcut, body, category: category || 'General', mediaUrl: mediaUrl || '', updatedAt: new Date() };
        if (replyId && ObjectId.isValid(replyId)) {
            await db.collection('wa_saved_replies').updateOne({ _id: new ObjectId(replyId) }, { $set: doc });
        } else {
            doc.createdAt = new Date();
            await db.collection('wa_saved_replies').insertOne(doc);
        }
        revalidatePath('/dashboard/saved-replies');
        return { message: 'Reply saved.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteSavedReply(replyId: string) {
    if (!ObjectId.isValid(replyId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_saved_replies').deleteOne({ _id: new ObjectId(replyId) });
        revalidatePath('/dashboard/saved-replies');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  CHATBOT RESPONSES
// =================================================================

export async function getChatbotResponses(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const responses = await db.collection('wa_chatbot_responses').find({ projectId: new ObjectId(projectId) }).sort({ trigger: 1 }).toArray();
        return { responses: JSON.parse(JSON.stringify(responses)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveChatbotResponse(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const responseId = formData.get('responseId') as string;
    const trigger = formData.get('trigger') as string;
    const response = formData.get('response') as string;
    const matchType = formData.get('matchType') as string || 'contains';
    const isActive = formData.get('isActive') === 'on';
    if (!projectId || !trigger || !response) return { error: 'Trigger and response are required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const doc: any = { projectId: new ObjectId(projectId), trigger: trigger.toLowerCase(), response, matchType, isActive, updatedAt: new Date() };
        if (responseId && ObjectId.isValid(responseId)) {
            await db.collection('wa_chatbot_responses').updateOne({ _id: new ObjectId(responseId) }, { $set: doc });
        } else {
            doc.createdAt = new Date();
            await db.collection('wa_chatbot_responses').insertOne(doc);
        }
        revalidatePath('/dashboard/chatbot');
        return { message: 'Chatbot response saved.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteChatbotResponse(responseId: string) {
    if (!ObjectId.isValid(responseId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_chatbot_responses').deleteOne({ _id: new ObjectId(responseId) });
        revalidatePath('/dashboard/chatbot');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  BUSINESS HOURS
// =================================================================

export async function getBusinessHours(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const hours = await db.collection('wa_business_hours').findOne({ projectId: new ObjectId(projectId) });
        return { hours: hours ? JSON.parse(JSON.stringify(hours)) : null };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveBusinessHours(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const timezone = formData.get('timezone') as string;
    const offlineMessage = formData.get('offlineMessage') as string;
    const scheduleJson = formData.get('schedule') as string;
    if (!projectId) return { error: 'Project ID is required.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        let schedule = {};
        try { schedule = JSON.parse(scheduleJson); } catch {}
        await db.collection('wa_business_hours').updateOne(
            { projectId: new ObjectId(projectId) },
            { $set: { timezone: timezone || 'UTC', offlineMessage: offlineMessage || '', schedule, updatedAt: new Date() }, $setOnInsert: { projectId: new ObjectId(projectId), createdAt: new Date() } },
            { upsert: true }
        );
        revalidatePath('/dashboard/business-hours');
        return { message: 'Business hours saved.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  SATISFACTION RATINGS
// =================================================================

export async function getChatRatings(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const ratings = await db.collection('wa_chat_ratings').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).limit(100).toArray();
        const pipeline = [
            { $match: { projectId: new ObjectId(projectId) } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 }, five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }, four: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }, three: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } }, two: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } }, one: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } } } },
        ];
        const summary = await db.collection('wa_chat_ratings').aggregate(pipeline).toArray();
        return { ratings: JSON.parse(JSON.stringify(ratings)), summary: JSON.parse(JSON.stringify(summary[0] || {})) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function submitChatRating(projectId: string, contactId: string, rating: number, feedback?: string) {
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_chat_ratings').insertOne({ projectId: new ObjectId(projectId), contactId, rating, feedback: feedback || '', createdAt: new Date() });
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  LINK TRACKING
// =================================================================

export async function getLinkClicks(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const clicks = await db.collection('wa_link_clicks').find({ projectId: new ObjectId(projectId) }).sort({ clickedAt: -1 }).limit(500).toArray();
        return { clicks: JSON.parse(JSON.stringify(clicks)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

// =================================================================
//  CONVERSATION ASSIGNMENT
// =================================================================

export async function getUnassignedConversations(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection('contacts').find({
            projectId: new ObjectId(projectId),
            $or: [{ assignedAgentId: null }, { assignedAgentId: { $exists: false } }],
            status: { $ne: 'resolved' }
        }).sort({ lastMessageTimestamp: -1 }).limit(50).toArray();
        return { contacts: JSON.parse(JSON.stringify(contacts)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function assignConversation(contactId: string, agentId: string) {
    try {
        const { db } = await connectToDatabase();
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { assignedAgentId: agentId, assignedAt: new Date() } });
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}

// =================================================================
//  MEDIA LIBRARY
// =================================================================

export async function getMediaLibrary(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        const media = await db.collection('wa_media_library').find({ projectId: new ObjectId(projectId) }).sort({ uploadedAt: -1 }).limit(100).toArray();
        return { media: JSON.parse(JSON.stringify(media)) };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function saveMediaItem(projectId: string, name: string, url: string, type: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_media_library').insertOne({ projectId: new ObjectId(projectId), name, url, type, uploadedAt: new Date() });
        revalidatePath('/dashboard/media-library');
        return { message: 'Media saved.' };
    } catch (e: any) { return { error: getErrorMessage(e) }; }
}

export async function deleteMediaItem(mediaId: string) {
    if (!ObjectId.isValid(mediaId)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('wa_media_library').deleteOne({ _id: new ObjectId(mediaId) });
        revalidatePath('/dashboard/media-library');
        return { success: true };
    } catch (e: any) { return { success: false, error: getErrorMessage(e) }; }
}
