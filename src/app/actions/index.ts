'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { processSingleWebhook, handleSingleMessageEvent, processStatusUpdateBatch } from '@/lib/webhook-processor';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { intelligentTranslate } from '@/ai/flows/intelligent-translate-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, comparePassword, createSessionToken, verifySessionToken, createAdminSessionToken, verifyAdminSessionToken, type SessionPayload, type AdminSessionPayload } from '@/lib/auth';
import { createHash } from 'crypto';
import { premadeTemplates } from '@/lib/premade-templates';
import { getMetaFlows } from './actions/meta-flow.actions';
import { getErrorMessage } from '@/lib/utils';
// Re-exports for server actions are handled by direct imports in components now.
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limiter';
import { decodeJwt } from 'jose';


import type {
    Plan,
    User,
    Invitation,
    Transaction,
    BroadcastAttempt,
    Notification,
    NotificationWithProject,
    Contact,
    AnyMessage,
    LibraryTemplate,
    TemplateCategory,
    CannedMessage,
    FlowLogEntry,
    FlowLog,
    PaymentGatewaySettings,
    WebhookLogListItem,
    Project, 
    Template, 
    PhoneNumber, 
    AutoReplySettings, 
    Flow, 
    FlowNode, 
    FlowEdge, 
    OptInOutSettings, 
    UserAttribute, 
    Agent, 
    MetaFlow, 
    Tag,
    WebhookLog,
    MetaPhoneNumber,
    MetaPhoneNumbersResponse,
    MetaTemplate,
    MetaTemplatesResponse,
    MetaWaba,
    MetaWabasResponse,
    BroadcastJob,
    BroadcastState,
    CreateTemplateState,
    UpdateProjectSettingsState,
    InitiatePaymentResult,
    AdminUserView,
    KanbanColumnData,
    OutgoingMessage,
} from '@/lib/definitions';


export async function getSession(): Promise<{ user: Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null, tags?: Tag[] } } | null> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');
    const sessionToken = sessionCookie?.value;

    if (!sessionToken) {
        return null;
    }

    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(payload.userId) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return null;
        }

        return { user: JSON.parse(JSON.stringify(user)) };
    } catch (error) {
        console.error("Error fetching session user from DB:", error);
        return null;
    }
}

export async function getAdminSession(): Promise<{ isAdmin: boolean }> {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('admin_session');
    const sessionToken = sessionCookie?.value;
    
    if (!sessionToken) {
        return { isAdmin: false };
    }

    const payload = await verifyAdminSessionToken(sessionToken);
    if (payload && payload.role === 'admin') {
        return { isAdmin: true };
    }

    return { isAdmin: false };
}


export async function handleSuggestContent(topic: string): Promise<{ suggestions?: string[]; error?: string }> {
  if (!topic) {
    const error = 'Topic cannot be empty.';
    return { error };
  }

  try {
    const result = await suggestTemplateContent({ topic });
    return { suggestions: result.suggestions };
  } catch (e: any) {
    return { error: e.message || 'Failed to generate suggestions. Please try again.' };
  }
}

export async function getProjects(query?: string, moduleType: 'whatsapp' | 'facebook' | 'all' = 'all'): Promise<WithId<Project>[]> {
    const session = await getSession();
    if (!session?.user) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId }
            ]
        };
        
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        if (moduleType === 'whatsapp') {
            filter.wabaId = { $exists: true, $ne: null };
        } else if (moduleType === 'facebook') {
            filter.facebookPageId = { $exists: true, $ne: null };
            filter.wabaId = { $exists: false }; // a project with both is a whatsapp project
        }
        
        const projects = await db.collection('projects').aggregate([
            { $match: filter },
            { $sort: { name: 1 } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            {
                $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
            },
            {
                $addFields: {
                    plan: '$planInfo'
                }
            },
            {
                $project: {
                    planInfo: 0
                }
            }
        ]).toArray();

        return JSON.parse(JSON.stringify(projects));
    } catch (error) {
        console.error("Failed to fetch projects for user:", error);
        return [];
    }
}

export async function getProjectCount(): Promise<number> {
    const session = await getSession();
    if (!session?.user) {
        return 0;
    }
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<Project> = {
            $or: [
                { userId: userObjectId },
                { 'agents.userId': userObjectId }
            ]
        };
        
        const count = await db.collection('projects').countDocuments(filter);
        return count;
    } catch (error) {
        console.error("Failed to fetch project count for user:", error);
        return 0;
    }
}

export async function getAllProjectsForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ projects: WithId<Project>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { projects: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { wabaId: { $regex: query, $options: 'i' } },
            ];
        }

        const sanePage = Math.max(1, page);
        const skip = (sanePage - 1) * limit;

        const [projects, total] = await Promise.all([
            db.collection('projects').aggregate([
                { $match: filter },
                { $sort: { name: 1 } },
                { $skip: skip },
                { $limit: limit },
                 {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'planInfo'
                    }
                },
                {
                    $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
                },
                {
                    $addFields: {
                        plan: '$planInfo'
                    }
                },
                {
                    $project: {
                        planInfo: 0
                    }
                }
            ]).toArray(),
            db.collection('projects').countDocuments(filter)
        ]);
        
        return { projects: JSON.parse(JSON.stringify(projects)), total };
    } catch (error) {
        console.error("Failed to fetch all projects for admin:", error);
        return { projects: [], total: 0 };
    }
}


