
'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template, AutoReplySettings, Flow, FlowNode, FlowEdge, OptInOutSettings, UserAttribute, Agent, GeneralReplyRule, MetaFlow, AdCampaign, PhoneNumberProfile } from '@/app/dashboard/page';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
import { translateText } from '@/ai/flows/translate-text';
import { processSingleWebhook, handleSingleMessageEvent, processStatusUpdateBatch } from '@/lib/webhook-processor';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { intelligentTranslate } from '@/ai/flows/intelligent-translate-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, comparePassword, createSessionToken, verifySessionToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { premadeTemplates } from '@/lib/premade-templates';
import { getMetaFlows } from './actions/meta-flow.actions';


// --- Plan Management Types ---
export type PlanFeaturePermissions = {
    campaigns: boolean;
    liveChat: boolean;
    contacts: boolean;
    templates: boolean;
    flowBuilder: boolean;
    metaFlows: boolean;
    whatsappAds: boolean;
    webhooks: boolean;
    settingsBroadcast: boolean;
    settingsAutoReply: boolean;
    settingsMarketing: boolean;
    settingsTemplateLibrary: boolean;
    settingsCannedMessages: boolean;
    settingsAgentsRoles: boolean;
    settingsCompliance: boolean;
    settingsUserAttributes: boolean;
    apiAccess: boolean;
};

export type PlanMessageCosts = {
    marketing: number;
    utility: number;
    authentication: number;
    service?: number; // Added service for conversations
};

export type Plan = {
    _id: ObjectId;
    name: string;
    price: number;
    currency: string;
    isPublic: boolean;
    isDefault: boolean;
    projectLimit: number;
    agentLimit: number;
    attributeLimit: number;
    templateLimit: number;
    flowLimit: number;
    metaFlowLimit: number;
    cannedMessageLimit: number;
    messageCosts: PlanMessageCosts;
    features: PlanFeaturePermissions;
    createdAt: Date;
};


// --- User Management Types ---
export type User = {
    _id: ObjectId;
    name: string;
    email: string;
    password?: string;
    createdAt: Date;
    planId?: ObjectId;
    credits?: number;
};

export type Invitation = {
    _id: ObjectId;
    projectId: ObjectId;
    projectName: string;
    inviterId: ObjectId;
    inviterName: string;
    inviteeEmail: string;
    role: string;
    status: 'pending';
    createdAt: Date;
};

// --- Transaction Types ---
export type Transaction = {
    _id: ObjectId;
    userId: ObjectId;
    type: 'PLAN' | 'CREDITS';
    description: string;
    planId?: ObjectId;
    credits?: number;
    amount: number; // in paise
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    provider: 'phonepe';
    providerTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
};


type MetaPhoneNumber = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    code_verification_status: string;
    quality_rating: string;
    platform_type?: string;
    throughput?: {
        level: string;
    };
    whatsapp_business_profile?: PhoneNumberProfile;
};

type MetaPhoneNumbersResponse = {
    data: MetaPhoneNumber[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

type MetaTemplateComponent = {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'CAROUSEL';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: any[];
    cards?: any[];
    example?: {
        header_handle?: string[];
        header_text?: string[];
        body_text?: string[][];
        carousel_card_components?: any[];
    }
};

type MetaTemplate = {
    id:string;
    name: string;
    language: string;
    status: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
    quality_score?: { score: string };
};

type MetaTemplatesResponse = {
    data: MetaTemplate[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

type MetaWaba = {
    id: string;
    name: string;
};

type MetaWabasResponse = {
    data: MetaWaba[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        },
        next?: string;
    }
};

// This type is used within the action, the cron scheduler has its own definition.
type BroadcastJob = {
    projectId: ObjectId;
    broadcastType: 'template' | 'flow';
    templateId?: ObjectId;
    metaFlowId?: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed' | 'Cancelled';
    createdAt: Date;
    contactCount: number;
    fileName: string;
    components?: any[];
    language?: string;
    headerImageUrl?: string;
    category?: Template['category'];
};

export type BroadcastAttempt = {
    _id: string;
    phone: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';
    sentAt?: Date;
    messageId?: string; // a successful send from Meta
    error?: string; // a failed send reason
};

export type Notification = {
    _id: ObjectId;
    projectId: ObjectId;
    wabaId: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: Date;
    eventType: string;
};

export type NotificationWithProject = Notification & { projectName?: string };


// --- Live Chat Types ---
export type Contact = {
    projectId: ObjectId;
    waId: string; // The user's WhatsApp ID
    phoneNumberId: string; // The business phone number they are talking to
    name: string;
    lastMessage?: string;
    lastMessageTimestamp?: Date;
    unreadCount?: number;
    createdAt: Date;
    variables?: Record<string, string>;
    activeFlow?: {
        flowId: string;
        currentNodeId: string;
        variables: Record<string, any>;
        waitingSince?: Date;
    };
    isOptedOut?: boolean;
    hasReceivedWelcome?: boolean;
    status?: 'new' | 'open' | 'resolved';
    assignedAgentId?: string;
}

export type IncomingMessage = {
    _id: ObjectId;
    direction: 'in';
    contactId: ObjectId;
    projectId: ObjectId;
    wamid: string;
    messageTimestamp: Date;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'unknown' | 'interactive';
    content: any; // The raw message object from Meta
    isRead: boolean;
    createdAt: Date;
}

export type OutgoingMessage = {
    _id: ObjectId;
    direction: 'out';
    contactId: ObjectId;
    projectId: ObjectId;
    wamid: string;
    messageTimestamp: Date;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive' | 'template';
    content: any; // The payload sent to Meta
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    statusTimestamps: {
        sent?: Date;
        delivered?: Date;
        read?: Date;
    };
    error?: string;
    createdAt: Date;
}

export type AnyMessage = (WithId<IncomingMessage> | WithId<OutgoingMessage>);


// Re-export types for client components
export type { Project, Template, PhoneNumber, PhoneNumberProfile, AutoReplySettings, Flow, FlowNode, FlowEdge, OptInOutSettings, UserAttribute, Agent, GeneralReplyRule, MetaFlow, AdCampaign };

export type LibraryTemplate = Omit<Template, 'metaId' | 'status' | 'qualityScore'> & {
    _id?: ObjectId;
    isCustom?: boolean;
    createdAt?: Date;
}

export type TemplateCategory = {
    _id: ObjectId;
    name: string;
    description?: string;
};


export type CannedMessage = {
    _id: ObjectId;
    projectId: ObjectId;
    name: string;
    type: 'text' | 'image' | 'audio' | 'video' | 'document';
    content: {
        text?: string;
        mediaUrl?: string;
        caption?: string;
        fileName?: string;
    };
    isFavourite: boolean;
    createdBy: string;
    createdAt: Date;
};

// --- Flow Log Types ---
export type FlowLogEntry = {
    timestamp: Date;
    message: string;
    data?: any;
};

export type FlowLog = {
    _id: ObjectId;
    projectId: ObjectId;
    contactId: ObjectId;
    flowId: ObjectId;
    flowName: string;
    createdAt: Date;
    entries: FlowLogEntry[];
};


const getErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
        const apiError = error.response.data.error;
        let errorMessage = apiError.error_user_title ? `${apiError.error_user_title}: ${apiError.error_user_msg}` : apiError.message || 'API Error';
        if (apiError.error_data?.details) {
            errorMessage += ` Details: ${apiError.error_data.details}`;
        }
        return `${errorMessage} (Code: ${apiError.code}, Type: ${apiError.type})`;
    }
    if (error instanceof Error) {
        if ('cause' in error && error.cause) {
            const cause = error.cause as any;
            if (cause.error) {
                const apiError = cause.error;
                 return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
            }
             if (cause.message) {
                return cause.message;
            }
        }
        return error.message;
    }
    return String(error) || 'An unknown error occurred';
};

export async function getSession(): Promise<{ user: (Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null, credits?: number }) } | null> {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
        return null;
    }

    const payload = verifySessionToken(sessionToken);
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

        let userPlan: WithId<Plan> | null = null;
        if (user.planId && ObjectId.isValid(user.planId)) {
            userPlan = await db.collection<Plan>('plans').findOne({ _id: new ObjectId(user.planId) });
        } else {
            // If user has no plan, assign the default plan
            const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
            if (defaultPlan) {
                await db.collection('users').updateOne({ _id: user._id }, { $set: { planId: defaultPlan._id } });
                user.planId = defaultPlan._id;
                userPlan = defaultPlan;
            }
        }

        const userWithPlan = { ...user, plan: userPlan, credits: user.credits || 0 };

        return { user: JSON.parse(JSON.stringify(userWithPlan)) };
    } catch (error) {
        console.error("Error fetching session user from DB:", error);
        return null;
    }
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

export async function getProjects(query?: string): Promise<WithId<Project>[]> {
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
            filter.name = { $regex: query, $options: 'i' }; // case-insensitive regex search
        }
        
        const projects = await db.collection('projects').find(filter).sort({ name: 1 }).toArray();
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
    query?: string,
    page: number = 1,
    limit: number = 10
): Promise<{ projects: WithId<Project>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }
        const skip = (page - 1) * limit;

        const [projects, total] = await Promise.all([
            db.collection('projects').find(filter).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
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
    if (!session?.user) {
        return null;
    }
    try {
        if (!ObjectId.isValid(projectId)) {
            console.error("Invalid Project ID in getProjectById:", projectId);
            return null;
        }
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ 
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return null;
        }
        
        // Security Check: Is the user the owner OR an agent on this project?
        const isOwner = project.userId.toString() === session.user._id.toString();
        const isAgent = project.agents?.some(agent => agent.userId.toString() === session.user._id.toString());

        if (!isOwner && !isAgent) {
             console.error(`User ${session.user._id} attempted to access project ${projectId} but does not have permission.`);
             return null;
        }
        
        return JSON.parse(JSON.stringify(project));
    } catch (error: any) {
        console.error("Exception in getProjectById:", error);
        return null;
    }
}

export async function getProjectForBroadcast(projectId: string): Promise<(Pick<WithId<Project>, '_id' | 'name' | 'phoneNumbers'> & { metaFlows?: WithId<MetaFlow>[] }) | null> {
    const hasAccess = await getProjectById(projectId); // Still need security check
    if (!hasAccess) return null;

    try {
        const { db } = await connectToDatabase();
        const [project, metaFlows] = await Promise.all([
            db.collection('projects').findOne(
                { _id: new ObjectId(projectId) },
                { projection: { name: 1, phoneNumbers: 1 } }
            ),
            getMetaFlows(projectId)
        ]);
        
        if (!project) {
            console.error("Project not found for ID:", projectId);
            return null;
        }
        
        return JSON.parse(JSON.stringify({ ...project, metaFlows }));
    } catch (error: any) {
        console.error("Exception in getProjectForBroadcast:", error);
        return null;
    }
}


