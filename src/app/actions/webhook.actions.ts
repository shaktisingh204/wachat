

'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, WithId, Filter } from "mongodb";
import { getProjectById, getAdminSession } from ".";
import { handleSingleMessageEvent, processStatusUpdateBatch, processSingleWebhook } from "@/lib/webhook-processor";
import type { WebhookLog, Project, WebhookLogListItem } from "@/lib/definitions";

function getEventSummaryForLog(log: WithId<WebhookLog>): string {
    try {
        const change = log?.payload?.entry?.[0]?.changes?.[0];
        if (!change) return 'No changes found';

        const value = change.value;
        const field = change.field;

        if (!value) return `Event: ${field} (no value)`;

        switch(field) {
            case 'messages':
                if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
                    const status = value.statuses[0];
                    return `Status: ${status.status} to ${status.recipient_id}`;
                }
                if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
                    const message = value.messages[0];
                    const from = message.from || 'unknown';
                    const type = message.type || 'unknown';
                    if (type === 'text') {
                        const body = message.text?.body || '';
                        const bodyPreview = body.substring(0, 30);
                        return `Message from ${from}: "${bodyPreview}${body.length > 30 ? '...' : ''}"`;
                    }
                    if (type === 'interactive' && message.interactive?.button_reply?.title) {
                        return `Button click from ${from}: "${message.interactive.button_reply.title}"`;
                    }
                    return `Message from ${from} (${type})`;
                }
                return 'Message event with unknown content';
            case 'account_review_update':
                return `Account review decision: ${value.decision}`;
            case 'message_template_status_update':
            case 'template_status_update':
                return `Template '${value.message_template_name}' update: ${value.event}`;
            case 'phone_number_quality_update':
                return `Phone number quality update: ${value.event} (Limit: ${value.current_limit})`;
            case 'phone_number_name_update':
                return `Name update for ${value.display_phone_number}: ${value.decision}`;
            default:
                if (value.event) return `Event: ${value.event}`;
                return `General Update for ${field}`;
        }
    } catch(e: any) {
         console.error("Error parsing summary:", e, log);
         return 'Could not parse summary details';
    }
}


export async function getWebhookLogs(
    projectId: string | null,
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ logs: WebhookLogListItem[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<WebhookLog> = {};

        if (projectId && ObjectId.isValid(projectId)) {
            filter.projectId = new ObjectId(projectId);
        }

        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            if (filter.searchableText) {
                filter.$and = [
                    { searchableText: filter.searchableText },
                    { searchableText: queryRegex }
                ];
                delete filter.searchableText;
            } else {
                filter.searchableText = queryRegex;
            }
        }
        
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const skip = (safePage - 1) * safeLimit;

        const [fullLogs, total] = await Promise.all([
            db.collection<WithId<WebhookLog>>('webhook_logs').find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).toArray(),
            db.collection('webhook_logs').countDocuments(filter)
        ]);

        const logsForClient = fullLogs.map(log => ({
            _id: log._id.toString(),
            createdAt: log.createdAt.toISOString(),
            eventField: log.payload?.entry?.[0]?.changes?.[0]?.field || 'N/A',
            eventSummary: getEventSummaryForLog(log)
        }));
        
        return { logs: JSON.parse(JSON.stringify(logsForClient)), total };
    } catch (error) {
        console.error('Failed to fetch webhook logs:', error);
        return { logs: [], total: 0 };
    }
}

export async function getWebhookLogPayload(logId: string): Promise<any | null> {
    if (!ObjectId.isValid(logId)) {
        return null;
    }
    try {
        const { db } = await connectToDatabase();
        const log = await db.collection('webhook_logs').findOne({ _id: new ObjectId(logId) }, { projection: { payload: 1 } });
        return log ? JSON.parse(JSON.stringify(log.payload)) : null;
    } catch (error) {
        console.error('Failed to fetch webhook log payload:', error);
        return null;
    }
}

export async function handleReprocessWebhook(logId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(logId)) {
        return { error: 'Invalid Log ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const log = await db.collection('webhook_logs').findOne({ _id: new ObjectId(logId) });

        if (!log) {
            return { error: 'Webhook log not found.' };
        }
        
        const projectId = log.projectId;
        if (!projectId) {
            return { error: 'Cannot reprocess: Log is not associated with a project.' };
        }
        const project = await db.collection<Project>('projects').findOne({_id: projectId});
        if (!project) {
            return { error: `Cannot reprocess: Project ${projectId} not found.`};
        }

        const payload = log.payload;
        const change = payload.entry?.[0]?.changes?.[0];
        if (!change) {
            return { error: 'Cannot reprocess: Invalid payload structure.' };
        }

        const value = change.value;
        const field = change.field;

        if (field === 'messages' && value) {
            if (value.statuses) {
                await processStatusUpdateBatch(db, value.statuses);
            }
            if (value.messages) {
                for (const message of value.messages) {
                     const contactProfile = value.contacts?.find((c: any) => c.wa_id === message.from) || {};
                     const phoneNumberId = value.metadata?.phone_number_id;
                     if (!phoneNumberId) {
                         throw new Error("Cannot process message: phone_number_id is missing from webhook metadata.");
                     }
                     await handleSingleMessageEvent(db, project, message, contactProfile, phoneNumberId);
                }
            }
        } else {
            await processSingleWebhook(db, project, payload, log._id);
        }

        await db.collection('webhook_logs').updateOne({ _id: log._id }, { $set: { processed: true, error: null }});

        return { message: `Successfully re-processed event: ${field || 'unknown'}` };
    } catch (e: any) {
        console.error("Failed to re-process webhook:", e);
        return { error: e.message || "An unexpected error occurred during re-processing." };
    }
}

export async function handleClearProcessedLogs(): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('webhook_logs').deleteMany({ processed: true });
        
        revalidatePath('/dashboard/webhooks');

        return { message: `Successfully cleared ${result.deletedCount} processed webhook log(s).` };
    } catch (e: any) {
        console.error('Failed to clear processed logs:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}