export async function getProjectById(projectId: string): Promise<WithId<Project> | null> {
    const session = await getSession();
    const { isAdmin } = await getAdminSession();

    if (!session?.user && !isAdmin) {
        return null;
    }
    try {
        if (!ObjectId.isValid(projectId)) {
            console.error("Invalid Project ID in getProjectById:", projectId);
            return null;
        }
        const { db } = await connectToDatabase();
        
        const projectResult = await db.collection<Project>('projects').aggregate([
            { $match: { _id: new ObjectId(projectId) } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            {
                $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true }
            },
            {
                $addFields: {
                    plan: '$planInfo'
                }
            },
            {
                $project: {
                    planInfo: 0
                }
            }
        ]).toArray();

        const project = projectResult[0] as WithId<Project> | undefined;

        if (!project) {
            return null;
        }
        
        if (isAdmin) {
            return JSON.parse(JSON.stringify(project));
        }

        if (session?.user) {
            const isOwner = project.userId.toString() === session.user._id.toString();
            const isAgent = project.agents?.some(agent => agent.userId.toString() === session.user._id.toString());

            if (isOwner || isAgent) {
                return JSON.parse(JSON.stringify(project));
            }
        }
        
        console.error(`User does not have permission to access project ${projectId}.`);
        return null;

    } catch (error: any) {
        console.error("Exception in getProjectById:", error);
        return null;
    }
}

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20,
): Promise<{ broadcasts: WithId<any>[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { broadcasts: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;

        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcasts').countDocuments({})
        ]);
        
        return { broadcasts: JSON.parse(JSON.stringify(broadcasts)), total };
    } catch (error) {
        console.error('Failed to fetch all broadcasts:', error);
        return { broadcasts: [], total: 0 };
    }
}

export async function getDashboardStats(projectId: string): Promise<{
    totalMessages: number;
    totalSent: number;
    totalFailed: number;
    totalDelivered: number;
    totalRead: number;
    totalCampaigns: number;
} | null> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return null;

    const defaultStats = { totalMessages: 0, totalSent: 0, totalFailed: 0, totalDelivered: 0, totalRead: 0, totalCampaigns: 0 };
    if (!ObjectId.isValid(projectId)) {
        return defaultStats;
    }
    try {
        const { db } = await connectToDatabase();
        const stats = await db.collection('broadcasts').aggregate([
            { $match: { projectId: new ObjectId(projectId) } },
            {
                $group: {
                    _id: null,
                    totalMessages: { $sum: '$contactCount' },
                    totalSent: { $sum: '$successCount' },
                    totalFailed: { $sum: '$errorCount' },
                    totalDelivered: { $sum: { $ifNull: [ '$deliveredCount', 0 ] } },
                    totalRead: { $sum: { $ifNull: [ '$readCount', 0 ] } },
                    totalCampaigns: { $sum: 1 }
                }
            }
        ]).toArray();

        if (stats.length > 0) {
            const { _id, ...rest } = stats[0];
            return {
                totalMessages: rest.totalMessages || 0,
                totalSent: rest.totalSent || 0,
                totalFailed: rest.totalFailed || 0,
                totalDelivered: rest.totalDelivered || 0,
                totalRead: rest.totalRead || 0,
                totalCampaigns: rest.totalCampaigns || 0,
            };
        }
        return defaultStats;
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return defaultStats;
    }
}

export async function getBroadcastById(broadcastId: string) {
    if (!ObjectId.isValid(broadcastId)) {
        console.error("Invalid Broadcast ID in getBroadcastById:", broadcastId);
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const broadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(broadcastId) });
        if (!broadcast) return null;
        
        const hasAccess = await getProjectById(broadcast.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(broadcast));
    } catch (error) {
        console.error('Failed to fetch broadcast by ID:', error);
        return null;
    }
}

export async function handleTranslateMessage(text: string): Promise<{ translatedText?: string; error?: string }> {
    if (!text) return { error: 'No text to translate.' };
    try {
        const result = await intelligentTranslate({ text, targetLanguage: 'English' });
        return { translatedText: result.translatedText };
    } catch (e: any) {
        return { error: e.message || 'Translation failed.' };
    }
}