export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const projection = {
            name: 1,
            category: 1,
            components: 1,
            metaId: 1,
            language: 1,
            body: 1,
            status: 1,
            headerSampleUrl: 1,
            qualityScore: 1,
            type: 1,
        };
        const templates = await db.collection('templates')
            .find({ projectId: new ObjectId(projectId) })
            .project(projection)
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return [];
    }
}

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20,
): Promise<{ broadcasts: WithId<any>[], total: number }> {
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

export async function getBroadcasts(
    projectId: string,
    page: number = 1,
    limit: number = 10
): Promise<{ broadcasts: WithId<any>[], total: number }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { broadcasts: [], total: 0 };

    if (!ObjectId.isValid(projectId)) {
        return { broadcasts: [], total: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        const matchCriteria: Filter<any> = {
            projectId: projectObjectId
        };

        const skip = (page - 1) * limit;

        const pipeline = [
            { $match: matchCriteria },
            {
                $facet: {
                    paginatedResults: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                templateId: 1,
                                metaFlowId: 1,
                                templateName: 1,
                                fileName: 1,
                                contactCount: 1,
                                successCount: 1,
                                errorCount: 1,
                                deliveredCount: 1,
                                readCount: 1,
                                status: 1,
                                createdAt: 1,
                                startedAt: 1,
                                completedAt: 1,
                                messagesPerSecond: 1,
                                projectMessagesPerSecond: 1,
                            }
                        }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];

        const results = await db.collection('broadcasts').aggregate(pipeline).toArray();

        const broadcasts = results[0].paginatedResults || [];
        const total = results[0].totalCount[0]?.count || 0;

        return { broadcasts: JSON.parse(JSON.stringify(broadcasts)), total };
    } catch (error) {
        console.error('Failed to fetch broadcast history:', error);
        return { broadcasts: [], total: 0 };
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
        
        // Check if the user has access to the project associated with this broadcast
        const hasAccess = await getProjectById(broadcast.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(broadcast));
    } catch (error) {
        console.error('Failed to fetch broadcast by ID:', error);
        return null;
    }
}

export async function getBroadcastAttempts(
    broadcastId: string, 
    page: number = 1, 
    limit: number = 50, 
    filter: 'ALL' | 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED' | 'READ' = 'ALL'
): Promise<{ attempts: BroadcastAttempt[], total: number }> {
    const broadcast = await getBroadcastById(broadcastId);
    if (!broadcast) return { attempts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const query: any = { broadcastId: new ObjectId(broadcastId) };
        if (filter !== 'ALL') {
            query.status = filter;
        }

        const skip = (page - 1) * limit;

        const [attempts, total] = await Promise.all([
            db.collection('broadcast_contacts').find(query).sort({createdAt: -1}).skip(skip).limit(limit).toArray(),
            db.collection('broadcast_contacts').countDocuments(query)
        ]);
        
        return { attempts: JSON.parse(JSON.stringify(attempts)), total };
    } catch (error) {
        console.error('Failed to fetch broadcast attempts:', error);
        return { attempts: [], total: 0 };
    }
}

export async function getBroadcastAttemptsForExport(
    broadcastId: string,
    filter: 'ALL' | 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED' | 'READ' = 'ALL'
): Promise<BroadcastAttempt[]> {
    const broadcast = await getBroadcastById(broadcastId);
    if (!broadcast) return [];

    try {
        const { db } = await connectToDatabase();
        const query: any = { broadcastId: new ObjectId(broadcastId) };
        if (filter !== 'ALL') {
            query.status = filter;
        }

        const attempts = await db.collection('broadcast_contacts').find(query).sort({createdAt: -1}).toArray();
        
        return JSON.parse(JSON.stringify(attempts));
    } catch (error) {
        console.error('Failed to fetch broadcast attempts for export:', error);
        return [];
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
            return {
                totalMessages: stats[0].totalMessages || 0,
                totalSent: stats[0].totalSent || 0,
                totalFailed: stats[0].totalFailed || 0,
                totalDelivered: stats[0].totalDelivered || 0,
                totalRead: stats[0].totalRead || 0,
                totalCampaigns: stats[0].totalCampaigns || 0,
            };
        }
        return defaultStats;
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return defaultStats;
    }
}

type BroadcastState = {
  message?: string | null;
  error?: string | null;
};

const processStreamedContacts = (inputStream: NodeJS.ReadableStream | string, db: Db, broadcastId: ObjectId, project: WithId<Project>): Promise<number> => {
    return new Promise<number>((resolve, reject) => {
        const allParsedContacts: any[] = [];
        
        Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            step: (results) => {
                allParsedContacts.push(results.data as Record<string, string>);
            },
            complete: async () => {
                if (allParsedContacts.length === 0) {
                    return resolve(0);
                }

                const phoneColumnHeader = Object.keys(allParsedContacts[0])[0];
                if (!phoneColumnHeader) {
                    return reject(new Error("File has no columns."));
                }
                
                let contactsToInsert = allParsedContacts.map(row => {
                    const phone = String(row[phoneColumnHeader] || '').trim();
                    if (!phone) return null;
                    const {[phoneColumnHeader]: _, ...variables} = row;
                    return {
                        broadcastId,
                        phone,
                        variables,
                        status: 'PENDING' as const,
                        createdAt: new Date(),
                    };
                }).filter(Boolean);

                if (project.optInOutSettings?.enabled === true) {
                    const allPhoneNumbers = contactsToInsert.map(c => c!.phone);
                    const optedOutContacts = await db.collection('contacts').find({
                        projectId: project._id,
                        waId: { $in: allPhoneNumbers },
                        isOptedOut: true
                    }, { projection: { waId: 1 } }).toArray();
                    const optedOutNumbersSet = new Set(optedOutContacts.map(c => c.waId));

                    contactsToInsert = contactsToInsert.filter(c => !optedOutNumbersSet.has(c!.phone));
                }

                if (contactsToInsert.length > 0) {
                    await db.collection('broadcast_contacts').insertMany(contactsToInsert as any[], { ordered: false }).catch(err => {
                        if (err.code !== 11000) { // 11000 is duplicate key error, which we can ignore
                            console.warn("Bulk insert for broadcast contacts failed.", err.code);
                        }
                    });
                }
                
                resolve(contactsToInsert.length);
            },
            error: (error) => reject(error)
        });
    });
};

export async function handleStartBroadcast(
  prevState: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  let broadcastId: ObjectId | null = null;
  const { db } = await connectToDatabase();

  try {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const broadcastType = formData.get('broadcastType') as 'template' | 'flow';

    if (!projectId) {
      return { error: 'No project selected. Please go to the dashboard and select a project first.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project) {
      return { error: 'Project not found or you do not have access.' };
    }
    
    if (!phoneNumberId) {
      return { error: 'No phone number selected. Please select a number to send the broadcast from.' };
    }

    const accessToken = project.accessToken;

    const contactFile = formData.get('csvFile') as File;
    if (!contactFile || contactFile.size === 0) return { error: 'Please upload a contact file.' };
    
    let broadcastJobData: Omit<WithId<BroadcastJob>, '_id'>;

    if(broadcastType === 'flow') {
        const metaFlowId = formData.get('metaFlowId') as string;
        if (!metaFlowId) return { error: 'Please select a Meta Flow.' };
        if (!ObjectId.isValid(metaFlowId)) return { error: 'Invalid Meta Flow ID.' };
        const flow = await db.collection('meta_flows').findOne({ _id: new ObjectId(metaFlowId), projectId: project._id });
        if (!flow) return { error: 'Selected flow not found for this project.' };

        broadcastJobData = {
            projectId: new ObjectId(projectId),
            broadcastType: 'flow',
            metaFlowId: new ObjectId(metaFlowId),
            templateName: flow.name, // Using templateName field to store flow name for consistency
            phoneNumberId,
            accessToken,
            status: 'QUEUED',
            createdAt: new Date(),
            contactCount: 0,
            fileName: contactFile.name,
            category: 'UTILITY', // Flows are typically utility/service messages
        };

    } else { // Default to template
        const templateId = formData.get('templateId') as string;
        if (!templateId) return { error: 'Please select a message template.' };
        if (!ObjectId.isValid(templateId)) return { error: 'Invalid Template ID.' };

        const template = await db.collection('templates').findOne({ _id: new ObjectId(templateId), projectId: project._id });
        if (!template) return { error: 'Selected template not found for this project.' };

        let finalHeaderImageUrl: string | undefined = undefined;
        const templateHasMediaHeader = template.components?.some((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));
        
        if (templateHasMediaHeader) {
            const overrideUrl = formData.get('headerImageUrl') as string | null;
            if (overrideUrl && overrideUrl.trim() !== '') {
                finalHeaderImageUrl = overrideUrl.trim();
            } else {
                return { error: 'A public media URL is required for this template.' };
            }
        }
        
        broadcastJobData = {
            projectId: new ObjectId(projectId),
            broadcastType: 'template',
            templateId: new ObjectId(templateId),
            templateName: template.name,
            phoneNumberId,
            accessToken,
            status: 'QUEUED',
            createdAt: new Date(),
            contactCount: 0,
            fileName: contactFile.name,
            components: template.components,
            language: template.language,
            headerImageUrl: finalHeaderImageUrl,
            category: template.category,
        };
    }

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastJobData);
    broadcastId = broadcastResult.insertedId;

    let contactCount = 0;

    if (contactFile.name.endsWith('.csv')) {
        const nodeStream = Readable.fromWeb(contactFile.stream() as any);
        contactCount = await processStreamedContacts(nodeStream, db, broadcastId, project);
    } else if (contactFile.name.endsWith('.xlsx')) {
        const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('The XLSX file contains no sheets.');
        }
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        contactCount = await processStreamedContacts(csvData, db, broadcastId, project);
    } else {
        await db.collection('broadcasts').deleteOne({ _id: broadcastId });
        return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
    }

    if (contactCount === 0) {
        await db.collection('broadcasts').deleteOne({ _id: broadcastId });
        return { error: 'No valid contacts with phone numbers found in the first column of the file.' };
    }
    
    await db.collection('broadcasts').updateOne({ _id: broadcastId }, { $set: { contactCount } });

    revalidatePath('/dashboard/broadcasts');
    return { message: `Broadcast successfully queued for ${contactCount} contacts. Sending will begin shortly.` };

  } catch (e: any) {
    console.error('Failed to queue broadcast:', e);
    if (broadcastId) {
        await db.collection('broadcasts').deleteOne({ _id: broadcastId });
        await db.collection('broadcast_contacts').deleteMany({ broadcastId: broadcastId });
    }
    return { error: e.message || 'An unexpected error occurred while processing the broadcast.' };
  }
}