export async function handleRunCron(): Promise<{ message?: string; error?: string }> {
    try {
        const result = await processBroadcastJob();
        if (result.jobs && result.jobs.length > 0) {
            const successCount = result.jobs.reduce((acc, j) => acc + (j.success || 0), 0);
            const failedCount = result.jobs.reduce((acc, j) => acc + (j.failed || 0), 0);
            return { message: `Cron run complete. Processed ${result.jobs.length} job(s). ${successCount} successful, ${failedCount} failed.` };
        }
        return { message: result.message || 'Cron run completed successfully. No new jobs to process.' };
    } catch (e: any) {
        console.error('Manual cron run failed:', e);
        return { error: e.message || 'An unexpected error occurred while running the scheduler.' };
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

        const skip = (page - 1) * limit;

        const [fullLogs, total] = await Promise.all([
            db.collection<WithId<WebhookLog>>('webhook_logs').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
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

export async function getPaymentGatewaySettings(): Promise<WithId<PaymentGatewaySettings> | null> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return null;

    try {
        const { db } = await connectToDatabase();
        const settings = await db.collection('system_settings').findOne({ _id: 'phonepe' });
        return settings ? JSON.parse(JSON.stringify(settings)) : null;
    } catch (error) {
        console.error('Failed to fetch payment gateway settings:', error);
        return null;
    }
}

export async function savePaymentGatewaySettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const settings: Omit<PaymentGatewaySettings, '_id'> = {
        merchantId: formData.get('merchantId') as string,
        saltKey: formData.get('saltKey') as string,
        saltIndex: formData.get('saltIndex') as string,
        environment: formData.get('environment') as 'staging' | 'production',
    };

    if (!settings.merchantId || !settings.saltKey || !settings.saltIndex) {
        return { error: 'All PhonePe setting fields are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('system_settings').updateOne(
            { _id: 'phonepe' },
            { $set: settings },
            { upsert: true }
        );

        revalidatePath('/admin/dashboard/system');
        return { message: 'PhonePe settings saved successfully!' };
    } catch (e: any) {
        console.error('Failed to save payment gateway settings:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleInitiatePayment(planId: string, projectId?: string): Promise<InitiatePaymentResult> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to purchase a plan.' };
    }

    if (!ObjectId.isValid(planId) || (projectId && !ObjectId.isValid(projectId))) {
        return { error: 'Invalid plan or project selected.' };
    }

    const { db } = await connectToDatabase();
    try {
        const [plan, project] = await Promise.all([
            db.collection<Plan>('plans').findOne({ _id: new ObjectId(planId) }),
            projectId ? getProjectById(projectId) : Promise.resolve(null)
        ]);
        
        if (!plan) return { error: 'Selected plan not found.' };

        const pgSettings = await getPaymentGatewaySettings();
        if (!pgSettings) return { error: 'Payment gateway is not configured. Please contact support.' };
        const { merchantId, saltKey, saltIndex, environment } = pgSettings;
        if (!merchantId || !saltKey || !saltIndex) {
            return { error: 'Payment gateway credentials are not fully configured.' };
        }

        const now = new Date();
        const newTransaction: Omit<Transaction, '_id'> = {
            userId: new ObjectId(session.user._id),
            ...(projectId && { projectId: new ObjectId(projectId) }),
            planId: new ObjectId(planId),
            amount: plan.price * 100,
            status: 'PENDING',
            provider: 'phonepe',
            createdAt: now,
            updatedAt: now,
            type: 'PLAN',
            description: project ? `Upgrade ${project.name} to ${plan.name} Plan` : `Purchase ${plan.name} Plan`,
        };
        const transactionResult = await db.collection('transactions').insertOne(newTransaction as any);
        const merchantTransactionId = transactionResult.insertedId.toString();

        const paymentData = {
            merchantId: merchantId,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: session.user._id.toString(),
            amount: plan.price * 100,
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/${merchantTransactionId}`,
            redirectMode: 'POST',
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
            mobileNumber: '9999999999', 
            paymentInstrument: {
                type: 'PAY_PAGE',
            },
        };

        const payload = JSON.stringify(paymentData);
        const payloadBase64 = Buffer.from(payload).toString('base64');
        const apiEndpoint = '/pg/v1/pay';

        const stringToHash = payloadBase64 + apiEndpoint + saltKey;
        const sha256 = createHash('sha256').update(stringToHash).digest('hex');
        const checksum = sha256 + '###' + saltIndex;

        const hostUrl = environment === 'production' 
            ? 'https://api.phonepe.com/apis/hermes'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

        const response = await axios.post(
            `${hostUrl}${apiEndpoint}`,
            { request: payloadBase64 },
            { headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'Accept': 'application/json' } }
        );

        const redirectUrl = response.data?.data?.instrumentResponse?.redirectInfo?.url;
        if (!redirectUrl) {
            console.error('PhonePe response error:', response.data);
            return { error: `Failed to get payment URL from PhonePe: ${response.data?.message || 'Unknown error'}` };
        }
        
        return { redirectUrl };

    } catch (e: any) {
        console.error("Payment initiation failed:", e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleInitiateCreditPurchase(credits: number, amount: number, projectId?: string): Promise<InitiatePaymentResult> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to purchase credits.' };
    }
    if (!credits || !amount || credits <= 0 || amount <= 0) {
        return { error: 'Invalid credit or amount value.' };
    }

    const { db } = await connectToDatabase();
    try {
        const pgSettings = await getPaymentGatewaySettings();
        if (!pgSettings) return { error: 'Payment gateway is not configured. Please contact support.' };

        const { merchantId, saltKey, saltIndex, environment } = pgSettings;
        if (!merchantId || !saltKey || !saltIndex) {
            return { error: 'Payment gateway credentials are not fully configured.' };
        }

        const now = new Date();
        const newTransaction: Omit<Transaction, '_id'> = {
            userId: new ObjectId(session.user._id),
            ...(projectId && ObjectId.isValid(projectId) && { projectId: new ObjectId(projectId) }),
            amount: amount * 100, 
            status: 'PENDING',
            provider: 'phonepe',
            createdAt: now,
            updatedAt: now,
            type: 'CREDITS',
            description: `Purchase of ${credits.toLocaleString()} Credits`,
            credits,
        };
        const transactionResult = await db.collection('transactions').insertOne(newTransaction as any);
        const merchantTransactionId = transactionResult.insertedId.toString();

        const paymentData = {
            merchantId: merchantId,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: session.user._id.toString(),
            amount: amount * 100,
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/${merchantTransactionId}`,
            redirectMode: 'POST',
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
            mobileNumber: '9999999999',
            paymentInstrument: { type: 'PAY_PAGE' },
        };

        const payload = JSON.stringify(paymentData);
        const payloadBase64 = Buffer.from(payload).toString('base64');
        const apiEndpoint = '/pg/v1/pay';
        const stringToHash = payloadBase64 + apiEndpoint + saltKey;
        const sha256 = createHash('sha256').update(stringToHash).digest('hex');
        const checksum = sha256 + '###' + saltIndex;
        const hostUrl = environment === 'production' 
            ? 'https://api.phonepe.com/apis/hermes'
            : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

        const response = await axios.post(
            `${hostUrl}${apiEndpoint}`,
            { request: payloadBase64 },
            { headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'Accept': 'application/json' } }
        );

        const redirectUrl = response.data?.data?.instrumentResponse?.redirectInfo?.url;
        if (!redirectUrl) {
            console.error('PhonePe response error:', response.data);
            return { error: `Failed to get payment URL from PhonePe: ${response.data?.message || 'Unknown error'}` };
        }
        
        return { redirectUrl };

    } catch (e: any) {
        console.error("Credit purchase initiation failed:", e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}


export async function getTransactionsForUser(): Promise<WithId<Transaction>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    
    try {
        const { db } = await connectToDatabase();
        const transactions = await db.collection('transactions').find({
            userId: new ObjectId(session.user._id)
        }).sort({ createdAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(transactions));
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return [];
    }
}


export async function getTransactionStatus(transactionId: string): Promise<WithId<Transaction> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!ObjectId.isValid(transactionId)) return null;
    
    try {
        const { db } = await connectToDatabase();
        const transaction = await db.collection<Transaction>('transactions').findOne({
            _id: new ObjectId(transactionId),
            userId: new ObjectId(session.user._id)
        });
        return transaction ? JSON.parse(JSON.stringify(transaction)) : null;
    } catch (error) {
        console.error("Failed to fetch transaction:", error);
        return null;
    }
}

export async function handleLogin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(ip, 5, 60 * 1000); // 5 requests per minute
    if (!rateLimitSuccess) {
        return { error: rateLimitError };
    }
    
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required.' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { error: 'Please enter a valid email address.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ email: email.toLowerCase() });

        if (!user || !user.password) {
            return { error: 'Invalid credentials.' };
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            return { error: 'Invalid credentials.' };
        }

        const sessionToken = await createSessionToken({ userId: user._id.toString(), email: user.email });
        cookies().set('session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    } catch (e: any) {
        console.error('Login failed:', e);
        return { error: 'An unexpected error occurred.' };
    }
    
    redirect('/dashboard');
}