export async function handleSyncPhoneNumbers(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();

        const { wabaId, accessToken } = project;
        const fields = 'verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput,whatsapp_business_profile{about,address,description,email,profile_picture_url,websites,vertical}';
        
        const allPhoneNumbers: MetaPhoneNumber[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers?access_token=${accessToken}&fields=${fields}&limit=100`;

        while (nextUrl) {
            const response = await fetch(nextUrl, { method: 'GET' });
            
            const responseText = await response.text();
            const responseData: MetaPhoneNumbersResponse = responseText ? JSON.parse(responseText) : {};
            
            if (!response.ok) {
                const errorMessage = (responseData as any)?.error?.message || 'Unknown error syncing phone numbers.';
                return { error: `API Error: ${errorMessage}. Status: ${response.status} ${response.statusText}` };
            }

            if (responseData.data && responseData.data.length > 0) {
                allPhoneNumbers.push(...responseData.data);
            }
            
            nextUrl = responseData.paging?.next;
        }

        if (allPhoneNumbers.length === 0) {
            await db.collection('projects').updateOne(
                { _id: new ObjectId(projectId) },
                { $set: { phoneNumbers: [] } }
            );
            return { message: "No phone numbers found in your WhatsApp Business Account to sync." };
        }

        const phoneNumbers: PhoneNumber[] = allPhoneNumbers.map((num: MetaPhoneNumber) => ({
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
            profile: num.whatsapp_business_profile,
        }));
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { phoneNumbers: phoneNumbers } }
        );
        
        revalidatePath('/dashboard/numbers');

        return { message: `Successfully synced ${phoneNumbers.length} phone number(s).`, count: phoneNumbers.length };

    } catch (e: any) {
        console.error('Phone number sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during phone number sync.' };
    }
}

export async function handleUpdatePhoneNumberProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    
    if (!projectId || !phoneNumberId) {
        return { error: 'Project and Phone Number IDs are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project) return { error: "Access denied." };

    const { accessToken, appId } = project;
    if (!appId) {
        return { error: 'App ID is not configured for this project.' };
    }
    
    try {
        // --- 1. Handle Profile Picture Upload ---
        const profilePictureFile = formData.get('profilePicture') as File;
        if (profilePictureFile && profilePictureFile.size > 0) {
            // Step 1a: Create Upload Session
            const sessionFormData = new FormData();
            sessionFormData.append('file_length', profilePictureFile.size.toString());
            sessionFormData.append('file_type', profilePictureFile.type);
            sessionFormData.append('access_token', accessToken);

            const sessionResponse = await axios.post(`https://graph.facebook.com/v22.0/${appId}/uploads`, sessionFormData);
            const uploadSessionId = sessionResponse.data.id;
            
            // Step 1b: Upload file data
            const fileData = await profilePictureFile.arrayBuffer();
            const uploadResponse = await axios.post(`https://graph.facebook.com/v22.0/${uploadSessionId}`, Buffer.from(fileData), {
                headers: { 'Authorization': `OAuth ${accessToken}`, 'Content-Type': profilePictureFile.type },
                maxContentLength: Infinity, maxBodyLength: Infinity,
            });
            const handle = uploadResponse.data.h;

            // Step 1c: Update profile picture with handle
            await axios.post(
                `https://graph.facebook.com/v22.0/${phoneNumberId}/whatsapp_business_profile`,
                { messaging_product: "whatsapp", profile_picture_handle: handle },
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
        }

        // --- 2. Handle Text Fields Update ---
        const profilePayload: any = { messaging_product: 'whatsapp' };
        const fields: (keyof PhoneNumberProfile)[] = ['about', 'address', 'description', 'email', 'vertical'];
        let hasTextFields = false;

        fields.forEach(field => {
            const value = formData.get(field) as string | null;
            if (value && value.trim() !== '') {
                profilePayload[field] = value.trim();
                hasTextFields = true;
            }
        });
        
        const websites = (formData.getAll('websites') as string[]).map(w => w.trim()).filter(Boolean);
        if (websites.length > 0) {
            profilePayload.websites = websites;
            hasTextFields = true;
        }

        if (hasTextFields) {
            await axios.post(
                `https://graph.facebook.com/v22.0/${phoneNumberId}/whatsapp_business_profile`,
                profilePayload,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
        }
        
        // --- 3. Re-sync and return ---
        await handleSyncPhoneNumbers(projectId); // Re-sync to get the latest data, including new profile_picture_url
        revalidatePath('/dashboard/numbers');
        return { message: 'Phone number profile updated successfully!' };

    } catch (e: any) {
        console.error("Failed to update phone number profile:", e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleSyncTemplates(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        
        const { wabaId, accessToken } = project;

        const allTemplates: MetaTemplate[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id,quality_score&limit=100`;

        while(nextUrl) {
            const response = await fetch(nextUrl, { method: 'GET' });

            if (!response.ok) {
                let reason = 'Unknown API Error';
                try {
                    const errorData = await response.json();
                    reason = errorData?.error?.message || reason;
                } catch (e) {
                    reason = `Could not parse error response from Meta. Status: ${response.status} ${response.statusText}`;
                }
                return { error: `Failed to fetch templates from Meta: ${reason}` };
            }

            const templatesResponse: MetaTemplatesResponse = await response.json();
            
            if (templatesResponse.data && templatesResponse.data.length > 0) {
                allTemplates.push(...templatesResponse.data);
            }

            nextUrl = templatesResponse.paging?.next;
        }
        
        if (allTemplates.length === 0) {
            return { message: "No templates found in your WhatsApp Business Account to sync." }
        }

        const templatesToUpsert = allTemplates.map(t => {
            const bodyComponent = t.components.find(c => c.type === 'BODY');
            const headerComponent = t.components.find(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format || ''));
            
            return {
                name: t.name,
                category: t.category,
                language: t.language,
                status: t.status,
                body: bodyComponent?.text || '',
                projectId: new ObjectId(projectId),
                metaId: t.id,
                components: t.components,
                qualityScore: t.quality_score?.score?.toUpperCase() || 'UNKNOWN',
                headerSampleUrl: headerComponent?.example?.header_handle?.[0] ? `https://graph.facebook.com/${headerComponent.example.header_handle[0]}` : undefined
            };
        });

        const bulkOps = templatesToUpsert.map(template => ({
            updateOne: {
                filter: { metaId: template.metaId, projectId: template.projectId },
                update: { $set: template },
                upsert: true,
            }
        }));

        const result = await db.collection('templates').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        revalidatePath('/dashboard/templates');
        
        return { message: `Successfully synced ${syncedCount} template(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('Template sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during template sync.' };
    }
}

type CreateTemplateState = {
    message?: string | null;
    error?: string | null;
    payload?: string | null;
    debugInfo?: string | null;
};

async function getMediaHandleForTemplate(file: File | null, url: string | null, accessToken: string, appId: string): Promise<{ handle: string | null; error?: string; debugInfo: string }> {
    let debugInfo = "";
    if (!file && !url) return { handle: null, debugInfo };

    try {
        let mediaData: Buffer;
        let fileType: string;
        let fileName: string;
        let fileLength: number;

        if (file && file.size > 0) {
            mediaData = Buffer.from(await file.arrayBuffer());
            fileType = file.type;
            fileName = file.name;
            fileLength = file.size;
        } else if (url) {
            const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
            mediaData = Buffer.from(mediaResponse.data);
            fileType = mediaResponse.headers['content-type'] || 'application/octet-stream';
            fileName = url.split('/').pop()?.split('?')[0] || 'sample';
            fileLength = mediaData.length;
        } else {
            return { handle: null, debugInfo: "No file or URL provided." };
        }

        const sessionUrl = `https://graph.facebook.com/v22.0/${appId}/uploads?file_length=${fileLength}&file_type=${fileType}&access_token=${accessToken}`;
        const sessionResponse = await axios.post(sessionUrl, {});
        debugInfo += `SESSION: ${sessionUrl.replace(accessToken, '<TOKEN>')} -> ${JSON.stringify(sessionResponse.data)}\n`;
        const uploadSessionId = sessionResponse.data.id;

        const uploadUrl = `https://graph.facebook.com/v22.0/${uploadSessionId}`;
        const uploadResponse = await axios.post(uploadUrl, mediaData, { headers: { Authorization: `OAuth ${accessToken}` } });
        debugInfo += `UPLOAD: ${uploadUrl} -> ${JSON.stringify(uploadResponse.data)}\n`;
        return { handle: uploadResponse.data.h, debugInfo };
    } catch (uploadError: any) {
        const errorMessage = getErrorMessage(uploadError);
        return { handle: null, error: `Media upload failed: ${errorMessage}`, debugInfo };
    }
}
  
export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
  ): Promise<CreateTemplateState> {
    let payloadString: string | null = null;
    let debugInfo: string = "";

    const cleanText = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    };

    try {
        const projectId = formData.get('projectId') as string;
        if (!projectId || !ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }
    
        const project = await getProjectById(projectId);
        if (!project) {
            return { error: 'Project not found or you do not have access.' };
        }
        
        const { db } = await connectToDatabase();
        const templateType = formData.get('templateType') as string;

        // --- Logic for Carousel (Catalog Message) Templates ---
        if (templateType === 'CATALOG_MESSAGE') {
            const name = formData.get('templateName') as string;
            const catalogId = formData.get('catalogId') as string;
            const headerText = formData.get('carouselHeader') as string;
            const bodyText = formData.get('carouselBody') as string;
            const footerText = formData.get('carouselFooter') as string;
            const section1Title = formData.get('section1Title') as string;
            const section1ProductIDs = (formData.get('section1ProductIDs') as string).split('\n').map(id => id.trim()).filter(Boolean);
            const section2Title = formData.get('section2Title') as string;
            const section2ProductIDs = (formData.get('section2ProductIDs') as string).split('\n').map(id => id.trim()).filter(Boolean);

            if (!name || !catalogId || !bodyText || !section1Title || section1ProductIDs.length === 0 || !section2Title || section2ProductIDs.length === 0) {
                return { error: 'For Carousel templates, you must provide a name, catalog ID, body text, and at least one product for each of the two sections.' };
            }
            
            const carouselTemplateData = {
                type: 'CATALOG_MESSAGE',
                name,
                category: 'INTERACTIVE', // Internal type, not for Meta
                status: 'LOCAL',
                language: 'multi',
                projectId: new ObjectId(projectId),
                components: [
                    { type: 'BODY', text: bodyText },
                    // Store carousel-specific data in a dedicated component for easy retrieval
                    { 
                        type: 'CATALOG_MESSAGE_ACTION',
                        headerText,
                        footerText,
                        catalogId,
                        sections: [
                            { title: section1Title, products: section1ProductIDs.map(id => ({ product_retailer_id: id })) },
                            { title: section2Title, products: section2ProductIDs.map(id => ({ product_retailer_id: id })) }
                        ]
                    }
                ],
                createdAt: new Date(),
            };

            await db.collection('templates').insertOne(carouselTemplateData as any);
            revalidatePath('/dashboard/templates');
            return { message: 'Product Carousel template saved successfully.' };
        }
        
        const appId = project.appId || process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId) {
            return { error: 'App ID is not configured for this project, and no fallback is set in environment variables. Please set NEXT_PUBLIC_META_APP_ID in the .env file or re-configure the project.' };
        }

        const name = cleanText(formData.get('templateName') as string);
        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const language = formData.get('language') as string;

         if (!name || !category || !language) {
            return { error: 'Name, Language, and Category are required.' };
        }
        
        const { wabaId, accessToken } = project;
        let payload: any = {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language,
            category,
            allow_category_change: true,
            components: []
        };
        let finalTemplateToInsert: any = {
            name: payload.name, category, language, qualityScore: 'UNKNOWN',
            projectId: new ObjectId(projectId),
        };

        if (templateType === 'MARKETING_CAROUSEL') {
            const cardsDataString = formData.get('carouselCards') as string;
            const cardsData = JSON.parse(cardsDataString);
            
            finalTemplateToInsert.type = 'MARKETING_CAROUSEL';

            const mediaUploadResults = await Promise.all(
                cardsData.map(async (card: any, index: number) => {
                    const file = formData.get(`card_${index}_headerSampleFile`) as File;
                    if (card.headerFormat !== 'NONE' && file && file.size > 0) {
                        return await getMediaHandleForTemplate(file, null, accessToken, appId);
                    }
                    return { handle: null, error: null, debugInfo: '' };
                })
            );
            
            let accumulatedDebugInfo = '';
            const finalCards = [];

            for (let i = 0; i < cardsData.length; i++) {
                const card = cardsData[i];
                const uploadResult = mediaUploadResults[i];
                accumulatedDebugInfo += `CARD ${i}:\n${uploadResult.debugInfo}\n`;
                if(uploadResult.error) return { error: `Card ${i+1} media error: ${uploadResult.error}`, debugInfo: accumulatedDebugInfo };

                const cardComponents: any[] = [];
                if (uploadResult.handle && card.headerFormat !== 'NONE') {
                    cardComponents.push({ type: 'HEADER', format: card.headerFormat, example: { header_handle: [uploadResult.handle] }});
                }
                cardComponents.push({ type: 'BODY', text: card.body });
                if (card.buttons && card.buttons.length > 0) {
                    const formattedButtons = card.buttons.map((b: any) => ({ type: b.type, text: b.text, ...(b.url && { url: b.url }) }));
                    cardComponents.push({ type: 'BUTTONS', buttons: formattedButtons });
                }
                finalCards.push({ components: cardComponents });
            }
            
            payload.components.push({ type: 'CAROUSEL', cards: finalCards });
            debugInfo = accumulatedDebugInfo;
            
        } else { // Standard Template
            const bodyText = cleanText(formData.get('body') as string);
            const footerText = cleanText(formData.get('footer') as string);
            const buttonsJson = formData.get('buttons') as string;
            const headerFormat = formData.get('headerFormat') as string;
            const headerText = cleanText(formData.get('headerText') as string);
            const headerSampleFile = formData.get('headerSampleFile') as File;
            const headerSampleUrl = (formData.get('headerSampleUrl') as string || '').trim();
            finalTemplateToInsert.body = bodyText;
            finalTemplateToInsert.headerSampleUrl = headerSampleUrl;

            const buttons = (buttonsJson ? JSON.parse(buttonsJson) : []).map((button: any) => ({
                ...button,
                text: cleanText(button.text),
                url: (button.url || '').trim(),
                phone_number: (button.phone_number || '').trim(),
                example: Array.isArray(button.example) ? button.example.map((ex: string) => (ex || '').trim()) : button.example,
            }));

            if (!bodyText) return { error: 'Body text is required for standard templates.' };
            
            if (headerFormat !== 'NONE') {
                const headerComponent: any = { type: 'HEADER', format: headerFormat };
                if (headerFormat === 'TEXT') {
                    if (!headerText) return { error: 'Header text is required for TEXT header format.' };
                    headerComponent.text = headerText;
                    if (headerText.match(/{{\s*(\d+)\s*}}/g)) headerComponent.example = { header_text: ['example_header_var'] };
                } else {
                    const { handle, error, debugInfo: mediaDebug } = await getMediaHandleForTemplate(headerSampleFile, headerSampleUrl, accessToken, appId);
                    debugInfo = mediaDebug;
                    if(error) return { error, debugInfo };
                    if(handle) headerComponent.example = { header_handle: [handle] };
                }
                payload.components.push(headerComponent);
            }
            
            const bodyComponent: any = { type: 'BODY', text: bodyText };
            if (bodyText.match(/{{\s*(\d+)\s*}}/g)) bodyComponent.example = { body_text: [['example_body_var']] };
            payload.components.push(bodyComponent);

            if (footerText) payload.components.push({ type: 'FOOTER', text: footerText });
            if (buttons.length > 0) {
                const formattedButtons = buttons.map((button: any) => ({ type: button.type, text: button.text, ...(button.url && { url: button.url, example: button.example }), ...(button.phone_number && { phone_number: button.phone_number }) }));
                payload.components.push({ type: 'BUTTONS', buttons: formattedButtons });
            }
        }
    
        payloadString = JSON.stringify(payload, null, 2);
    
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${wabaId}/message_templates`,
            {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            }
        );
    
        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : null;

        debugInfo += `\n--- FINAL SUBMISSION ---\nPayload: ${payloadString}\nResponse Status: ${response.status}\nResponse Body: ${JSON.stringify(responseData, null, 2)}\n`;
    
        if (!response.ok) {
            console.error('Meta Template Creation Error:', responseData?.error || responseText);
            const errorMessage = responseData?.error?.error_user_title || responseData?.error?.message || 'Unknown error creating template.';
            return { error: `API Error: ${errorMessage}`, payload: payloadString, debugInfo };
        }

        const newMetaTemplateId = responseData?.id;
        if (!newMetaTemplateId) {
            return { error: 'Template created on Meta, but no ID was returned. Please sync manually.', payload: payloadString, debugInfo };
        }

        const templateToInsert = {
            ...finalTemplateToInsert,
            status: responseData?.status || 'PENDING',
            metaId: newMetaTemplateId,
            components: payload.components,
        };

        await db.collection('templates').insertOne(templateToInsert);
    
        revalidatePath('/dashboard/templates');
    
        const message = `Template "${name}" submitted successfully!`;
        return { message, payload: payloadString, debugInfo };
  
    } catch (e: any) {
        console.error('Error in handleCreateTemplate:', e);
        return { error: e.message || 'An unexpected error occurred.', payload: payloadString, debugInfo };
    }
}

export async function handleStopBroadcast(broadcastId: string): Promise<{ message?: string; error?: string }> {
    const broadcast = await getBroadcastById(broadcastId);
    if (!broadcast) return { error: 'Broadcast not found or you do not have access.' };
    
    try {
        const { db } = await connectToDatabase();
        const broadcastObjectId = new ObjectId(broadcastId);

        if (broadcast.status !== 'QUEUED' && broadcast.status !== 'PROCESSING') {
            return { error: 'This broadcast cannot be stopped as it is not currently active.' };
        }
        
        const updateResult = await db.collection('broadcasts').updateOne(
            { _id: broadcastObjectId },
            { $set: { status: 'Cancelled', completedAt: new Date() } }
        );

        if (updateResult.modifiedCount === 0) {
            const currentBroadcast = await db.collection('broadcasts').findOne({ _id: broadcastObjectId });
            if (currentBroadcast?.status !== 'QUEUED' && currentBroadcast?.status !== 'PROCESSING') {
                 return { message: 'Broadcast already completed or stopped.' };
            }
            return { error: 'Failed to update broadcast status.' };
        }
        
        const deleteResult = await db.collection('broadcast_contacts').deleteMany({
            broadcastId: broadcastObjectId,
            status: 'PENDING'
        });

        revalidatePath('/dashboard/broadcasts');

        return { message: `Broadcast has been stopped. ${deleteResult.deletedCount} pending messages were cancelled.` };
    } catch (e: any) {
        console.error('Failed to stop broadcast:', e);
        return { error: e.message || 'An unexpected error occurred while stopping the broadcast.' };
    }
}

type UpdateProjectSettingsState = {
  message?: string | null;
  error?: string | null;
};

export async function handleUpdateProjectSettings(
  prevState: UpdateProjectSettingsState,
  formData: FormData
): Promise<UpdateProjectSettingsState> {
    try {
        const projectId = formData.get('projectId') as string;
        const messagesPerSecond = formData.get('messagesPerSecond') as string;

        if (!projectId || !messagesPerSecond) {
            return { error: 'Missing required fields.' };
        }
        const hasAccess = await getProjectById(projectId);
        if (!hasAccess) return { error: 'Project not found or you do not have access.' };

        const mps = parseInt(messagesPerSecond, 10);
        if (isNaN(mps) || mps < 1) {
            return { error: 'Messages per second must be a number and at least 1.' };
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { messagesPerSecond: mps } }
        );
        
        if (result.matchedCount === 0) {
            return { error: 'Project not found.' };
        }
        
        revalidatePath('/dashboard/settings');

        return { message: 'Settings updated successfully!' };

    } catch (e: any) {
        console.error('Project settings update failed:', e);
        return { error: e.message || 'An unexpected error occurred while saving the settings.' };
    }
}

export async function handleCleanDatabase(
    prevState: { message?: string | null; error?: string | null; },
    formData: FormData
  ): Promise<{ message?: string | null; error?: string | null; }> {
      try {
          const { db } = await connectToDatabase();
          
          await db.collection('projects').deleteMany({});
          await db.collection('templates').deleteMany({});
          await db.collection('broadcasts').deleteMany({});
          await db.collection('broadcast_contacts').deleteMany({});
          await db.collection('notifications').deleteMany({});
          await db.collection('contacts').deleteMany({});
          await db.collection('incoming_messages').deleteMany({});
          await db.collection('outgoing_messages').deleteMany({});
          await db.collection('flows').deleteMany({});
          await db.collection('canned_messages').deleteMany({});
          await db.collection('flow_logs').deleteMany({});
          await db.collection('meta_flows').deleteMany({});


          revalidatePath('/dashboard');
  
          return { message: 'Database has been successfully cleaned of all projects, templates, and broadcast data.' };
      } catch (e: any) {
          console.error('Database cleaning failed:', e);
          return { error: e.message || 'An unexpected error occurred while cleaning the database.' };
      }
  }

export async function handleRequeueBroadcast(
    prevState: { message?: string | null; error?: string | null; },
    formData: FormData
): Promise<{ message?: string | null; error?: string | null; }> {
    const broadcastId = formData.get('broadcastId') as string;
    const newTemplateId = formData.get('templateId') as string;
    const requeueScope = formData.get('requeueScope') as 'ALL' | 'FAILED' | null;
    const newHeaderImageUrl = formData.get('headerImageUrl') as string | null;

    const originalBroadcast = await getBroadcastById(broadcastId);
    if (!originalBroadcast) {
        return { error: 'Original broadcast not found or you do not have access.' };
    }
    
    if (!newTemplateId || !ObjectId.isValid(newTemplateId)) {
        return { error: 'A valid template must be selected.' };
    }
    if (!requeueScope) {
        return { error: 'Please select which contacts to send to (All or Failed).' };
    }

    const { db } = await connectToDatabase();
    const originalBroadcastId = new ObjectId(broadcastId);

    try {
        const newTemplate = await db.collection('templates').findOne({ _id: new ObjectId(newTemplateId), projectId: originalBroadcast.projectId });
        
        if (!newTemplate) {
            return { error: 'Selected template not found.' };
        }

        const finalHeaderImageUrl = newHeaderImageUrl && newHeaderImageUrl.trim() !== '' ? newHeaderImageUrl.trim() : undefined;
        
        const newBroadcastData = {
            projectId: originalBroadcast.projectId,
            templateId: newTemplate._id,
            templateName: newTemplate.name,
            phoneNumberId: originalBroadcast.phoneNumberId,
            accessToken: originalBroadcast.accessToken,
            status: 'QUEUED' as const,
            createdAt: new Date(),
            contactCount: 0, // will be updated
            fileName: `Requeue of ${originalBroadcast.fileName}`,
            components: newTemplate.components,
            language: newTemplate.language,
            headerImageUrl: finalHeaderImageUrl,
        };

        const newBroadcastResult = await db.collection('broadcasts').insertOne(newBroadcastData);
        const newBroadcastId = newBroadcastResult.insertedId;

        const contactQuery: any = { broadcastId: originalBroadcastId };
        if (requeueScope === 'FAILED') {
            contactQuery.status = 'FAILED';
        }

        const originalContactsCursor = db.collection('broadcast_contacts').find(contactQuery);
        
        let newContactsCount = 0;
        const contactBatchSize = 1000;
        let contactBatch: any[] = [];

        for await (const contact of originalContactsCursor) {
            const newContact = {
                broadcastId: newBroadcastId,
                phone: contact.phone,
                variables: contact.variables,
                status: 'PENDING' as const,
                createdAt: new Date(),
            };
            contactBatch.push(newContact);
            newContactsCount++;

            if (contactBatch.length >= contactBatchSize) {
                await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
                contactBatch = [];
            }
        }
        
        if (contactBatch.length > 0) {
            await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
        }
        
        await db.collection('broadcasts').updateOne({ _id: newBroadcastId }, { $set: { contactCount: newContactsCount } });

        if (newContactsCount === 0) {
            await db.collection('broadcasts').deleteOne({ _id: newBroadcastId });
            const scopeText = requeueScope.toLowerCase();
            return { error: `No ${scopeText} contacts found to requeue from the original broadcast.` };
        }
        
        revalidatePath('/dashboard/broadcasts');

        return { message: `Broadcast has been successfully requeued with ${newContactsCount} contacts.` };

    } catch (e: any) {
        console.error('Failed to requeue broadcast:', e);
        return { error: e.message || 'An unexpected error occurred while requeuing the broadcast.' };
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

export async function handleSyncWabas(): Promise<{ message?: string; error?: string }> {
    const businessId = process.env.META_MAIN_BUSINESS_ID;
    const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN;
    const apiVersion = 'v22.0';
    const callbackBaseUrl = process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!businessId || !accessToken) {
        return { error: 'Business ID and Access Token must be configured in environment variables.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        let allWabas: MetaWaba[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/${apiVersion}/${businessId}/client_whatsapp_business_accounts?access_token=${accessToken}&limit=100`;

        while(nextUrl) {
            const response = await fetch(nextUrl);
            const responseData: MetaWabasResponse = await response.json();

            if (!response.ok) {
                 const errorMessage = (responseData as any)?.error?.message || 'Unknown error syncing WABAs.';
                 return { error: `API Error: ${errorMessage}` };
            }
            
            if (responseData.data && responseData.data.length > 0) {
                allWabas.push(...responseData.data);
            }
            
            nextUrl = responseData.paging?.next;
        }

        if (allWabas.length === 0) {
            return { message: 'No client WhatsApp Business Accounts found to sync.' };
        }

        const bulkOps = await Promise.all(allWabas.map(async (waba) => {
            const phoneNumbersResponse = await fetch(
                `https://graph.facebook.com/${apiVersion}/${waba.id}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`
            );
            const phoneNumbersData: MetaPhoneNumbersResponse = await phoneNumbersResponse.json();
            
            const phoneNumbers: PhoneNumber[] = phoneNumbersData.data ? phoneNumbersData.data.map((num: any) => ({
                id: num.id,
                display_phone_number: num.display_phone_number,
                verified_name: num.verified_name,
                code_verification_status: num.code_verification_status,
                quality_rating: num.quality_rating,
                platform_type: num.platform_type,
                throughput: num.throughput,
            })) : [];

            const projectDoc = {
                name: waba.name,
                wabaId: waba.id,
                accessToken: accessToken,
                phoneNumbers: phoneNumbers,
                createdAt: new Date(),
                messagesPerSecond: 1000,
            };

            return {
                updateOne: {
                    filter: { wabaId: waba.id },
                    update: { 
                        $set: {
                            name: projectDoc.name,
                            accessToken: projectDoc.accessToken,
                            phoneNumbers: projectDoc.phoneNumbers
                        },
                        $setOnInsert: {
                             createdAt: projectDoc.createdAt,
                             messagesPerSecond: projectDoc.messagesPerSecond,
                        }
                    },
                    upsert: true,
                }
            };
        }));
        
        if (bulkOps.length > 0) {
            const result = await db.collection('projects').bulkWrite(bulkOps);
            const syncedCount = result.upsertedCount + result.modifiedCount;
            revalidatePath('/dashboard');
            return { message: `Successfully synced ${syncedCount} projects from Meta.` };
        } else {
            return { message: "No new projects to sync." };
        }

    } catch (e: any) {
        console.error('Project sync from Meta failed:', e);
        return { error: e.message || 'An unexpected error occurred during project sync.' };
    }
}

export type WebhookLog = {
    _id: ObjectId;
    payload: any;
    searchableText: string;
    processed?: boolean;
    createdAt: Date;
    projectId?: ObjectId;
    error?: string;
};

const getEventFieldForLog = (log: WithId<WebhookLog>): string => {
    try {
        return log.payload?.entry?.[0]?.changes?.[0]?.field || 'N/A';
    } catch {
        return 'N/A';
    }
};

const getEventSummaryForLog = (log: WithId<WebhookLog>): string => {
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

export type WebhookLogListItem = {
    _id: string;
    createdAt: string;
    eventField: string;
    eventSummary: string;
};

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
            eventField: getEventFieldForLog(log),
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

export async function handleSubscribeAllProjects(): Promise<{ message?: string; error?: string }> {
    const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN;
    const apiVersion = 'v22.0';
    const callbackBaseUrl = process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!accessToken) {
        return { error: 'System User Access Token must be configured in environment variables.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection('projects').find({}, { projection: { wabaId: 1, appId: 1 } }).toArray();

        if (projects.length === 0) {
            return { message: 'No projects found in the database to subscribe.' };
        }
        
        let successCount = 0;
        let errorCount = 0;
        let lastError = '';

        for (const project of projects) {
            const appId = project.appId || process.env.NEXT_PUBLIC_META_APP_ID;
            if (!appId) {
                errorCount++;
                lastError = `App ID not found for project with WABA ID ${project.wabaId}`;
                continue;
            }

            try {
                 const fields = 'account_update,message_template_status_update,messages,phone_number_name_update,phone_number_quality_update,security,template_category_update';
                 await axios.post(
                    `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions`,
                    {
                        object: 'whatsapp_business_account',
                        callback_url: `${callbackBaseUrl}/api/webhooks/meta`,
                        fields: fields,
                        verify_token: process.env.META_VERIFY_TOKEN,
                        access_token: accessToken,
                    }
                );
                successCount++;
            } catch (e: any) {
                errorCount++;
                lastError = getErrorMessage(e);
                console.error(`Failed to subscribe project with WABA ID ${project.wabaId}:`, lastError);
            }
        }
        
        if (errorCount > 0) {
            return { message: `Subscription complete. ${successCount} successful, ${errorCount} failed. Last error: ${lastError}` };
        }
        
        return { message: `Successfully subscribed ${successCount} project(s) to webhook events.` };

    } catch (e: any) {
        console.error('Failed to subscribe projects:', e);
        return { error: e.message || 'An unexpected error occurred during subscription.' };
    }
}

export async function handleSubscribeProjectWebhook(projectId: string): Promise<{ message?: string; error?: string }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) {
        return { error: 'Project not found or you do not have access.' };
    }

    const accessToken = hasAccess.accessToken;
    const appId = hasAccess.appId || process.env.NEXT_PUBLIC_META_APP_ID;
    const apiVersion = 'v22.0';
    const callbackBaseUrl = process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL;
    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (!appId) {
        return { error: 'App ID is not configured for this project, and no fallback is set.' };
    }
    if (!verifyToken) {
        return { error: 'META_VERIFY_TOKEN is not configured.' };
    }

    try {
        const fields = 'account_update,message_template_status_update,messages,phone_number_name_update,phone_number_quality_update,security,template_category_update';
        await axios.post(
            `https://graph.facebook.com/${apiVersion}/${appId}/subscriptions`,
            {
                object: 'whatsapp_business_account',
                callback_url: `${callbackBaseUrl}/api/webhooks/meta`,
                fields: fields,
                verify_token: verifyToken,
                access_token: accessToken,
            }
        );
        
        return { message: `Successfully subscribed project "${hasAccess.name}" to webhook events.` };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`Failed to subscribe project ${projectId}:`, errorMessage);
        return { error: errorMessage };
    }
}