export async function handleAdminLogin(prevState: any, formData: FormData): Promise<{ error?: string }> {
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || '127.0.0.1';

    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`admin:${ip}`, 5, 60 * 1000); // 5 requests per minute
    if (!rateLimitSuccess) {
        return { error: rateLimitError };
    }

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@wachat.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const adminSessionToken = await createAdminSessionToken();
        cookies().set('admin_session', adminSessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
        redirect('/admin/dashboard');
    }

    return { error: 'Invalid admin credentials.' };
}

export async function handleSignup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!name || !email || !password) {
        return { error: 'All fields are required.' };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
        return { error: 'Name cannot be empty.' };
    }
    if (trimmedName.length > 50) {
        return { error: 'Name cannot exceed 50 characters.' };
    }
    if (!/[a-zA-Z]/.test(trimmedName)) {
        return { error: 'Name must contain at least one letter.' };
    }

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return { error: 'An account with this email already exists.' };
        }

        const hashedPassword = await hashPassword(password);
        
        const newUser: Omit<User, '_id'> = {
            name: trimmedName,
            email: email.toLowerCase(),
            password: hashedPassword,
            createdAt: new Date(),
        };

        await db.collection('users').insertOne(newUser as any);
    } catch (e: any) {
        console.error('Signup failed:', e);
        return { error: 'An unexpected error occurred.' };
    }

    redirect('/login');
}

export async function handleForgotPassword(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const email = formData.get('email') as string;
    if (!email) return { error: 'Email address is required.' };
    
    // In a real app, you would generate a unique token, save it to the DB with an expiry,
    // and send an email with a reset link.
    // For this prototype, we'll just simulate success.
    console.log(`Password reset requested for: ${email}`);
    
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
}


export async function handleUpdateUserProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const name = formData.get('name') as string;
    const tagsJson = formData.get('tags') as string;

    const updates: any = {};
    if (name) {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return { error: 'Name cannot be empty.' };
        }
        if (trimmedName.length > 50) {
            return { error: 'Name cannot exceed 50 characters.' };
        }
        if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
             return { error: 'Name can only contain letters, spaces, apostrophes, and hyphens.' };
        }
         if (!/[a-zA-Z]/.test(trimmedName)) {
            return { error: 'Name must contain at least one letter.' };
        }
        updates.name = trimmedName;
    }
    
    if (tagsJson) {
      try {
        updates.tags = JSON.parse(tagsJson);
      } catch (e) {
        return { error: 'Invalid tags format.'};
      }
    }

    if (Object.keys(updates).length === 0) return { error: 'No changes detected.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: updates }
        );
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard/url-shortener');
        revalidatePath('/dashboard/settings');
        return { message: 'Profile updated successfully.' };
    } catch (e: any) {
        return { error: 'Failed to update profile.' };
    }
}