export async function handleAddNewContact(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const waId = (formData.get('waId') as string).replace(/\D/g, ''); // Remove non-digit characters

    if (!projectId || !phoneNumberId || !name || !waId) {
        return { error: 'All fields are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        const existingContact = await db.collection('contacts').findOne({ projectId: new ObjectId(projectId), waId });

        if (existingContact) {
            return { error: 'A contact with this WhatsApp ID already exists for this project.' };
        }
        
        const newContact: Omit<Contact, '_id'> = {
            projectId: new ObjectId(projectId),
            waId,
            phoneNumberId,
            name,
            createdAt: new Date(),
            status: 'new',
        };

        await db.collection('contacts').insertOne(newContact as any);
        
        revalidatePath('/dashboard/contacts');
        
        return { message: 'Contact added successfully.' };
    } catch (e: any) {
        console.error('Failed to add new contact:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleImportContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectId || !phoneNumberId || !contactFile || contactFile.size === 0) {
        return { error: 'Project, phone number, and a file are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied.' };
    
    const { db } = await connectToDatabase();

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const phoneKey = Object.keys(contacts[0])[0];
            const nameKey = Object.keys(contacts[0])[1];
            if (!phoneKey || !nameKey) return reject(new Error('File must have at least two columns: phone and name.'));
            
            const bulkOps = contacts.map(row => {
                const waId = String(row[phoneKey] || '').replace(/\D/g, '');
                const name = String(row[nameKey] || '').trim();

                if (!waId || !name) return null;

                return {
                    updateOne: {
                        filter: { waId, projectId: new ObjectId(projectId) },
                        update: {
                            $set: { name, phoneNumberId },
                            $setOnInsert: { waId, projectId: new ObjectId(projectId), createdAt: new Date(), status: 'new' }
                        },
                        upsert: true
                    }
                }
            }).filter(Boolean);

            if (bulkOps.length === 0) return resolve(0);

            const result = await db.collection('contacts').bulkWrite(bulkOps as any[]);
            resolve(result.upsertedCount + result.modifiedCount);
        });
    };

    try {
        let contactCount = 0;
        if (contactFile.name.endsWith('.csv')) {
            const csvText = await contactFile.text();
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            contactCount = await processContacts(parsed.data);
        } else if (contactFile.name.endsWith('.xlsx')) {
            const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('The XLSX file contains no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            contactCount = await processContacts(jsonData);
        } else {
             return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
        }
        
        if (contactCount === 0) {
            return { error: 'No valid contacts found to import.' };
        }
        
        revalidatePath('/dashboard/contacts');
        return { message: `Successfully imported ${contactCount} contact(s).` };
    } catch (e: any) {
        console.error('Failed to import contacts:', e);
        return { error: e.message || 'An unexpected error occurred during import.' };
    }
}

export async function handleSendMessage(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const waId = formData.get('waId') as string;
    const messageText = formData.get('messageText') as string;
    const mediaFile = formData.get('mediaFile') as File;

    if (!contactId || !projectId || !waId || !phoneNumberId || (!messageText && (!mediaFile || mediaFile.size === 0))) {
        return { error: 'Required fields are missing to send message.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        let messagePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waId,
        };
        let messageType: OutgoingMessage['type'] = 'text';

        if (mediaFile && mediaFile.size > 0) {
            // Step 1: Upload the media file to get a media ID
            const form = new FormData();
            form.append('file', Buffer.from(await mediaFile.arrayBuffer()), {
                filename: mediaFile.name,
                contentType: mediaFile.type,
            });
            form.append('messaging_product', 'whatsapp');

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${phoneNumberId}/media`,
                form,
                { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${project.accessToken}` } }
            );
            
            const mediaId = uploadResponse.data.id;
            if (!mediaId) {
                return { error: 'Failed to upload media to Meta. No ID returned.' };
            }

            // Step 2: Construct the message payload with the media ID
            const detectedMediaType = mediaFile.type.split('/')[0];

            if (detectedMediaType === 'image') {
                messageType = 'image';
                messagePayload.type = 'image';
                messagePayload.image = { id: mediaId };
                if (messageText) messagePayload.image.caption = messageText;
            } else if (detectedMediaType === 'video') {
                messageType = 'video';
                messagePayload.type = 'video';
                messagePayload.video = { id: mediaId };
                if (messageText) messagePayload.video.caption = messageText;
            } else {
                messageType = 'document';
                messagePayload.type = 'document';
                messagePayload.document = { id: mediaId, filename: mediaFile.name };
                 if (messageText) messagePayload.document.caption = messageText;
            }
        } else {
            messageType = 'text';
            messagePayload.type = 'text';
            messagePayload.text = { body: messageText, preview_url: true };
        }
        
        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${project.accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');
        
        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: new ObjectId(contactId), projectId: new ObjectId(projectId), wamid, messageTimestamp: now, type: messageType,
            content: messagePayload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });

        const lastMessage = messageType === 'text' ? messageText : `[${messageType}]`;
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });
        
        revalidatePath('/dashboard/chat');

        return { message: 'Message sent successfully.' };

    } catch (e: any) {
        console.error('Failed to send message:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleSendTemplateMessage(contactId: string, templateId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(contactId) || !ObjectId.isValid(templateId)) {
        return { error: 'Invalid ID provided.' };
    }

    const { db } = await connectToDatabase();
    
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) return { error: 'Contact not found.' };

    const project = await db.collection<Project>('projects').findOne({ _id: contact.projectId });
    if (!project) return { error: 'Project not found.' };

    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Template not found.' };
    if (template.status !== 'APPROVED') return { error: 'Cannot send a template that is not approved.' };
    
    const phoneNumberId = contact.phoneNumberId;
    const waId = contact.waId;
    const accessToken = project.accessToken;

    try {
        const payload = {
            messaging_product: "whatsapp",
            to: waId,
            type: "template",
            template: {
                name: template.name,
                language: { code: template.language }
                // Note: This simplified version does not handle template variables.
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'template',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });
        
        const lastMessage = `[Template]: ${template.name}`;
        await db.collection('contacts').updateOne({ _id: contact._id }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });

        revalidatePath('/dashboard/chat');
        return { message: `Template "${template.name}" sent successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred while sending the template.' };
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

export async function findOrCreateContact(projectId: string, phoneNumberId: string, waId: string): Promise<{ contact?: WithId<Contact>; error?: string }> {
    if (!projectId || !phoneNumberId || !waId) {
        return { error: 'Missing required information.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        const contactResult = await db.collection<Contact>('contacts').findOneAndUpdate(
            { waId, projectId: new ObjectId(projectId) },
            { 
                $set: { phoneNumberId }, // Ensure phone number is updated if they message a new one
                $setOnInsert: {
                    waId,
                    projectId: new ObjectId(projectId),
                    name: `User (${waId.slice(-4)})`,
                    createdAt: new Date(),
                    status: 'new'
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        if (contactResult) {
            revalidatePath('/dashboard/chat');
            revalidatePath('/dashboard/contacts');
            return { contact: JSON.parse(JSON.stringify(contactResult)) };
        } else {
            return { error: 'Failed to find or create contact.' };
        }
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function markConversationAsRead(contactId: string): Promise<{ success: boolean }> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { unreadCount: 0 } });
    await db.collection('incoming_messages').updateMany({ contactId: new ObjectId(contactId) }, { $set: { isRead: true } });
    revalidatePath('/dashboard/chat');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

// --- ADMIN FLOW LOG ACTIONS ---

export async function getFlowLogs(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ logs: Omit<WithId<FlowLog>, 'entries'>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<FlowLog> = {};
        if (query) {
            const isObjectId = ObjectId.isValid(query);
            filter.$or = [
                { flowName: { $regex: query, $options: 'i' } },
                ...(isObjectId ? [{ contactId: new ObjectId(query) }] : [])
            ];
        }
        
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            db.collection('flow_logs')
              .find(filter)
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(limit)
              .project({ entries: 0 })
              .toArray(),
            db.collection('flow_logs').countDocuments(filter)
        ]);

        return { logs: JSON.parse(JSON.stringify(logs)), total };
    } catch (error) {
        console.error('Failed to fetch flow logs:', error);
        return { logs: [], total: 0 };
    }
}

export async function getFlowLogById(logId: string): Promise<WithId<FlowLog> | null> {
    if (!ObjectId.isValid(logId)) return null;
    try {
        const { db } = await connectToDatabase();
        const log = await db.collection<FlowLog>('flow_logs').findOne({ _id: new ObjectId(logId) });
        return log ? JSON.parse(JSON.stringify(log)) : null;
    } catch (error) {
        console.error('Failed to fetch flow log by ID:', error);
        return null;
    }
}

// --- PAYMENT GATEWAY ACTIONS ---
export type PaymentGatewaySettings = {
    _id: 'phonepe'; // Using a fixed ID to ensure only one document for these settings
    merchantId: string;
    saltKey: string;
    saltIndex: string;
    environment: 'staging' | 'production';
};

export async function getPaymentGatewaySettings(): Promise<WithId<PaymentGatewaySettings> | null> {
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

type InitiatePaymentResult = {
  redirectUrl?: string;
  error?: string;
}

export async function handleInitiatePayment(planId: string): Promise<InitiatePaymentResult> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to purchase a plan.' };
    }

    if (!ObjectId.isValid(planId)) {
        return { error: 'Invalid plan selected.' };
    }

    const { db } = await connectToDatabase();
    try {
        const [plan, pgSettings] = await Promise.all([
            getPlanById(planId),
            getPaymentGatewaySettings()
        ]);
        
        if (!plan) return { error: 'Selected plan not found.' };
        if (!pgSettings) return { error: 'Payment gateway is not configured. Please contact support.' };

        const { merchantId, saltKey, saltIndex, environment } = pgSettings;
        if (!merchantId || !saltKey || !saltIndex) {
            return { error: 'Payment gateway credentials are not fully configured.' };
        }

        const now = new Date();
        const newTransaction: Omit<Transaction, '_id'> = {
            userId: new ObjectId(session.user._id),
            planId: new ObjectId(planId),
            amount: plan.price * 100, // Amount in paise
            status: 'PENDING',
            provider: 'phonepe',
            createdAt: now,
            updatedAt: now,
            type: 'PLAN',
            description: `Upgrade to ${plan.name} Plan`,
        };
        const transactionResult = await db.collection('transactions').insertOne(newTransaction as any);
        const merchantTransactionId = transactionResult.insertedId.toString();

        const data = {
            merchantId: merchantId,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: session.user._id.toString(),
            amount: plan.price * 100,
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/${merchantTransactionId}`,
            redirectMode: 'POST',
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
            mobileNumber: '9999999999', // Placeholder as per PhonePe docs for non-mobile payments
            paymentInstrument: {
                type: 'PAY_PAGE',
            },
        };

        const payload = JSON.stringify(data);
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

export async function handleInitiateCreditPurchase(data: {credits: number, amount: number}): Promise<InitiatePaymentResult> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to purchase credits.' };
    }
    const { credits, amount } = data;
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
            amount: amount * 100, // Amount in paise
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

// --- AUTH ACTIONS ---
export async function handleLogin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ email });

        if (!user || !user.password) {
            return { error: 'Invalid credentials.' };
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            return { error: 'Invalid credentials.' };
        }

        const sessionToken = createSessionToken({ userId: user._id.toString(), email: user.email });
        cookies().set('session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    } catch (e: any) {
        console.error('Login failed:', e);
        return { error: 'An unexpected error occurred.' };
    }
    
    redirect('/dashboard');
}

export async function handleSignup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!name || !email || !password) {
        return { error: 'All fields are required.' };
    }
    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return { error: 'An account with this email already exists.' };
        }

        const hashedPassword = await hashPassword(password);
        const newUser: Omit<User, '_id'> = {
            name,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            credits: 1000, // Give new users 1000 free credits
        };

        await db.collection('users').insertOne(newUser as any);
    } catch (e: any) {
        console.error('Signup failed:', e);
        return { error: 'An unexpected error occurred.' };
    }

    redirect('/login');
}

export async function handleLogout() {
    cookies().delete('session');
    redirect('/login');
}