export async function handleChangePassword(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: 'All password fields are required.' };
    }
    if (newPassword !== confirmPassword) {
        return { error: 'New passwords do not match.' };
    }
    if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user || !user.password) return { error: 'User not found or password not set.' };

        const passwordMatch = await comparePassword(currentPassword, user.password);
        if (!passwordMatch) return { error: 'Incorrect current password.' };

        const hashedNewPassword = await hashPassword(newPassword);
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: hashedNewPassword } }
        );

        revalidatePath('/dashboard/profile');
        return { message: 'Password updated successfully.' };
    } catch (e: any) {
        return { error: 'Failed to update password.' };
    }
}

export async function handleInviteAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!projectId || !email || !role) return { error: 'Missing required fields.' };
    if (!ObjectId.isValid(projectId)) return { error: 'Invalid project ID.' };

    try {
        const { db } = await connectToDatabase();
        const project = await getProjectById(projectId);

        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'Project not found or you are not the owner.' };
        }
        
        if (!project.plan) return { error: 'Could not determine your plan limits.' };
        const plan = project.plan;

        const currentAgentCount = project.agents?.length || 0;
        if (currentAgentCount >= (plan.agentLimit || 0)) {
            return { error: `You have reached your agent limit of ${plan.agentLimit}. Please upgrade your plan.` };
        }

        const invitee = await db.collection('users').findOne({ email });
        if (!invitee) {
            return { error: `No user found with the email "${email}". Please ask them to sign up first.` };
        }

        if (invitee._id.toString() === session.user._id.toString()) {
            return { error: "You cannot invite yourself." };
        }

        if (project.agents?.some(agent => agent.userId.toString() === invitee._id.toString())) {
            return { error: "This user is already an agent on this project." };
        }

        const newInvitation: Omit<Invitation, '_id'> = {
            projectId: project._id,
            projectName: project.name,
            inviterId: new ObjectId(session.user._id),
            inviterName: session.user.name,
            inviteeEmail: email,
            role,
            status: 'pending',
            createdAt: new Date(),
        };

        await db.collection('invitations').insertOne(newInvitation as any);
        
        revalidatePath('/dashboard/settings');
        return { message: `Invitation sent to ${email}.` };

    } catch (e: any) {
        console.error("Agent invitation failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleRemoveAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const agentUserId = formData.get('agentUserId') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!projectId || !agentUserId) return { error: 'Missing required fields.' };
    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(agentUserId)) return { error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'Project not found or you are not the owner.' };
        }

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $pull: { agents: { userId: new ObjectId(agentUserId) } } }
        );
        
        revalidatePath('/dashboard/settings');
        return { message: 'Agent removed successfully.' };

    } catch (e: any) {
        console.error("Agent removal failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function getInvitationsForUser(): Promise<WithId<Invitation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const invitations = await db.collection('invitations').find({
            inviteeEmail: session.user.email,
            status: 'pending'
        }).sort({ createdAt: -1 }).toArray();

        return JSON.parse(JSON.stringify(invitations));
    } catch (e) {
        return [];
    }
}

export async function handleRespondToInvite(invitationId: string, accepted: boolean): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    if (!ObjectId.isValid(invitationId)) return { success: false, error: 'Invalid invitation ID.' };

    try {
        const { db } = await connectToDatabase();
        const invite = await db.collection<Invitation>('invitations').findOne({ _id: new ObjectId(invitationId) });

        if (!invite || invite.inviteeEmail !== session.user.email) {
            return { success: false, error: 'Invitation not found or not intended for you.' };
        }

        if (accepted) {
            const agent: Agent = {
                userId: new ObjectId(session.user._id),
                email: session.user.email,
                name: session.user.name,
                role: invite.role,
            };
            await db.collection('projects').updateOne(
                { _id: invite.projectId },
                { $addToSet: { agents: agent } }
            );
        }

        await db.collection('invitations').deleteOne({ _id: new ObjectId(invitationId) });
        
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard', 'layout');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


export async function getAllNotifications(
    page: number = 1,
    limit: number = 20,
    eventTypeFilter?: string,
    projectId?: string | null,
): Promise<{ notifications: WithId<NotificationWithProject>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notifications: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        
        const filter: Filter<Notification> = {};

        if (projectId && ObjectId.isValid(projectId)) {
            // Ensure the user has access to this specific project
            const hasAccess = await db.collection('projects').findOne({
                _id: new ObjectId(projectId),
                $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
            });
            if (!hasAccess) return { notifications: [], total: 0 };
            filter.projectId = new ObjectId(projectId);
        } else {
             // If no specific project, get notifications for all accessible projects
            const projectFilter: Filter<Project> = {
                $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
            };
            const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
            const accessibleProjectIds = accessibleProjects.map(p => p._id);
            filter.projectId = { $in: accessibleProjectIds };
        }
        
        if (eventTypeFilter) {
            filter.eventType = eventTypeFilter;
        }

        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            db.collection('notifications').aggregate<WithId<NotificationWithProject>>([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'projects',
                        localField: 'projectId',
                        foreignField: '_id',
                        as: 'projectInfo'
                    }
                },
                {
                    $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true }
                },
                {
                    $addFields: {
                        projectName: '$projectInfo.name'
                    }
                },
                {
                    $project: { projectInfo: 0 }
                }
            ]).toArray(),
            db.collection('notifications').countDocuments(filter)
        ]);
        
        return { notifications: JSON.parse(JSON.stringify(notifications)), total };
    } catch (e: any) {
        return { notifications: [], total: 0 };
    }
}

export async function getNotifications(projectId?: string | null): Promise<WithId<NotificationWithProject>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        
        const projectFilter: Filter<Project> = {
            $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
        };
        const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);

        const filter: Filter<Notification> = { projectId: { $in: accessibleProjectIds } };

        const notifications = await db.collection('notifications').aggregate<WithId<NotificationWithProject>>([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $limit: 20 },
            { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'projectInfo' } },
            { $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true } },
            { $addFields: { projectName: '$projectInfo.name' } },
            { $project: { projectInfo: 0 } }
        ]).toArray();
        return JSON.parse(JSON.stringify(notifications));
    } catch (e) {
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('notifications').updateOne({ _id: new ObjectId(notificationId) }, { $set: { isRead: true } });
    revalidatePath('/dashboard/notifications');
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean, updatedCount?: number }> {
    const session = await getSession();
    if (!session?.user) return { success: false };

    try {
        const { db } = await connectToDatabase();
        const projectFilter: Filter<Project> = {
            $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
        };
        const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        
        const result = await db.collection('notifications').updateMany(
            { projectId: { $in: accessibleProjectIds }, isRead: false },
            { $set: { isRead: true } }
        );
        revalidatePath('/dashboard/notifications');
        revalidatePath('/dashboard', 'layout');
        return { success: true, updatedCount: result.modifiedCount };
    } catch (e) {
        return { success: false };
    }
}

export async function handleUpdateMasterSwitch(projectId: string, isEnabled: boolean) {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { "autoReplySettings.masterEnabled": isEnabled } }
        );
        revalidatePath('/dashboard/settings');
        return { message: `All auto-replies have been ${isEnabled ? 'enabled' : 'disabled'}.` };
    } catch (e: any) {
        return { error: e.message || 'Failed to update master switch.' };
    }
}

export async function handleUpdateOptInOutSettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Missing project ID.' };
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    const settings: OptInOutSettings = {
        enabled: formData.get('enabled') === 'on',
        optInKeywords: (formData.get('optInKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
        optOutKeywords: (formData.get('optOutKeywords') as string || '').split(',').map(k => k.trim()).filter(Boolean),
        optInResponse: formData.get('optInResponse') as string,
        optOutResponse: formData.get('optOutResponse') as string,
    };

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { optInOutSettings: settings } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Opt-in/out settings saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save settings.' };
    }
}

export async function handleSaveUserAttributes(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const projectId = formData.get('projectId') as string;
    const attributesJSON = formData.get('attributes') as string;
    
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    
    try {
        const attributes = JSON.parse(attributesJSON);
        
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { userAttributes: attributes } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'User attributes saved successfully.' };
    } catch (e: any) {
        console.error("Failed to save user attributes:", e);
        return { error: 'An error occurred while saving.' };
    }
}

export async function saveCannedMessageAction(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const messageId = formData.get('_id') as string | null;
    const projectId = formData.get('projectId') as string;
    
    if (!projectId) return { error: 'Project ID is missing.' };

    const cannedMessageData = {
        projectId: new ObjectId(projectId),
        name: formData.get('name') as string,
        type: formData.get('type') as CannedMessage['type'],
        content: {
            text: formData.get('text') as string,
            mediaUrl: formData.get('mediaUrl') as string,
            caption: formData.get('caption') as string,
            fileName: formData.get('fileName') as string,
        },
        isFavourite: formData.get('isFavourite') === 'on',
        createdBy: session.user.name,
        createdAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (messageId) {
            await db.collection('canned_messages').updateOne({ _id: new ObjectId(messageId) }, { $set: { ...cannedMessageData, createdAt: undefined } as any});
        } else {
            await db.collection('canned_messages').insertOne(cannedMessageData as any);
        }
        revalidatePath('/dashboard/settings');
        return { message: 'Canned message saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save canned message.' };
    }
}

export async function deleteCannedMessage(id: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };
    try {
        const { db } await connectToDatabase();
        await db.collection('canned_messages').deleteOne({ _id: new ObjectId(id) });
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to delete message.' };
    }
}

export async function getCannedMessages(projectId: string): Promise<WithId<CannedMessage>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection('canned_messages').find({ projectId: new ObjectId(projectId) }).sort({ isFavourite: -1, name: 1 }).toArray()));
    } catch (e) {
        return [];
    }
}

export async function handleUpdateContactDetails(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const variablesJSON = formData.get('variables') as string;

    if (!ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid Contact ID' };
    }
    
    try {
        const variables = JSON.parse(variablesJSON);
        const { db } = await connectToDatabase();
        
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { variables } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update contact.' };
    }
}