export async function handleUpdateUserProfile(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const name = formData.get('name') as string;
    if (!name) return { error: 'Name is required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { name } }
        );
        revalidatePath('/dashboard/profile');
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

// --- PLAN MANAGEMENT ACTIONS ---
export async function getPlans(filter?: Filter<Plan>): Promise<WithId<Plan>[]> {
    try {
        const { db } = await connectToDatabase();
        const plans = await db.collection('plans').find(filter || {}).sort({ price: 1 }).toArray();
        return JSON.parse(JSON.stringify(plans));
    } catch (error) {
        console.error("Failed to fetch plans:", error);
        return [];
    }
}

export async function getPlanById(planId: string): Promise<WithId<Plan> | null> {
    if (!ObjectId.isValid(planId)) return null;
    try {
        const { db } = await connectToDatabase();
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
        return plan ? JSON.parse(JSON.stringify(plan)) : null;
    } catch (error) {
        console.error('Failed to fetch plan by ID:', error);
        return null;
    }
}

export async function savePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const planId = formData.get('planId') as string;
    const isNew = planId === 'new';

    try {
        const features: PlanFeaturePermissions = {
            campaigns: formData.get('campaigns') === 'on',
            liveChat: formData.get('liveChat') === 'on',
            contacts: formData.get('contacts') === 'on',
            templates: formData.get('templates') === 'on',
            flowBuilder: formData.get('flowBuilder') === 'on',
            metaFlows: formData.get('metaFlows') === 'on',
            whatsappAds: formData.get('whatsappAds') === 'on',
            webhooks: formData.get('webhooks') === 'on',
            settingsBroadcast: formData.get('settingsBroadcast') === 'on',
            settingsAutoReply: formData.get('settingsAutoReply') === 'on',
            settingsMarketing: formData.get('settingsMarketing') === 'on',
            settingsTemplateLibrary: formData.get('settingsTemplateLibrary') === 'on',
            settingsCannedMessages: formData.get('settingsCannedMessages') === 'on',
            settingsAgentsRoles: formData.get('settingsAgentsRoles') === 'on',
            settingsCompliance: formData.get('settingsCompliance') === 'on',
            settingsUserAttributes: formData.get('settingsUserAttributes') === 'on',
            apiAccess: formData.get('apiAccess') === 'on',
        };

        const planData: Omit<Plan, '_id' | 'createdAt'> = {
            name: formData.get('name') as string,
            price: Number(formData.get('price')),
            currency: formData.get('currency') as string,
            isPublic: formData.get('isPublic') === 'on',
            isDefault: formData.get('isDefault') === 'on',
            projectLimit: Number(formData.get('projectLimit')),
            agentLimit: Number(formData.get('agentLimit')),
            attributeLimit: Number(formData.get('attributeLimit')),
            templateLimit: Number(formData.get('templateLimit')),
            flowLimit: Number(formData.get('flowLimit')),
            metaFlowLimit: Number(formData.get('metaFlowLimit')),
            cannedMessageLimit: Number(formData.get('cannedMessageLimit')),
            messageCosts: {
                marketing: Number(formData.get('cost_marketing')),
                utility: Number(formData.get('cost_utility')),
                authentication: Number(formData.get('cost_authentication')),
            },
            features: features,
        };

        if (!planData.name || isNaN(planData.price)) {
            return { error: 'Plan name and price are required.' };
        }
        
        const { db } = await connectToDatabase();
        
        if (planData.isDefault) {
            // Ensure no other plan is default
            await db.collection('plans').updateMany({ _id: { $ne: isNew ? new ObjectId() : new ObjectId(planId) } }, { $set: { isDefault: false } });
        }

        if (isNew) {
            await db.collection('plans').insertOne({ ...planData, createdAt: new Date() } as any);
        } else {
            await db.collection('plans').updateOne({ _id: new ObjectId(planId) }, { $set: planData });
        }

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan "${planData.name}" has been saved successfully.` };

    } catch (e: any) {
        console.error('Failed to save plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deletePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const planId = formData.get('planId') as string;
    if (!planId || !ObjectId.isValid(planId)) {
        return { error: 'Invalid Plan ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const planObjectId = new ObjectId(planId);
        
        const plan = await db.collection('plans').findOne({ _id: planObjectId });
        if (plan?.isDefault) {
            return { error: 'Cannot delete the default plan.' };
        }

        await db.collection('plans').deleteOne({ _id: planObjectId });

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan successfully deleted.` };

    } catch (e: any) {
        console.error('Failed to delete plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

// --- PROJECT MANAGEMENT ---

export async function handleCreateProject(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to create a project.' };
    }

    const wabaId = formData.get('wabaId') as string;
    const appId = formData.get('appId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!wabaId || !appId || !accessToken) {
        return { error: 'All fields are required.' };
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v22.0/${wabaId}?fields=name&access_token=${accessToken}`);
        const data = await response.json();

        if (data.error) {
            return { error: `Meta API Error: ${data.error.message}` };
        }

        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({ wabaId: wabaId });
        if(existingProject) {
            return { error: 'A project with this WABA ID already exists.'};
        }
        
        const newProject: Omit<Project, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: data.name,
            wabaId: wabaId,
            appId: appId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 1000,
        };

        const result = await db.collection('projects').insertOne(newProject as any);
        
        if(result.insertedId) {
            await handleSyncPhoneNumbers(result.insertedId.toString());
        }

        revalidatePath('/dashboard');
        
        return { message: `Project "${data.name}" created successfully!` };

    } catch (e: any) {
        console.error('Project creation failed:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleDeleteProject(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;

    // A real app should have a robust role-based check here.
    const session = await getSession();
    if (session?.user?.email !== 'admin@wachat.com') {
        return { error: 'You do not have permission to delete projects.' };
    }
    
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const broadcastIds = await db.collection('broadcasts').find({ projectId: projectObjectId }).map(b => b._id).toArray();
        
        const deletePromises = [
            db.collection('projects').deleteOne({ _id: projectObjectId }),
            db.collection('templates').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcasts').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcast_contacts').deleteMany({ broadcastId: { $in: broadcastIds } }),
            db.collection('notifications').deleteMany({ projectId: projectObjectId }),
            db.collection('contacts').deleteMany({ projectId: projectObjectId }),
            db.collection('incoming_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('outgoing_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flows').deleteMany({ projectId: projectObjectId }),
            db.collection('canned_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flow_logs').deleteMany({ projectId: projectObjectId }),
            db.collection('meta_flows').deleteMany({ projectId: projectObjectId }),
            db.collection('ad_campaigns').deleteMany({ projectId: projectObjectId }),
        ];

        await Promise.all(deletePromises);
        
        revalidatePath('/admin/dashboard');

        return { message: 'Project and all associated data have been permanently deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

export async function handleFacebookSetup(accessToken: string, wabaIds: string[]): Promise<{ success: boolean, count: number, error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, count: 0, error: 'You must be logged in.' };
    }

    try {
        const { db } = await connectToDatabase();
        const bulkOps: any[] = [];

        for (const wabaId of wabaIds) {
            const wabaDetailsResponse = await fetch(`https://graph.facebook.com/v22.0/${wabaId}?fields=name,id&access_token=${accessToken}`);
            const wabaData = await wabaDetailsResponse.json();

            if (wabaData.error) {
                console.error(`Failed to fetch details for WABA ${wabaId}:`, wabaData.error);
                continue;
            }

            const projectDoc = {
                userId: new ObjectId(session.user._id),
                name: wabaData.name,
                wabaId: wabaData.id,
                accessToken: accessToken,
                createdAt: new Date(),
                messagesPerSecond: 1000,
            };

            bulkOps.push({
                updateOne: {
                    filter: { wabaId: wabaData.id },
                    update: { 
                        $set: { name: projectDoc.name, accessToken: projectDoc.accessToken, userId: projectDoc.userId },
                        $setOnInsert: { ...projectDoc, phoneNumbers: [] }
                    },
                    upsert: true,
                }
            });
        }
        
        if (bulkOps.length > 0) {
            const result = await db.collection('projects').bulkWrite(bulkOps);
            const syncedCount = result.upsertedCount + result.modifiedCount;
            revalidatePath('/dashboard');
            return { success: true, count: syncedCount };
        } else {
            return { success: false, count: 0, error: "No valid WABAs could be processed." };
        }

    } catch (e: any) {
        console.error("Facebook setup failed:", e);
        return { success: false, count: 0, error: e.message || 'An unexpected error occurred during setup.' };
    }
}


// --- AGENT & INVITATION MANAGEMENT ---

export async function handleInviteAgent(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!projectId || !email || !role) return { error: 'Missing required fields.' };
    if (!ObjectId.isValid(projectId)) return { error: 'Invalid project ID.' };

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'Project not found or you are not the owner.' };
        }
        
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(session.user.plan?._id) });
        if (!plan) return { error: 'Could not determine your plan limits.' };

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
            inviterId: session.user._id,
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

export async function handleRemoveAgent(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
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


// --- NOTIFICATION ACTIONS ---

export async function getAllNotifications(
    page: number = 1,
    limit: number = 20,
    eventTypeFilter?: string
): Promise<{ notifications: WithId<NotificationWithProject>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notifications: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        
        const projectFilter: Filter<Project> = {
            $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
        };
        const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        
        const filter: Filter<Notification> = { projectId: { $in: accessibleProjectIds } };
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

// --- SETTINGS ACTIONS ---
export async function handleUpdateAutoReplySettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const replyType = formData.get('replyType') as keyof AutoReplySettings;
    if (!projectId || !replyType) return { error: 'Missing required data.' };

    const session = await getSession();
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess || hasAccess.userId.toString() !== session?.user?._id.toString()) return { error: "Access denied." };

    let updatePayload: any = { enabled: formData.get('enabled') === 'on' };

    if (replyType === 'welcomeMessage') {
        updatePayload.message = formData.get('message') as string;
    }
    if (replyType === 'general') {
        const repliesJSON = formData.get('replies') as string;
        try {
            updatePayload.replies = repliesJSON ? JSON.parse(repliesJSON) : [];
            delete updatePayload.message; // old field
            delete updatePayload.context; // old field
        } catch (e) {
            return { error: 'Invalid format for replies data.' };
        }
    }
    if (replyType === 'inactiveHours') {
        updatePayload = {
            ...updatePayload,
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            timezone: formData.get('timezone'),
            days: [0, 1, 2, 3, 4, 5, 6].filter(day => formData.get(`day_${day}`) === 'on')
        }
    }
    if (replyType === 'aiAssistant') {
        updatePayload.context = formData.get('context');
        updatePayload.autoTranslate = formData.get('autoTranslate') === 'on';
        delete updatePayload.message; // 'message' is not part of aiAssistant schema
    }
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { [`autoReplySettings.${replyType}`]: updatePayload } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Auto-reply settings updated successfully!' };
    } catch (e: any) {
        return { error: e.message || 'Failed to save settings.' };
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
    }

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
    
    try {
        const attributes = JSON.parse(attributesJSON);
        
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), userId: new ObjectId(session.user._id) },
            { $set: { userAttributes: attributes } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'User attributes saved successfully.' };
    } catch (e: any) {
        console.error("Failed to save user attributes:", e);
        return { error: 'An error occurred while saving.' };
    }
}

// --- Canned Message Actions ---
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
        const { db } = await connectToDatabase();
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

// --- CHAT & CONTACT ACTIONS ---
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

        // Security Check: Is user owner or agent on this project?
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
        return { success: true };

    } catch (e: any) {
        return { success: false, error: 'Failed to update contact status.' };
    }
}