export async function handleUpdateContactStatus(contactId: string, status: string, assignedAgentId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(contactId)) return { success: false, error: 'Invalid Contact ID' };

    const session = await getSession();
    if (!session) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
        if (!contact) return { success: false, error: 'Contact not found' };

        const project = await getProjectById(contact.projectId.toString());
        if (!project) return { success: false, error: 'Access denied' };
        
        const update: any = { status };
        if (assignedAgentId) {
            update.assignedAgentId = assignedAgentId;
        } else {
            update.assignedAgentId = null;
        }
        
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: update });
        
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: 'Failed to update contact status.' };
    }
}


export async function getContactsForProject(
    projectId: string,
    phoneNumberId: string,
    page: number,
    limit: number,
    query?: string,
): Promise<{
    contacts: WithId<Contact>[],
    total: number,
}> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess || !phoneNumberId) {
        return { contacts: [], total: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId };
        
        if (query && query.trim() !== '') {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const queryRegex = { $regex: escapedQuery, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { waId: queryRegex }
            ];
        }
        
        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<Contact>('contacts').find(filter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(limit).toArray(),
            db.collection<Contact>('contacts').countDocuments(filter)
        ]);
        
        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e) {
        console.error("Failed to get contacts for project:", e);
        return { contacts: [], total: 0 };
    }
}

export async function getKanbanData(projectId: string): Promise<{ project: WithId<Project> | null, columns: KanbanColumnData[] }> {
    const defaultData = { project: null, columns: [] };
    const project = await getProjectById(projectId);
    if (!project) return defaultData;
    
    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection<Contact>('contacts')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ lastMessageTimestamp: -1 })
            .toArray();

        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = project.kanbanStatuses || [];
        const allStatuses = [...new Set([...defaultStatuses, ...customStatuses])];

        const columns = allStatuses.map(status => ({
            name: status,
            contacts: contacts.filter(c => (c.status || 'new') === status),
        }));

        return {
            project: JSON.parse(JSON.stringify(project)),
            columns: JSON.parse(JSON.stringify(columns))
        };
    } catch (e) {
        console.error("Failed to get Kanban data:", e);
        return defaultData;
    }
}

export async function saveKanbanStatuses(projectId: string, statuses: string[]): Promise<{ success: boolean; error?: string }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = statuses.filter(s => !defaultStatuses.includes(s));
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { kanbanStatuses: customStatuses } }
        );
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to save Kanban lists.' };
    }
}

export async function getContactsPageData(
    projectId: string, 
    phoneNumberId: string, 
    page: number, 
    query: string,
    tags?: string[],
): Promise<{
    project: WithId<Project> | null,
    contacts: WithId<Contact>[],
    total: number,
    selectedPhoneNumberId: string
}> {
    const projectData = await getProjectById(projectId);
    if (!projectData) return { project: null, contacts: [], total: 0, selectedPhoneNumberId: '' };

    let selectedPhoneId = phoneNumberId;
    if (!selectedPhoneId && projectData.phoneNumbers?.length > 0) {
        selectedPhoneId = projectData.phoneNumbers[0].id;
    }
    
    if (!selectedPhoneId) return { project: projectData, contacts: [], total: 0, selectedPhoneNumberId: '' };

    const { db } = await connectToDatabase();
    const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId };
    
    if (query) {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = { $regex: escapedQuery, $options: 'i' };
        filter.$or = [
            { name: queryRegex },
            { waId: queryRegex },
        ];
    }

    if (tags && tags.length > 0) {
        filter.tagIds = { $in: tags };
    }
    
    const skip = (page - 1) * 20;

    const [contacts, total] = await Promise.all([
        db.collection('contacts').find(filter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(20).toArray(),
        db.collection('contacts').countDocuments(filter)
    ]);
    
    return {
        project: JSON.parse(JSON.stringify(projectData)),
        contacts: JSON.parse(JSON.stringify(contacts)),
        total,
        selectedPhoneNumberId: selectedPhoneId
    };
}

export async function getConversation(contactId: string): Promise<AnyMessage[]> {
    if (!ObjectId.isValid(contactId)) return [];
    try {
        const { db } = await connectToDatabase();
        const contactObjectId = new ObjectId(contactId);

        const incoming = await db.collection('incoming_messages').find({ contactId: contactObjectId }).toArray();
        const outgoing = await db.collection('outgoing_messages').find({ contactId: contactObjectId }).toArray();
        
        const allMessages = [...incoming, ...outgoing];
        allMessages.sort((a, b) => new Date(a.messageTimestamp).getTime() - new Date(b.messageTimestamp).getTime());

        return JSON.parse(JSON.stringify(allMessages));
    } catch (e) {
        return [];
    }
}

export async function getInitialChatData(projectId: string, phoneId: string | null, contactId: string | null): Promise<{
    project: WithId<Project> | null;
    contacts: WithId<Contact>[];
    totalContacts: number;
    selectedContact: WithId<Contact> | null;
    conversation: AnyMessage[];
    templates: WithId<Template>[];
    selectedPhoneNumberId: string;
}> {
    const defaultResponse = { project: null, contacts: [], totalContacts: 0, selectedContact: null, conversation: [], templates: [], selectedPhoneNumberId: '' };
    const projectData = await getProjectById(projectId);
    if (!projectData) return defaultResponse;

    let selectedPhoneId = phoneId || projectData.phoneNumbers?.[0]?.id || '';
    if (!selectedPhoneId) return { ...defaultResponse, project: projectData };

    const { db } = await connectToDatabase();
    
    const [allContacts, total, templatesData] = await Promise.all([
        db.collection<Contact>('contacts').find({ projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId }).sort({ lastMessageTimestamp: -1 }).limit(30).toArray(),
        db.collection('contacts').countDocuments({ projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId }),
        getTemplates(projectId),
    ]);

    let selectedContactData: WithId<Contact> | null = null;
    let conversationData: AnyMessage[] = [];

    if (contactId && ObjectId.isValid(contactId)) {
        selectedContactData = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
        if (selectedContactData) {
            conversationData = await getConversation(contactId);
        }
    }

    return {
        project: JSON.parse(JSON.stringify(projectData)),
        contacts: JSON.parse(JSON.stringify(allContacts)),
        totalContacts: total,
        selectedContact: selectedContactData ? JSON.parse(JSON.stringify(selectedContactData)) : null,
        conversation: conversationData,
        templates: JSON.parse(JSON.stringify(templatesData.filter(t => t.status === 'APPROVED'))),
        selectedPhoneNumberId: selectedPhoneId,
    };
}


export async function saveLibraryTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    const name = (formData.get('name') as string || '').trim();
    const nameRegex = /^[a-z0-9_]+$/;

    if (!name) {
        return { error: 'Template name is required.' };
    }
    if (name.length > 512) {
        return { error: 'Template name cannot exceed 512 characters.' };
    }
    if (!nameRegex.test(name)) {
        return { error: 'Template name can only contain lowercase letters, numbers, and underscores (_).' };
    }

    try {
        const templateData: LibraryTemplate = {
            name: name,
            category: formData.get('category') as Template['category'],
            language: formData.get('language') as string,
            body: formData.get('body') as string,
            components: JSON.parse(formData.get('components') as string),
            isCustom: true,
            createdAt: new Date(),
        };

        if (!templateData.category || !templateData.language || !templateData.body) {
            return { error: 'Category, language, and body are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('library_templates').insertOne(templateData as any);

        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/dashboard/templates/library');
        return { message: `Template "${templateData.name}" added to the library.` };

    } catch (e: any) {
        console.error("Failed to save library template:", e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deleteLibraryTemplate(id: string): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    if (!ObjectId.isValid(id)) return { error: 'Invalid template ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('library_templates').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { error: 'Could not find the custom library template to delete.' };
        }
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/dashboard/templates/library');
        return { message: 'Custom template removed from the library.' };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getTemplateCategories(): Promise<WithId<TemplateCategory>[]> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return [];
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection('template_categories').find({}).sort({ name: 1 }).toArray()));
    } catch (e) {
        console.error("Failed to fetch template categories:", e);
        return [];
    }
}

export async function saveTemplateCategory(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    if (!name) return { error: 'Category name is required.' };

    try {
        const { db } = await connectToDatabase();
        const existing = await db.collection('template_categories').findOne({ name });
        if (existing) return { error: 'A category with this name already exists.' };
        await db.collection('template_categories').insertOne({ name, description, createdAt: new Date() });
        revalidatePath('/admin/dashboard/template-library');
        return { message: 'Category created successfully.' };
    } catch (e: any) {
        console.error('Failed to create category:', e);
        return { error: 'Failed to create category.' };
    }
}

export async function deleteTemplateCategory(id: string): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    if (!ObjectId.isValid(id)) return { error: 'Invalid category ID.' };
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('template_categories').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { error: 'Could not find the category to delete.' };
        }
        revalidatePath('/admin/dashboard/template-library');
        return { message: 'Category deleted successfully.' };
    } catch (e: any) {
        console.error('Failed to delete category:', e);
        return { error: 'Failed to delete category.' };
    }
}

export async function getUsersForAdmin(
    page: number = 1,
    limit: number = 10,
    query?: string
): Promise<{ users: AdminUserView[], total: number }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { users: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<User> = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const usersPipeline = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    password: 0,
                }
            }
        ];

        const [users, total] = await Promise.all([
            db.collection<User>('users').aggregate(usersPipeline).toArray(),
            db.collection('users').countDocuments(filter)
        ]);
        
        return { users: JSON.parse(JSON.stringify(users)), total };

    } catch (error) {
        console.error("Failed to fetch users for admin:", error);
        return { users: [], total: 0 };
    }
}

export async function saveUserTags(tags: Tag[]): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { tags: tags } }
        );
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/url-shortener');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to save tags.' };
    }
}

export async function updateContactTags(contactId: string, tagIds: string[]): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid contact ID.' };
    }
    
    const { db } = await connectToDatabase();
    const contact = await db.collection('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) {
        return { success: false, error: 'Contact not found.' };
    }
    const hasAccess = await getProjectById(contact.projectId.toString());
    if (!hasAccess) return { success: false, error: 'Access denied.' };
    
    try {
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { tagIds } }
        );
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update tags.' };
    }
}