export async function getContactsForProject(
    projectId: string,
    phoneNumberId: string,
    page: number,
    limit: number
): Promise<{ contacts: WithId<Contact>[], total: number }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess || !phoneNumberId) {
        return { contacts: [], total: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId };
        
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

export async function getContactsPageData(projectId: string, phoneNumberId: string, page: number, query: string): Promise<{
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
        const queryRegex = { $regex: query, $options: 'i' };
        filter.$or = [
            { name: queryRegex },
            { waId: queryRegex },
        ];
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
    metaFlows: WithId<MetaFlow>[];
    templates: WithId<Template>[];
    selectedPhoneNumberId: string;
}> {
    const defaultResponse = { project: null, contacts: [], totalContacts: 0, selectedContact: null, conversation: [], metaFlows: [], templates: [], selectedPhoneNumberId: '' };
    const projectData = await getProjectById(projectId);
    if (!projectData) return defaultResponse;

    let selectedPhoneId = phoneId || projectData.phoneNumbers?.[0]?.id || '';
    if (!selectedPhoneId) return { ...defaultResponse, project: projectData };

    const { db } = await connectToDatabase();
    
    const [allContacts, total, metaFlowsData, templatesData] = await Promise.all([
        db.collection<Contact>('contacts').find({ projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId }).sort({ lastMessageTimestamp: -1 }).limit(30).toArray(),
        db.collection('contacts').countDocuments({ projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId }),
        getMetaFlows(projectId),
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
        metaFlows: JSON.parse(JSON.stringify(metaFlowsData)),
        templates: JSON.parse(JSON.stringify(templatesData.filter(t => t.status === 'APPROVED'))),
        selectedPhoneNumberId: selectedPhoneId,
    };
}

export async function handleSendMetaFlow(contactId: string, metaFlowId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(contactId) || !ObjectId.isValid(metaFlowId)) {
        return { error: 'Invalid ID provided.' };
    }

    const { db } = await connectToDatabase();
    
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) return { error: 'Contact not found.' };

    const project = await db.collection<Project>('projects').findOne({ _id: contact.projectId });
    if (!project) return { error: 'Project not found.' };

    const metaFlow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(metaFlowId) });
    if (!metaFlow) return { error: 'Flow not found.' };
    
    const phoneNumberId = contact.phoneNumberId;
    const waId = contact.waId;
    const accessToken = project.accessToken;

    try {
        const flowTitle = metaFlow.flow_data?.screens?.[0]?.title || metaFlow.name.replace(/_/g, ' ');
        const headerText = flowTitle.substring(0, 60);
        const bodyText = metaFlow.flow_data?.screens?.[0]?.layout?.children?.find((c: any) => c.type === 'TextBody')?.text || 'Tap the button below to start.';
        
        const payload = {
            messaging_product: "whatsapp",
            to: waId,
            recipient_type: "individual",
            type: "interactive",
            interactive: {
                type: "flow",
                header: { type: "text", text: headerText },
                body: { text: bodyText.substring(0, 1024) },
                footer: { text: "Powered by Wachat" },
                action: {
                    name: metaFlow.name,
                    parameters: {}
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, payload, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: contact._id, projectId: project._id, wamid, messageTimestamp: now, type: 'interactive',
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });

        revalidatePath('/dashboard/chat');
        return { message: `Flow "${metaFlow.name}" sent successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) || 'An unexpected error occurred while sending the flow.' };
    }
}


// --- FLOW ACTIONS ---
export async function getFlowsForProject(projectId: string): Promise<WithId<Flow>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection<Flow>('flows')
            .find({ projectId: new ObjectId(projectId) })
            .project({ name: 1, triggerKeywords: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getFlowById(flowId: string): Promise<WithId<Flow> | null> {
    if (!ObjectId.isValid(flowId)) return null;
    try {
        const { db } = await connectToDatabase();
        const flow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(flowId) });
        // Add security check here if needed
        return flow ? JSON.parse(JSON.stringify(flow)) : null;
    } catch (e) {
        return null;
    }
}

export async function saveFlow(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    triggerKeywords: string[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, projectId, name, nodes, edges, triggerKeywords } = data;
    if (!projectId || !name) return { error: 'Project ID and Flow Name are required.' };
    const isNew = !flowId;
    
    const flowData: Omit<Flow, '_id' | 'createdAt'> = {
        name,
        projectId: new ObjectId(projectId),
        nodes,
        edges,
        triggerKeywords,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('flows').insertOne({ ...flowData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/flow-builder');
            return { message: 'Flow created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('flows').updateOne(
                { _id: new ObjectId(flowId) },
                { $set: flowData }
            );
            revalidatePath('/dashboard/flow-builder');
            return { message: 'Flow updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(flowId)) return { error: 'Invalid Flow ID.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('flows').deleteOne({ _id: new ObjectId(flowId) });
        revalidatePath('/dashboard/flow-builder');
        return { message: 'Flow deleted.' };
    } catch (e) {
        return { error: 'Failed to delete flow.' };
    }
}

export async function getFlowBuilderPageData(projectId: string): Promise<{
    flows: WithId<Flow>[];
    initialFlow: WithId<Flow> | null;
}> {
    const flows = await getFlowsForProject(projectId);
    const initialFlow = flows.length > 0 ? await getFlowById(flows[0]._id.toString()) : null;
    return { flows, initialFlow };
}
    
// --- ADS MANAGEMENT ACTIONS ---

export async function handleUpdateMarketingSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const adAccountId = formData.get('adAccountId') as string;
    const facebookPageId = formData.get('facebookPageId') as string;

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    if (!adAccountId || !facebookPageId) {
        return { error: 'Both Ad Account ID and Facebook Page ID are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { adAccountId, facebookPageId } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Marketing settings updated successfully!' };
    } catch (e: any) {
        return { error: 'Failed to save marketing settings.' };
    }
}


export async function getAdCampaigns(projectId: string): Promise<WithId<AdCampaign>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const ads = await db.collection<AdCampaign>('ad_campaigns')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(ads));
    } catch (e) {
        return [];
    }
}

export async function handleCreateWhatsAppAd(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    const { adAccountId, facebookPageId, accessToken } = hasAccess;
    if (!adAccountId || !facebookPageId || !accessToken) {
        return { error: 'Project is missing Ad Account ID, Facebook Page ID, or Access Token. Please configure these in Project Settings > Marketing.' };
    }

    const campaignName = formData.get('campaignName') as string;
    const dailyBudget = Number(formData.get('dailyBudget')) * 100; // Convert to cents
    const adMessage = formData.get('adMessage') as string;
    const adPhoneNumberId = formData.get('adPhoneNumber') as string;

    if (!campaignName || isNaN(dailyBudget) || !adMessage || !adPhoneNumberId) {
        return { error: 'All fields are required to create an ad.' };
    }

    const { db } = await connectToDatabase();
    const phoneNumber = hasAccess.phoneNumbers.find(p => p.id === adPhoneNumberId);
    if (!phoneNumber) {
        return { error: 'Selected phone number not found in project.' };
    }
    const waId = phoneNumber.display_phone_number.replace(/\D/g, '');


    try {
        const apiVersion = 'v22.0';

        // Step 1: Create Campaign
        const campaignResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/campaigns`,
            {
                name: campaignName,
                objective: 'MESSAGES',
                status: 'PAUSED',
                special_ad_categories: [],
                access_token: accessToken,
            }
        );
        const campaignId = campaignResponse.data.id;
        if (!campaignId) throw new Error('Failed to create campaign, no ID returned.');

        // Step 2: Create Ad Set
        const adSetResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adsets`,
            {
                name: `${campaignName} Ad Set`,
                campaign_id: campaignId,
                daily_budget: dailyBudget,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'REPLIES', // Use REPLIES for CTM
                promoted_object: {
                    page_id: facebookPageId,
                },
                targeting: {
                    geo_locations: { countries: ['IN'] },
                    age_min: 18,
                },
                status: 'PAUSED',
                access_token: accessToken,
            }
        );
        const adSetId = adSetResponse.data.id;
        if (!adSetId) throw new Error('Failed to create ad set, no ID returned.');

        // Step 3: Create Ad Creative
        const creativeResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adcreatives`,
            {
                name: `${campaignName} Ad Creative`,
                object_story_spec: {
                    page_id: facebookPageId,
                    link_data: {
                        message: adMessage,
                        link: `https://wa.me/${waId}`,
                        call_to_action: {
                            type: 'MESSAGE_PAGE',
                        },
                    },
                },
                access_token: accessToken,
            }
        );
        const creativeId = creativeResponse.data.id;
        if (!creativeId) throw new Error('Failed to create ad creative, no ID returned.');

        // Step 4: Create Ad
        const adResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/ads`,
            {
                name: `${campaignName} Ad`,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                status: 'PAUSED',
                access_token: accessToken,
            }
        );
        const adId = adResponse.data.id;
        if (!adId) throw new Error('Failed to create ad, no ID returned.');

        // Step 5: Save to DB
        const newAdCampaign: Omit<AdCampaign, '_id'> = {
            projectId: new ObjectId(projectId),
            name: campaignName,
            status: 'PAUSED',
            dailyBudget: dailyBudget / 100, // Store in currency units
            metaCampaignId: campaignId,
            metaAdSetId: adSetId,
            metaAdCreativeId: creativeId,
            metaAdId: adId,
            createdAt: new Date(),
        };
        await db.collection('ad_campaigns').insertOne(newAdCampaign as any);

        revalidatePath('/dashboard/whatsapp-ads');
        return { message: `Ad campaign "${campaignName}" created successfully! It is currently paused.` };

    } catch (e: any) {
        console.error('Failed to create WhatsApp Ad:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred during ad creation.' };
    }
}

// --- TEMPLATE LIBRARY ACTIONS ---

export async function getLibraryTemplates(): Promise<LibraryTemplate[]> {
    try {
        const { db } = await connectToDatabase();
        const customTemplates = await db.collection<LibraryTemplate>('library_templates').find({}).sort({ name: 1 }).toArray();
        const allTemplates = [...premadeTemplates, ...customTemplates];
        return JSON.parse(JSON.stringify(allTemplates));
    } catch (e) {
        console.error("Failed to fetch library templates:", e);
        return premadeTemplates; // Fallback to static templates on error
    }
}

export async function saveLibraryTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    try {
        const templateData: LibraryTemplate = {
            name: formData.get('name') as string,
            category: formData.get('category') as Template['category'],
            language: formData.get('language') as string,
            body: formData.get('body') as string,
            components: JSON.parse(formData.get('components') as string),
            isCustom: true,
            createdAt: new Date(),
        };

        if (!templateData.name || !templateData.category || !templateData.language || !templateData.body) {
            return { error: 'Name, category, language, and body are required.' };
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
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection('template_categories').find({}).sort({ name: 1 }).toArray()));
    } catch (e) {
        console.error("Failed to fetch template categories:", e);
        return [];
    }
}

export async function saveTemplateCategory(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
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
    if (!ObjectId.isValid(id)) return { error: 'Invalid category ID.' };
    try {
        const { db } = await connectToDatabase();
        // Potential improvement: Check if any library templates use this category before deleting.
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
