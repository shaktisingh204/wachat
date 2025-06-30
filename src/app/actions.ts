

'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template, AutoReplySettings, Flow, FlowNode, FlowEdge, OptInOutSettings, UserAttribute, Agent } from '@/app/dashboard/page';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';
import { translateText } from '@/ai/flows/translate-text';
import { processSingleWebhook } from '@/lib/webhook-processor';
import { processBroadcastJob } from '@/lib/cron-scheduler';
import { intelligentTranslate } from '@/ai/flows/intelligent-translate-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, comparePassword, createSessionToken, verifySessionToken } from '@/lib/auth';

// --- Plan Management Types ---
export type PlanFeaturePermissions = {
    campaigns: boolean;
    liveChat: boolean;
    contacts: boolean;
    templates: boolean;
    flowBuilder: boolean;
    apiAccess: boolean;
};

export type PlanMessageCosts = {
    marketing: number;
    utility: number;
    authentication: number;
};

export type Plan = {
    _id: ObjectId;
    name: string;
    price: number;
    isPublic: boolean;
    isDefault: boolean;
    projectLimit: number;
    agentLimit: number;
    attributeLimit: number;
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
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: any[];
    example?: {
        header_handle?: string[];
        header_text?: string[];
        body_text?: string[][];
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
    templateId: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed' | 'Cancelled';
    createdAt: Date;
    contactCount: number;
    fileName: string;
    components: any[];
    language: string;
    headerImageUrl?: string;
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
    };
    isOptedOut?: boolean;
    hasReceivedWelcome?: boolean;
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
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'interactive';
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
export type { Project, Template, PhoneNumber, AutoReplySettings, Flow, FlowNode, FlowEdge, OptInOutSettings, UserAttribute, Agent };

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
        return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
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
            console.error("Project not found for getProjectById for ID:", projectId);
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

export async function getProjectForBroadcast(projectId: string): Promise<{ _id: WithId<Project>['_id'], name: string, phoneNumbers: PhoneNumber[], templates: Template[] } | null> {
    const projectData = await getProjectById(projectId);
    if (!projectData) return null;

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        const [project, templates] = await Promise.all([
             db.collection('projects').findOne(
                { _id: projectObjectId },
                { projection: { name: 1, 'phoneNumbers.id': 1, 'phoneNumbers.display_phone_number': 1 } }
            ),
             db.collection('templates').find({ projectId: projectObjectId }).toArray()
        ]);


        if (!project) {
            console.error("Project not found for ID:", projectId);
            return null;
        }
        
        return JSON.parse(JSON.stringify({ ...project, templates }));
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

    const templateId = formData.get('templateId') as string;
    const contactFile = formData.get('csvFile') as File;

    if (!templateId) return { error: 'Please select a message template.' };
    if (!ObjectId.isValid(templateId)) {
        return { error: 'Invalid Template ID.' };
    }
    if (!contactFile || contactFile.size === 0) return { error: 'Please upload a contact file.' };

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
    
    const broadcastJobData: Omit<WithId<BroadcastJob>, '_id'> = {
        projectId: new ObjectId(projectId),
        templateId: new ObjectId(templateId),
        templateName: template.name,
        phoneNumberId,
        accessToken,
        status: 'QUEUED',
        createdAt: new Date(),
        contactCount: 0, // Will be updated after processing the file
        fileName: contactFile.name,
        components: template.components,
        language: template.language,
        headerImageUrl: finalHeaderImageUrl,
    };

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
        const fields = 'verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput';
        
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
            return { message: 'Carousel template saved successfully.' };
        }

        // --- Existing Logic for Standard Templates ---
        const appId = project.appId || process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId) {
            return { error: 'App ID is not configured for this project, and no fallback is set in environment variables. Please set NEXT_PUBLIC_META_APP_ID in the .env file or re-configure the project.' };
        }
        
        const name = cleanText(formData.get('templateName') as string);
        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const bodyText = cleanText(formData.get('body') as string);
        const language = formData.get('language') as string;
        const headerFormat = formData.get('headerFormat') as string;
        const headerText = cleanText(formData.get('headerText') as string);
        const headerSampleFile = formData.get('headerSampleFile') as File;
        const headerSampleUrl = (formData.get('headerSampleUrl') as string || '').trim();
        const footerText = cleanText(formData.get('footer') as string);
        const buttonsJson = formData.get('buttons') as string;
        
        const buttons = (buttonsJson ? JSON.parse(buttonsJson) : []).map((button: any) => ({
            ...button,
            text: cleanText(button.text),
            url: (button.url || '').trim(),
            phone_number: (button.phone_number || '').trim(),
            example: Array.isArray(button.example) ? button.example.map((ex: string) => (ex || '').trim()) : button.example,
        }));
    
        if (!name || !category || !bodyText || !language) {
            return { error: 'Name, Language, Category, and Body are required.' };
        }

        const { wabaId, accessToken } = project;

        let uploadedMediaHandle: string | null = null;
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
            if (!headerSampleUrl && (!headerSampleFile || headerSampleFile.size === 0)) {
                return { error: 'A header sample media URL or file upload is required for this header type.' };
            }

            try {
                let mediaData: Buffer;
                let fileType: string;
                let fileName: string;
                let fileLength: number;

                if (headerSampleFile && headerSampleFile.size > 0) {
                    mediaData = Buffer.from(await headerSampleFile.arrayBuffer());
                    fileType = headerSampleFile.type;
                    fileName = headerSampleFile.name;
                    fileLength = headerSampleFile.size;
                } else {
                    const mediaResponse = await fetch(headerSampleUrl);
                    if (!mediaResponse.ok) {
                        throw new Error(`Failed to download media from URL: ${mediaResponse.statusText}`);
                    }
                    const mediaArrayBuffer = await mediaResponse.arrayBuffer();
                    mediaData = Buffer.from(mediaArrayBuffer);
                    fileType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
                    fileName = headerSampleUrl.split('/').pop()?.split('?')[0] || 'sample';
                    fileLength = mediaData.length;
                }

                // Step 1: Start an upload session
                const sessionUrl = new URL(`https://graph.facebook.com/v22.0/${appId}/uploads`);
                sessionUrl.searchParams.append('file_name', fileName);
                sessionUrl.searchParams.append('file_length', fileLength.toString());
                sessionUrl.searchParams.append('file_type', fileType);
                sessionUrl.searchParams.append('access_token', accessToken);
                
                let sessionResponse;
                let sessionResponseData;

                try {
                    sessionResponse = await fetch(sessionUrl.toString(), { method: 'POST' });
                    sessionResponseData = await sessionResponse.json();
                } catch (e: any) {
                    throw new Error(`Failed to start upload session: ${e.message}`);
                }

                debugInfo += `--- STEP 1: START UPLOAD SESSION ---\n`;
                debugInfo += `URL: ${sessionUrl.toString().replace(accessToken, '<TOKEN>')}\n`;
                debugInfo += `Response Status: ${sessionResponse.status}\n`;
                debugInfo += `Response Body: ${JSON.stringify(sessionResponseData, null, 2)}\n\n`;

                if (!sessionResponse.ok || !sessionResponseData.id) {
                    const errorMessage = sessionResponseData?.error?.message || 'Failed to get upload session ID.';
                    throw new Error(`Failed to start upload session: ${errorMessage}`);
                }
                const uploadSessionId = sessionResponseData.id;

                // Step 2: Upload the file
                const uploadUrl = `https://graph.facebook.com/v22.0/${uploadSessionId}`;
                let uploadResponse;
                let uploadResponseData;

                try {
                    uploadResponse = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `OAuth ${accessToken}`,
                            'file_offset': '0',
                        },
                        body: mediaData,
                    });
                    uploadResponseData = await uploadResponse.json();
                } catch (e: any) {
                    throw new Error(`Failed to upload file: ${e.message}`);
                }
                
                debugInfo += `--- STEP 2: UPLOAD FILE ---\n`;
                debugInfo += `URL: ${uploadUrl}\n`;
                debugInfo += `Response Status: ${uploadResponse.status}\n`;
                debugInfo += `Response Body: ${JSON.stringify(uploadResponseData, null, 2)}\n\n`;

                if (!uploadResponse.ok || !uploadResponseData.h) {
                    const errorMessage = uploadResponseData?.error?.message || 'Failed to get file handle.';
                    throw new Error(`Failed to upload file: ${errorMessage}`);
                }
                
                uploadedMediaHandle = uploadResponseData.h;

            } catch (uploadError: any) {
                 const errorMessage = getErrorMessage(uploadError);
                 return { error: `Failed to prepare media for template: ${errorMessage}`, debugInfo };
            }
        }
    
        const components: any[] = [];
    
        if (headerFormat !== 'NONE') {
            const headerComponent: any = { type: 'HEADER', format: headerFormat };
            if (headerFormat === 'TEXT') {
                if (!headerText) return { error: 'Header text is required for TEXT header format.' };
                headerComponent.text = headerText;
                const headerVarMatches = headerText.match(/{{\s*(\d+)\s*}}/g);
                if (headerVarMatches) {
                    const exampleParams = headerVarMatches.map((_, i) => `example_header_var_${i + 1}`);
                    headerComponent.example = { header_text: exampleParams };
                }
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
                if (uploadedMediaHandle) {
                    headerComponent.example = { header_handle: [uploadedMediaHandle] };
                }
            }
            components.push(headerComponent);
        }

        const bodyComponent: any = { type: 'BODY', text: bodyText };
        const bodyVarMatches = bodyText.match(/{{\s*(\d+)\s*}}/g);
        if (bodyVarMatches) {
            const exampleParams = bodyVarMatches.map((_, i) => `example_body_var_${i + 1}`);
            bodyComponent.example = { body_text: [exampleParams] };
        }
        components.push(bodyComponent);

        if (footerText) {
            components.push({ type: 'FOOTER', text: footerText });
        }

        if (buttons.length > 0) {
            const formattedButtons = buttons.map((button: any) => {
                const newButton: any = {
                    type: button.type,
                    text: button.text,
                };
                if (button.type === 'URL') {
                    if (!button.url) {
                        throw new Error('URL is required for URL buttons.');
                    }
                    newButton.url = button.url;
                    if (button.example && button.example[0]) {
                        newButton.example = [button.example[0]];
                    }
                }
                if (button.type === 'PHONE_NUMBER') {
                    if (!button.phone_number) {
                        throw new Error('Phone number is required for phone number buttons.');
                    }
                    newButton.phone_number = button.phone_number;
                }
                return newButton;
            });
            components.push({
                type: 'BUTTONS',
                buttons: formattedButtons,
            });
        }
    
        const payload = {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language,
            category,
            components,
            allow_category_change: true,
        };
        
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

        debugInfo += `--- STEP 3: CREATE TEMPLATE ---\n`;
        debugInfo += `URL: https://graph.facebook.com/v22.0/${wabaId}/message_templates\n`;
        debugInfo += `Payload: ${payloadString}\n`;
        debugInfo += `Response Status: ${response.status}\n`;
        debugInfo += `Response Body: ${JSON.stringify(responseData, null, 2)}\n`;
    
        if (!response.ok) {
            console.error('Meta Template Creation Error:', responseData?.error || responseText);
            const errorMessage = responseData?.error?.error_user_title || responseData?.error?.message || 'Unknown error creating template.';
            return { error: `API Error: ${errorMessage}. Status: ${response.status} ${response.statusText}`, payload: payloadString, debugInfo };
        }

        const newMetaTemplateId = responseData?.id;
        if (!newMetaTemplateId) {
            return { error: 'Template created on Meta, but no ID was returned. Please sync manually.', payload: payloadString, debugInfo };
        }

        const templateToInsert: any = {
            name: payload.name,
            category,
            language,
            status: responseData?.status || 'PENDING',
            qualityScore: 'UNKNOWN',
            body: bodyText,
            projectId: new ObjectId(projectId),
            metaId: newMetaTemplateId,
            components, 
            ...(headerSampleUrl && { headerSampleUrl })
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
                             reviewStatus: projectDoc.reviewStatus,
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

export type WebhookQueueItem = {
    _id: any;
    payload: any;
    logId?: ObjectId;
    projectId?: ObjectId;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    processedAt?: Date;
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
        
        // Don't process directly, add it to the queue for the cron job to handle
        await db.collection('webhook_queue').insertOne({
            payload: log.payload,
            logId: log._id,
            projectId: log.projectId,
            status: 'PENDING',
            createdAt: new Date(),
        });

        return { message: `Successfully queued event for re-processing: ${log.payload?.entry?.[0]?.changes?.[0]?.field || 'unknown'}` };
    } catch (e: any) {
        console.error("Failed to re-queue webhook:", e);
        return { error: e.message || "An unexpected error occurred during re-queueing." };
    }
}

export async function handleRequeueAllWebhookLogs(): Promise<{ message?: string; error?: string; count?: number }> {
    try {
        const { db } = await connectToDatabase();
        const logsCursor = db.collection('webhook_logs').find({}, { projection: { payload: 1, projectId: 1 } });

        let totalQueuedCount = 0;
        const batchSize = 1000;
        let batch: any[] = [];

        for await (const log of logsCursor) {
            batch.push({
                payload: log.payload,
                logId: log._id,
                projectId: log.projectId,
                status: 'PENDING' as const,
                createdAt: new Date(),
            });

            if (batch.length >= batchSize) {
                const result = await db.collection('webhook_queue').insertMany(batch, { ordered: false }).catch(e => {
                    if (e.code === 11000) return { insertedCount: 0 }; // Ignore duplicates
                    throw e;
                });
                totalQueuedCount += result.insertedCount;
                batch = [];
            }
        }
        
        if (batch.length > 0) {
            const result = await db.collection('webhook_queue').insertMany(batch, { ordered: false }).catch(e => {
                if (e.code === 11000) return { insertedCount: 0 }; // Ignore duplicates
                throw e;
            });
            totalQueuedCount += result.insertedCount;
        }

        if (totalQueuedCount === 0) {
            return { message: 'No new logs found to requeue.' };
        }

        return { message: `Successfully queued ${totalQueuedCount} events for re-processing. The cron job will handle them shortly.`, count: totalQueuedCount };
    } catch (e: any) {
        console.error("Failed to requeue all webhook logs:", e);
        return { error: e.message || "An unexpected error occurred during requeueing." };
    }
}

type AutoReplyState = {
    message?: string;
    error?: string;
};

export async function handleUpdateAutoReplySettings(
    prevState: AutoReplyState,
    formData: FormData
): Promise<AutoReplyState> {
    const projectId = formData.get('projectId') as string;
    const replyType = formData.get('replyType') as 'welcomeMessage' | 'general' | 'inactiveHours' | 'aiAssistant';

    if (!replyType) {
        return { error: 'Invalid reply type specified.' };
    }

    try {
        const project = await getProjectById(projectId);
        if (!project) {
            return { error: 'Project not found or you do not have access.' };
        }
        
        const { db } = await connectToDatabase();
        
        const autoReplySettings = project.autoReplySettings || {};

        switch (replyType) {
            case 'welcomeMessage':
                autoReplySettings.welcomeMessage = {
                    enabled: formData.get('enabled') === 'on',
                    message: formData.get('message') as string,
                };
                break;
            case 'general':
                autoReplySettings.general = {
                    enabled: formData.get('enabled') === 'on',
                    message: formData.get('message') as string,
                };
                break;
            case 'inactiveHours':
                const days: number[] = [];
                for (let i = 0; i < 7; i++) {
                    if (formData.get(`day_${i}`) === 'on') {
                        days.push(i);
                    }
                }
                autoReplySettings.inactiveHours = {
                    enabled: formData.get('enabled') === 'on',
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    timezone: formData.get('timezone') as string,
                    days: days,
                    message: formData.get('message') as string,
                };
                break;
            case 'aiAssistant':
                 autoReplySettings.aiAssistant = {
                    enabled: formData.get('enabled') === 'on',
                    context: formData.get('context') as string,
                    autoTranslate: formData.get('autoTranslate') === 'on',
                };
                break;
            default:
                return { error: 'Unknown reply type.' };
        }

        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { autoReplySettings } }
        );

        if (result.matchedCount === 0) {
             return { error: 'Project not found during update.' };
        }

        revalidatePath('/dashboard/settings');
        return { message: 'Auto-reply settings saved successfully!' };

    } catch (e: any) {
        console.error('Failed to update auto-reply settings:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleUpdateMasterSwitch(projectId: string, enabled: boolean): Promise<{ message?: string; error?: string; }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        
        const autoReplySettings = project.autoReplySettings || {};
        autoReplySettings.masterEnabled = enabled;

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { autoReplySettings } }
        );

        revalidatePath('/dashboard/settings');
        return { message: 'Auto-reply settings updated.' };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}


// --- Flow Builder Actions ---

export async function getFlowsForProject(projectId: string): Promise<WithId<Flow>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection('flows')
            .find({ projectId: new ObjectId(projectId) })
            .project({ name: 1, updatedAt: 1, triggerKeywords: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e: any) {
        console.error("Failed to fetch flows:", e);
        return [];
    }
}

export async function getFlowById(flowId: string): Promise<WithId<Flow> | null> {
    if (!ObjectId.isValid(flowId)) return null;

    try {
        const { db } = await connectToDatabase();
        const flow = await db.collection('flows').findOne({ _id: new ObjectId(flowId) });
        if (!flow) return null;

        const hasAccess = await getProjectById(flow.projectId.toString());
        if (!hasAccess) return null;
        
        return JSON.parse(JSON.stringify(flow));
    } catch (e: any) {
        console.error("Failed to fetch flow:", e);
        return null;
    }
}

type SaveFlowResult = {
  flowId?: string;
  message?: string;
  error?: string;
};

export async function saveFlow(flowData: {
  flowId?: string;
  projectId: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  triggerKeywords: string[];
}): Promise<SaveFlowResult> {
  const { flowId, projectId, name, nodes, edges, triggerKeywords } = flowData;

  if (!name || !nodes) {
    return { error: "Name and nodes are required." };
  }
  
  const hasAccess = await getProjectById(projectId);
  if (!hasAccess) return { error: "Project not found or you do not have access." };

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const flowDocument = {
      projectId: new ObjectId(projectId),
      name,
      nodes,
      edges,
      triggerKeywords,
      updatedAt: now,
    };

    let savedFlowId: ObjectId;

    if (flowId && ObjectId.isValid(flowId)) {
      const result = await db.collection('flows').updateOne(
        { _id: new ObjectId(flowId), projectId: new ObjectId(projectId) },
        { $set: flowDocument }
      );
       if (result.matchedCount === 0) {
        return { error: "Flow not found for update." };
      }
      savedFlowId = new ObjectId(flowId);
    } else {
      const result = await db.collection('flows').insertOne({
        ...flowDocument,
        createdAt: now,
      });
      savedFlowId = result.insertedId;
    }

    revalidatePath('/dashboard/flow-builder');
    return { message: `Flow "${name}" saved successfully.`, flowId: savedFlowId.toString() };
  } catch (e: any) {
    console.error("Failed to save flow:", e);
    return { error: e.message || "An unexpected error occurred while saving the flow." };
  }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string; }> {
    if (!ObjectId.isValid(flowId)) {
        return { error: 'Invalid Flow ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const flow = await getFlowById(flowId);
        if (!flow) return { error: 'Flow not found or you do not have access.' };

        const result = await db.collection('flows').deleteOne({ _id: new ObjectId(flowId) });
        if (result.deletedCount === 0) {
            return { error: 'Flow not found.' };
        }
        revalidatePath('/dashboard/flow-builder');
        return { message: 'Flow deleted successfully.' };
    } catch (e: any) {
         console.error("Failed to delete flow:", e);
        return { error: e.message || "An unexpected error occurred while deleting the flow." };
    }
}

// --- Canned Messages Actions ---
export async function getCannedMessages(projectId: string): Promise<WithId<CannedMessage>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const messages = await db.collection('canned_messages')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ isFavourite: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(messages));
    } catch (e: any) {
        console.error("Failed to fetch canned messages:", e);
        return [];
    }
}

type SaveCannedMessageResult = {
  message?: string;
  error?: string;
};

export async function saveCannedMessageAction(prevState: any, formData: FormData): Promise<SaveCannedMessageResult> {
    const session = await getSession();
    if (!session?.user) return { error: "User not authenticated." };

    const cannedMessageId = formData.get('_id') as string | null;
    const projectId = formData.get('projectId') as string;
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    const data: Partial<CannedMessage> = {
        name: formData.get('name') as string,
        type: formData.get('type') as CannedMessage['type'],
        isFavourite: formData.get('isFavourite') === 'on',
        content: {
            text: formData.get('text') as string,
            mediaUrl: formData.get('mediaUrl') as string,
            caption: formData.get('caption') as string,
            fileName: formData.get('fileName') as string,
        }
    };
    
    if (!data.name || !data.type) {
        return { error: 'Name and Type are required.' };
    }
    
    // Clean up content based on type
    if (data.type === 'text') {
        if (!data.content?.text) return { error: 'Text content is required for text messages.' };
        data.content = { text: data.content.text };
    } else {
        if (!data.content?.mediaUrl) return { error: 'Media URL is required for media messages.' };
        data.content = { 
            mediaUrl: data.content.mediaUrl, 
            caption: data.content.caption, 
            fileName: data.content.fileName 
        };
    }

    try {
        const { db } = await connectToDatabase();
        if (cannedMessageId && ObjectId.isValid(cannedMessageId)) {
            await db.collection('canned_messages').updateOne(
                { _id: new ObjectId(cannedMessageId), projectId: new ObjectId(projectId) },
                { $set: data }
            );
        } else {
            await db.collection('canned_messages').insertOne({
                ...data,
                projectId: new ObjectId(projectId),
                createdAt: new Date(),
                createdBy: session.user.name,
            } as any);
        }
        revalidatePath('/dashboard/canned-messages');
        return { message: 'Canned message saved successfully.' };
    } catch (e: any) {
        console.error("Failed to save canned message:", e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deleteCannedMessage(cannedMessageId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(cannedMessageId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        
        const cannedMessage = await db.collection('canned_messages').findOne({ _id: new ObjectId(cannedMessageId) });
        if (!cannedMessage) return { success: false, error: 'Canned message not found.' };

        const hasAccess = await getProjectById(cannedMessage.projectId.toString());
        if (!hasAccess) return { success: false, error: 'Access denied.' };

        await db.collection('canned_messages').deleteOne({ _id: new ObjectId(cannedMessageId) });
        
        revalidatePath('/dashboard/canned-messages');
        return { success: true };
    } catch (e: any) {
        console.error("Failed to delete canned message:", e);
        return { success: false, error: e.message || 'An unexpected error occurred.' };
    }
}


// --- AGGREGATOR ACTIONS FOR OPTIMIZED LOADING ---

export async function getConversation(contactId: string): Promise<AnyMessage[]> {
    if (!ObjectId.isValid(contactId)) return [];

    try {
        const { db } = await connectToDatabase();
        const contactObjectId = new ObjectId(contactId);

        const contact = await db.collection('contacts').findOne({ _id: contactObjectId });
        if (!contact) return [];
        const hasAccess = await getProjectById(contact.projectId.toString());
        if (!hasAccess) return [];

        const incoming = await db.collection('incoming_messages').find({ contactId: contactObjectId }).toArray();
        const outgoing = await db.collection('outgoing_messages').find({ contactId: contactObjectId }).toArray();

        const allMessages = [...incoming, ...outgoing];
        allMessages.sort((a, b) => new Date(a.messageTimestamp).getTime() - new Date(b.messageTimestamp).getTime());

        return JSON.parse(JSON.stringify(allMessages));
    } catch (e) {
        console.error("Failed to get conversation:", e);
        return [];
    }
}


export async function getInitialChatData(
    projectId: string,
    initialPhoneId?: string | null,
    initialContactId?: string | null
): Promise<{
    project: WithId<Project> | null;
    contacts: WithId<Contact>[];
    totalContacts: number;
    selectedContact: WithId<Contact> | null;
    conversation: AnyMessage[];
    selectedPhoneNumberId: string;
}> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { project: null, contacts: [], totalContacts: 0, selectedContact: null, conversation: [], selectedPhoneNumberId: '' };
    }

    const phoneIdToUse = initialPhoneId || project.phoneNumbers?.[0]?.id || '';
    if (!phoneIdToUse) {
        return { project, contacts: [], totalContacts: 0, selectedContact: null, conversation: [], selectedPhoneNumberId: '' };
    }
    
    const { contacts, total } = await getContactsForProject(projectId, phoneIdToUse, 1, 30);
    
    let conversation: AnyMessage[] = [];
    let selectedContact: WithId<Contact> | null = null;
    
    if (initialContactId) {
        const contactToSelect = contacts.find(c => c._id.toString() === initialContactId);
        if (contactToSelect) {
            selectedContact = contactToSelect;
            conversation = await getConversation(initialContactId);
            if (contactToSelect.unreadCount && contactToSelect.unreadCount > 0) {
                await markConversationAsRead(initialContactId);
                // The contact in the list will still have the old unreadCount, we should update it
                const updatedContact = { ...contactToSelect, unreadCount: 0 };
                const contactIndex = contacts.findIndex(c => c._id.toString() === initialContactId);
                if (contactIndex > -1) {
                    contacts[contactIndex] = updatedContact;
                }
            }
        }
    }

    return {
        project,
        contacts,
        totalContacts: total,
        selectedContact,
        conversation,
        selectedPhoneNumberId: phoneIdToUse
    };
}

export async function getContactsForProject(projectId: string, phoneNumberId: string, page: number = 1, limit: number = 30, query: string = ''): Promise<{ contacts: WithId<Contact>[], total: number }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { contacts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Contact> = {
            projectId: new ObjectId(projectId),
            phoneNumberId,
        };

        if(query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
             db.collection<Contact>('contacts')
                .find(filter)
                .sort({ lastMessageTimestamp: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('contacts').countDocuments(filter)
        ]);

        return { contacts: JSON.parse(JSON.stringify(contacts)), total };
    } catch (e: any) {
        console.error("Failed to fetch contacts for project:", e);
        return { contacts: [], total: 0 };
    }
}

export async function getContactsPageData(
    projectId: string,
    phoneId?: string | null,
    page: number = 1,
    query: string = ''
): Promise<{
    project: WithId<Project> | null;
    contacts: WithId<Contact>[];
    total: number;
    selectedPhoneNumberId: string;
}> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { project: null, contacts: [], total: 0, selectedPhoneNumberId: '' };
    }
    
    const phoneIdToUse = phoneId || project.phoneNumbers?.[0]?.id || '';
    if (!phoneIdToUse) {
        return { project, contacts: [], total: 0, selectedPhoneNumberId: phoneIdToUse };
    }

    const { contacts, total } = await getContactsForProject(projectId, phoneIdToUse, page, 20, query);

    return { project, contacts, total, selectedPhoneNumberId: phoneIdToUse };
}

export async function getFlowBuilderPageData(
    projectId: string
): Promise<{
    flows: WithId<Flow>[];
    initialFlow: WithId<Flow> | null;
}> {
    const flows = await getFlowsForProject(projectId);
    let initialFlow: WithId<Flow> | null = null;

    if (flows.length > 0) {
        // Fetch the full data for the first flow
        initialFlow = await getFlowById(flows[0]._id.toString());
    }

    return { flows, initialFlow };
}


// --- USER AUTHENTICATION ACTIONS ---
type AuthState = {
  message?: string | null;
  error?: string | null;
};

export async function handleLogin(prevState: AuthState, formData: FormData): Promise<AuthState> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ email });

        if (!user || !user.password) {
            return { error: 'Invalid email or password.' };
        }

        const isValidPassword = await comparePassword(password, user.password);

        if (!isValidPassword) {
            return { error: 'Invalid email or password.' };
        }

        const cookieStore = await cookies();
        const token = createSessionToken({ userId: user._id.toString(), email: user.email });

        cookieStore.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

    } catch (e: any) {
        console.error("Login failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
    
    redirect('/dashboard');
}

export async function handleSignup(prevState: AuthState, formData: FormData): Promise<AuthState> {
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
            return { error: 'A user with this email already exists.' };
        }

        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });
        if (!defaultPlan) {
            console.error("CRITICAL: No default plan found during signup.");
            return { error: 'Could not create account due to a server configuration issue. Please contact support.' };
        }

        const hashedPassword = await hashPassword(password);

        const newUser: Omit<User, '_id'> = {
            name,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            planId: defaultPlan._id,
        };

        const result = await db.collection('users').insertOne(newUser);
        const userId = result.insertedId;

        const cookieStore = await cookies();
        const token = createSessionToken({ userId: userId.toString(), email });

        cookieStore.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

    } catch (e: any) {
        console.error("Signup failed:", e);
        return { error: 'An unexpected error occurred during signup.' };
    }

    redirect('/dashboard');
}

export async function getSession(): Promise<{ user: (Omit<User, 'password' | 'planId'> & { plan: WithId<Plan> | null }) } | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    try {
        const session = verifySessionToken(sessionCookie);
        if (!session) return null;

        const { db } = await connectToDatabase();
        
        const aggregationResult = await db.collection<User>('users').aggregate([
            { $match: { _id: new ObjectId(session.userId) } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planDetails'
                }
            },
            {
                $unwind: {
                    path: '$planDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    createdAt: 1,
                    plan: '$planDetails'
                }
            }
        ]).toArray();
        
        if (aggregationResult.length === 0) return null;
        
        const userWithPlan: any = aggregationResult[0];

        const user = {
            _id: userWithPlan._id,
            name: userWithPlan.name,
            email: userWithPlan.email,
            createdAt: userWithPlan.createdAt,
            plan: userWithPlan.plan || null
        };
        
        return { user: JSON.parse(JSON.stringify(user)) };

    } catch (e) {
        console.error("Failed to fetch session user from DB:", e);
        return null;
    }
}


export async function handleLogout() {
  const cookieStore = await cookies();
  cookieStore.set('session', '', { expires: new Date(0), path: '/' });
  redirect('/login');
}

export async function handleFacebookSetup(shortLivedToken: string, wabaIds: string[]): Promise<{ success?: boolean; error?: string; count?: number }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'User not authenticated.' };
    }
    
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret || appSecret === 'YOUR_META_APP_SECRET') {
        return { error: 'Server configuration error: META_APP_SECRET is not configured in the .env file. Please add it from your Meta Developer Dashboard.' };
    }

    try {
        const tokenResponse = await axios.get(`https://graph.facebook.com/v20.0/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortLivedToken,
            }
        });

        const longLivedToken = tokenResponse.data.access_token;
        if (!longLivedToken) {
            return { error: 'Failed to exchange for a long-lived access token.' };
        }
        
        const { db } = await connectToDatabase();
        let connectedCount = 0;

        for (const wabaId of wabaIds) {
            const existingClaim = await db.collection('projects').findOne({ wabaId, userId: { $ne: new ObjectId(session.user._id) } });
            if (existingClaim) {
                console.warn(`WABA ${wabaId} is already linked to another user. Skipping.`);
                continue;
            }
            
            const wabaDetailsResponse = await axios.get(`https://graph.facebook.com/v20.0/${wabaId}`, {
                params: { fields: 'name', access_token: longLivedToken }
            });
            const wabaName = wabaDetailsResponse.data.name;

            const phoneNumbersResponse = await axios.get(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`, {
                params: { 
                    fields: 'verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput',
                    access_token: longLivedToken 
                }
            });
            const phoneNumbers: PhoneNumber[] = phoneNumbersResponse.data.data ? phoneNumbersResponse.data.data.map((num: any) => ({
                id: num.id,
                display_phone_number: num.display_phone_number,
                verified_name: num.verified_name,
                code_verification_status: num.code_verification_status,
                quality_rating: num.quality_rating,
                platform_type: num.platform_type,
                throughput: num.throughput,
            })) : [];

            const projectUpdateResult = await db.collection('projects').updateOne(
                { wabaId, userId: new ObjectId(session.user._id) },
                {
                    $set: {
                        name: wabaName,
                        accessToken: longLivedToken,
                        phoneNumbers: phoneNumbers,
                        appId: appId, // Save the App ID
                    },
                    $setOnInsert: {
                        userId: new ObjectId(session.user._id),
                        wabaId: wabaId,
                        createdAt: new Date(),
                        messagesPerSecond: 1000,
                        reviewStatus: 'UNKNOWN',
                    }
                },
                { upsert: true }
            );

            if (projectUpdateResult.upsertedId) {
                const newProjectId = projectUpdateResult.upsertedId;
                 if (typeof window !== 'undefined') {
                    localStorage.setItem('activeProjectId', newProjectId.toString());
                    localStorage.setItem('activeProjectName', wabaName);
                }
            }
            
            connectedCount++;
        }
        
        revalidatePath('/dashboard');
        return { success: true, count: connectedCount };

    } catch (e: any) {
        console.error('Facebook Setup Failed:', e);
        return { error: getErrorMessage(e) };
    }
}

type UpdateProfileState = {
  message?: string | null;
  error?: string | null;
};

export async function handleUpdateUserProfile(prevState: UpdateProfileState, formData: FormData): Promise<UpdateProfileState> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to update your profile.' };
    }

    const name = formData.get('name') as string;
    if (!name || name.trim().length < 2) {
        return { error: 'Name must be at least 2 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { name: name.trim() } }
        );

        if (result.matchedCount === 0) {
            return { error: 'User not found.' };
        }
        
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard', 'layout'); // Revalidate layout to update name in header

        return { message: 'Profile updated successfully!' };
    } catch (e: any) {
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleChangePassword(prevState: UpdateProfileState, formData: FormData): Promise<UpdateProfileState> {
     const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to change your password.' };
    }

    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: 'All fields are required.' };
    }
    if (newPassword !== confirmPassword) {
        return { error: 'New passwords do not match.' };
    }
    if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters long.' };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });

        if (!user || !user.password) {
            return { error: 'User not found or password not set.' };
        }

        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) {
            return { error: 'Incorrect current password.' };
        }

        const hashedNewPassword = await hashPassword(newPassword);

        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: hashedNewPassword } }
        );

        return { message: 'Password changed successfully!' };

    } catch (e: any) {
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleCreateProject(
    prevState: { message: string | null; error: string | null },
    formData: FormData
): Promise<{ message: string | null; error: string | null }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to create a project.' };
    }

    const wabaId = formData.get('wabaId') as string;
    const appId = formData.get('appId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!wabaId || !accessToken || !appId) {
        return { error: 'WhatsApp Business ID, App ID, and Access Token are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const existingClaim = await db.collection('projects').findOne({ wabaId, userId: { $ne: new ObjectId(session.user._id) } });
        if (existingClaim) {
            return { error: 'This WhatsApp Business Account is already linked to another user.' };
        }

        const apiVersion = 'v22.0';

        const wabaDetailsResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}?access_token=${accessToken}&fields=name`);
        const wabaDetails = await wabaDetailsResponse.json();

        if (wabaDetails.error) {
            return { error: `Failed to verify Business ID ${wabaId}: ${wabaDetails.error.message}` };
        }
        const wabaName = wabaDetails.name;
        
        const phoneNumbersResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`);
        const phoneNumbersData = await phoneNumbersResponse.json();
        
        if (phoneNumbersData.error) {
            return { error: `Failed to fetch phone numbers: ${phoneNumbersData.error.message}` };
        }
        
        const phoneNumbers: PhoneNumber[] = phoneNumbersData.data ? phoneNumbersData.data.map((num: any) => ({
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
        })) : [];

        if (phoneNumbers.length === 0) {
            return { error: 'No phone numbers found for this WhatsApp Business Account.' };
        }

        const projectDoc = {
            userId: new ObjectId(session.user._id),
            name: wabaName,
            wabaId: wabaId,
            appId: appId,
            accessToken: accessToken,
            phoneNumbers: phoneNumbers,
            messagesPerSecond: 1000,
            reviewStatus: 'UNKNOWN',
        };
        
        await db.collection('projects').updateOne(
            { wabaId: wabaId, userId: new ObjectId(session.user._id) },
            { $set: projectDoc, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );

        revalidatePath('/dashboard');
        return { message: `Project "${wabaName}" connected successfully!`, error: null };

    } catch (e: any) {
        console.error('Manual project creation failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleDeleteProject(
  prevState: { message?: string | null; error?: string | null; },
  formData: FormData
): Promise<{ message?: string | null; error?: string | null; }> {
    const projectId = formData.get('projectId') as string;

    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);

        const broadcastsToDelete = await db.collection('broadcasts').find({ projectId: projectObjectId }, { projection: { _id: 1 } }).toArray();
        const broadcastIdsToDelete = broadcastsToDelete.map(b => b._id);
        
        await Promise.all([
            db.collection('broadcast_contacts').deleteMany({ broadcastId: { $in: broadcastIdsToDelete } }),
            db.collection('broadcasts').deleteMany({ projectId: projectObjectId }),
            db.collection('templates').deleteMany({ projectId: projectObjectId }),
            db.collection('notifications').deleteMany({ projectId: projectObjectId }),
            db.collection('contacts').deleteMany({ projectId: projectObjectId }),
            db.collection('incoming_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('outgoing_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flows').deleteMany({ projectId: projectObjectId }),
        ]);

        await db.collection('projects').deleteOne({ _id: projectObjectId });

        revalidatePath('/admin/dashboard');

        return { message: 'Project and all associated data have been successfully deleted.' };
    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

type OptInOutState = {
    message?: string;
    error?: string;
};

export async function handleUpdateOptInOutSettings(
    prevState: OptInOutState,
    formData: FormData
): Promise<OptInOutState> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project) {
        return { error: 'Project not found or you do not have access.' };
    }

    const formatKeywords = (keywords: string | null): string[] => {
        if (!keywords) return [];
        return keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    };

    try {
        const settings: OptInOutSettings = {
            enabled: formData.get('enabled') === 'on',
            optOutKeywords: formatKeywords(formData.get('optOutKeywords') as string),
            optOutResponse: formData.get('optOutResponse') as string,
            optInKeywords: formatKeywords(formData.get('optInKeywords') as string),
            optInResponse: formData.get('optInResponse') as string,
        };
        
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { optInOutSettings: settings } }
        );

        if (result.matchedCount === 0) {
            return { error: 'Project not found during update.' };
        }

        revalidatePath('/dashboard/settings');
        return { message: 'Opt-in/Opt-out settings saved successfully!' };

    } catch (e: any) {
        console.error('Failed to update opt-in/out settings:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

type UserAttributesState = {
  message?: string;
  error?: string;
};

export async function handleSaveUserAttributes(
  prevState: UserAttributesState,
  formData: FormData
): Promise<UserAttributesState> {
  const projectId = formData.get('projectId') as string;
  const attributesString = formData.get('attributes') as string;

  const project = await getProjectById(projectId);
  if (!project) {
    return { error: 'Project not found or you do not have access.' };
  }

  const { db } = await connectToDatabase();
  const owner = await db.collection<User>('users').findOne({ _id: project.userId });
  if (!owner) return { error: "Project owner not found." };
  
  const plan = owner.planId ? await db.collection<Plan>('plans').findOne({ _id: owner.planId }) : null;
  if (!plan) {
    console.error(`User ${owner._id} has a planId ${owner.planId} which does not exist in the plans collection.`);
    return { error: `Attribute limit cannot be determined. Please contact support.` };
  }
  
  const limit = plan.attributeLimit;
  const planName = plan.name;

  try {
    const attributes: UserAttribute[] = JSON.parse(attributesString);

    if (attributes.some(attr => !attr.name)) {
        return { error: "Attribute name cannot be empty." };
    }
    
    if (attributes.length > limit) {
      return { error: `Your "${planName}" plan allows a maximum of ${limit} user attributes. Please upgrade to create more.` };
    }

    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { userAttributes: attributes } }
    );

    if (result.matchedCount === 0) {
        return { error: 'Project not found during update.' };
    }

    revalidatePath('/dashboard/settings');
    return { message: 'User attributes saved successfully!' };

  } catch (e: any) {
    console.error('Failed to save user attributes:', e);
    return { error: e.message || 'An unexpected error occurred.' };
  }
}

export async function handleUpdateContactVariables(
  contactId: string,
  variables: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(contactId)) {
    return { success: false, error: "Invalid contact ID." };
  }

  try {
    const { db } = await connectToDatabase();
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) {
      return { success: false, error: "Contact not found." };
    }

    // Security check: ensure the current user has access to this contact's project
    const hasAccess = await getProjectById(contact.projectId.toString());
    if (!hasAccess) {
      return { success: false, error: "Access denied." };
    }

    const result = await db.collection('contacts').updateOne(
      { _id: new ObjectId(contactId) },
      { $set: { variables } }
    );
    
    if (result.modifiedCount === 0) {
        // This could mean the variables were the same, so not necessarily an error.
        return { success: true };
    }
    
    revalidatePath('/dashboard/chat');
    revalidatePath('/dashboard/contacts');

    return { success: true };

  } catch (e: any) {
    console.error('Failed to update contact variables:', e);
    return { success: false, error: e.message || 'An unexpected error occurred.' };
  }
}

// --- PLAN MANAGEMENT ACTIONS ---

export async function getPlans(filter?: Filter<Plan>): Promise<WithId<Plan>[]> {
    try {
        const { db } = await connectToDatabase();
        const plans = await db.collection<Plan>('plans').find(filter || {}).sort({ price: 1 }).toArray();
        return JSON.parse(JSON.stringify(plans));
    } catch (error) {
        console.error('Failed to fetch plans:', error);
        return [];
    }
}

export async function getPlanById(planId: string): Promise<WithId<Plan> | null> {
    if (!ObjectId.isValid(planId)) return null;
    try {
        const { db } = await connectToDatabase();
        const plan = await db.collection<Plan>('plans').findOne({ _id: new ObjectId(planId) });
        return plan ? JSON.parse(JSON.stringify(plan)) : null;
    } catch (error) {
        console.error('Failed to fetch plan by ID:', error);
        return null;
    }
}

export async function savePlan(prevState: { message: string | null; error: string | null }, formData: FormData): Promise<{ message: string | null; error: string | null }> {
    const planId = formData.get('planId') as string;
    const isNew = planId === 'new';

    const featurePermissions: PlanFeaturePermissions = {
        campaigns: formData.get('campaigns') === 'on',
        liveChat: formData.get('liveChat') === 'on',
        contacts: formData.get('contacts') === 'on',
        templates: formData.get('templates') === 'on',
        flowBuilder: formData.get('flowBuilder') === 'on',
        apiAccess: formData.get('apiAccess') === 'on',
    };

    const messageCosts: PlanMessageCosts = {
        marketing: Number(formData.get('cost_marketing')),
        utility: Number(formData.get('cost_utility')),
        authentication: Number(formData.get('cost_authentication')),
    };

    const planData: Omit<Plan, '_id' | 'createdAt'> = {
        name: formData.get('name') as string,
        price: Number(formData.get('price')),
        messageCosts,
        isPublic: formData.get('isPublic') === 'on',
        isDefault: formData.get('isDefault') === 'on',
        projectLimit: Number(formData.get('projectLimit')),
        agentLimit: Number(formData.get('agentLimit')),
        attributeLimit: Number(formData.get('attributeLimit')),
        features: featurePermissions,
    };
    
    if (!planData.name || isNaN(planData.price)) {
        return { error: 'Plan name and a valid price are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        if (planData.isDefault) {
            await db.collection('plans').updateMany({ _id: { $ne: isNew ? new ObjectId() : new ObjectId(planId) } }, { $set: { isDefault: false } });
        }

        if (isNew) {
            await db.collection('plans').insertOne({ ...planData, createdAt: new Date() } as any);
        } else {
            await db.collection('plans').updateOne({ _id: new ObjectId(planId) }, { $set: planData });
        }

        revalidatePath('/admin/dashboard/plans');
        revalidatePath('/dashboard/billing');
        return { message: 'Plan saved successfully!' };
    } catch (e: any) {
        console.error('Failed to save plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deletePlan(prevState: { message: string | null; error: string | null }, formData: FormData): Promise<{ message: string | null; error: string | null }> {
    const planId = formData.get('planId') as string;
    if (!planId || !ObjectId.isValid(planId)) return { error: 'Invalid plan ID.' };
    
    try {
        const { db } = await connectToDatabase();
        const planToDelete = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
        if (planToDelete?.isDefault) {
            return { error: 'Cannot delete the default plan. Please set another plan as default first.' };
        }

        const userCount = await db.collection('users').countDocuments({ planId: new ObjectId(planId) });
        if (userCount > 0) {
            return { error: `Cannot delete plan as ${userCount} user(s) are currently subscribed to it.` };
        }

        await db.collection('plans').deleteOne({ _id: new ObjectId(planId) });
        
        revalidatePath('/admin/dashboard/plans');
        revalidatePath('/dashboard/billing');
        return { message: 'Plan deleted successfully.' };

    } catch (e: any) {
        console.error('Failed to delete plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}


// --- AGENT MANAGEMENT ACTIONS ---

type AgentManagementState = {
  message?: string;
  error?: string;
};

export async function handleInviteAgent(prevState: AgentManagementState, formData: FormData): Promise<AgentManagementState> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const projectId = formData.get('projectId') as string;
    const inviteeEmail = (formData.get('email') as string)?.toLowerCase();
    const role = formData.get('role') as string;

    if (!projectId || !inviteeEmail || !role) {
        return { error: 'All fields are required.' };
    }
    if (inviteeEmail === session.user.email) {
        return { error: 'You cannot invite yourself.' };
    }

    const { db } = await connectToDatabase();

    try {
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'You do not have permission to invite agents to this project.' };
        }

        const owner = await db.collection<User>('users').findOne({ _id: project.userId });
        if (!owner) return { error: "Project owner not found." };
        
        const plan = owner.planId ? await db.collection<Plan>('plans').findOne({ _id: owner.planId }) : null;
        if (!plan) {
            console.error(`User ${owner._id} has a planId ${owner.planId} which does not exist.`);
            return { error: `Agent limit cannot be determined. Please contact support.` };
        }

        const agentLimit = plan.agentLimit;
        const currentAgentCount = project.agents?.length || 0;
        
        if (currentAgentCount >= agentLimit) {
            return { error: `You have reached the agent limit for your "${plan.name}" plan. Please upgrade to add more agents.` };
        }
        
        const isAlreadyAgent = project.agents?.some(agent => agent.email === inviteeEmail);
        if (isAlreadyAgent) {
            return { error: 'This user is already an agent on this project.' };
        }
        
        const existingInvitation = await db.collection<Invitation>('invitations').findOne({ projectId: project._id, inviteeEmail, status: 'pending' });
        if (existingInvitation) {
            return { error: 'An invitation has already been sent to this email address for this project.' };
        }

        const invitee = await db.collection<User>('users').findOne({ email: inviteeEmail });
        if (!invitee) {
            return { error: 'No user found with this email address. Please ask them to sign up first.' };
        }

        const newInvitation: Omit<Invitation, '_id'> = {
            projectId: project._id,
            projectName: project.name,
            inviterId: new ObjectId(session.user._id),
            inviterName: session.user.name,
            inviteeEmail,
            role,
            status: 'pending',
            createdAt: new Date(),
        };

        await db.collection('invitations').insertOne(newInvitation);

        revalidatePath('/dashboard/settings');
        return { message: `Invitation sent to ${inviteeEmail}.` };
        
    } catch (e: any) {
        console.error('Failed to invite agent:', e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function getInvitationsForUser(): Promise<WithId<Invitation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const invitations = await db.collection<Invitation>('invitations')
            .find({ inviteeEmail: session.user.email, status: 'pending' })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(invitations));
    } catch (e) {
        console.error('Failed to fetch invitations:', e);
        return [];
    }
}

export async function handleRespondToInvite(invitationId: string, accepted: boolean): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    
    if (!ObjectId.isValid(invitationId)) return { success: false, error: 'Invalid invitation ID.' };

    const { db } = await connectToDatabase();
    
    const invitation = await db.collection<Invitation>('invitations').findOne({ _id: new ObjectId(invitationId), inviteeEmail: session.user.email });
    if (!invitation) return { success: false, error: 'Invitation not found or not intended for you.' };

    try {
        if (!accepted) {
            await db.collection('invitations').deleteOne({ _id: invitation._id });
            revalidatePath('/dashboard', 'layout');
            return { success: true };
        }

        const project = await db.collection<Project>('projects').findOne({ _id: invitation.projectId });
        if (!project) {
             await db.collection('invitations').deleteOne({ _id: invitation._id });
             return { success: false, error: 'The project this invitation was for no longer exists.' };
        }
        
        const owner = await db.collection<User>('users').findOne({ _id: project.userId });
        if (!owner) return { success: false, error: "Project owner not found." };
        
        const plan = owner.planId ? await db.collection<Plan>('plans').findOne({ _id: owner.planId }) : null;
        if (!plan) {
            await db.collection('invitations').deleteOne({ _id: invitation._id });
            console.error(`User ${owner._id} has a planId ${owner.planId} which does not exist.`);
            return { success: false, error: 'Could not verify project plan. Please contact support.' };
        }
        
        const agentLimit = plan.agentLimit;
        if ((project.agents?.length || 0) >= agentLimit) {
            await db.collection('invitations').deleteOne({ _id: invitation._id });
            return { success: false, error: `The project owner has reached their agent limit for the "${plan.name}" plan.` };
        }
        
        const newAgent: Agent = {
            userId: new ObjectId(session.user._id),
            name: session.user.name,
            email: session.user.email,
            role: invitation.role,
        };
        
        await db.collection('projects').updateOne(
            { _id: invitation.projectId },
            { $push: { agents: newAgent } }
        );

        await db.collection('invitations').deleteOne({ _id: invitation._id });

        revalidatePath('/dashboard', 'layout');
        return { success: true };

    } catch (e: any) {
        console.error('Failed to respond to invite:', e);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function handleRemoveAgent(prevState: AgentManagementState, formData: FormData): Promise<AgentManagementState> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const projectId = formData.get('projectId') as string;
    const agentUserId = formData.get('agentUserId') as string;

    if (!projectId || !agentUserId) {
        return { error: 'Missing required data to remove agent.' };
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project || project.userId.toString() !== session.user._id.toString()) {
            return { error: 'You do not have permission to remove agents from this project.' };
        }
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $pull: { agents: { userId: new ObjectId(agentUserId) } } as Filter<Project> }
        );

        revalidatePath('/dashboard/settings');
        return { message: 'Agent removed successfully.' };
    } catch (e: any) {
         console.error('Failed to remove agent:', e);
        return { error: 'An unexpected error occurred.' };
    }
}

// --- NOTIFICATION ACTIONS ---
export async function getNotifications(projectId?: string | null): Promise<WithId<NotificationWithProject>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const projectFilter: Filter<Project> = {
             $or: [{ userId: userObjectId }, { 'agents.userId': userObjectId }]
        };
        
        if (projectId) {
            projectFilter._id = new ObjectId(projectId);
        }

        const userProjects = await db.collection('projects').find(projectFilter, { projection: { _id: 1 } }).toArray();
        const projectIds = userProjects.map(p => p._id);
        
        const filter: Filter<Notification> = { projectId: { $in: projectIds } };

        const pipeline = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $limit: 20 },
             {
                $lookup: {
                    from: 'projects',
                    localField: 'projectId',
                    foreignField: '_id',
                    as: 'projectInfo'
                }
            },
            {
                $unwind: {
                    path: '$projectInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    message: 1,
                    link: 1,
                    isRead: 1,
                    createdAt: 1,
                    eventType: 1,
                    projectName: '$projectInfo.name'
                }
            }
        ];
        
        const notifications = await db.collection('notifications').aggregate(pipeline).toArray();

        return JSON.parse(JSON.stringify(notifications));

    } catch (e: any) {
        console.error('Failed to fetch notifications for feed:', e);
        return [];
    }
}


export async function getAllNotifications(
    page: number = 1,
    limit: number = 20,
    eventType?: string
): Promise<{ notifications: WithId<NotificationWithProject>[], total: number }> {
    const session = await getSession();
    if (!session?.user) {
        return { notifications: [], total: 0 };
    }
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const userProjects = await db.collection('projects').find(
            { $or: [{ userId: userObjectId }, { 'agents.userId': userObjectId }] },
            { projection: { _id: 1 } }
        ).toArray();
        const userProjectIds = userProjects.map(p => p._id);

        const filter: Filter<Notification> = { projectId: { $in: userProjectIds } };
        if (eventType) {
            filter.eventType = eventType;
        }

        const skip = (page - 1) * limit;

        const pipeline = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'projects',
                    localField: 'projectId',
                    foreignField: '_id',
                    as: 'projectInfo'
                }
            },
            {
                $unwind: {
                    path: '$projectInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    projectId: 1,
                    wabaId: 1,
                    message: 1,
                    link: 1,
                    isRead: 1,
                    createdAt: 1,
                    eventType: 1,
                    projectName: '$projectInfo.name'
                }
            },
            {
                $facet: {
                    paginatedResults: [{ $skip: skip }, { $limit: limit }],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];
        
        const results = await db.collection('notifications').aggregate(pipeline).toArray();

        const notifications = results[0].paginatedResults || [];
        const total = results[0].totalCount[0]?.count || 0;

        return { notifications: JSON.parse(JSON.stringify(notifications)), total };

    } catch (error) {
        console.error('Failed to fetch all notifications:', error);
        return { notifications: [], total: 0 };
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Not authenticated" };

    if (!ObjectId.isValid(notificationId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const notification = await db.collection('notifications').findOne({ _id: new ObjectId(notificationId) });
        if (!notification) return { success: false, error: "Notification not found." };
        
        const hasAccess = await getProjectById(notification.projectId.toString());
        if (!hasAccess) return { success: false, error: "Access denied." };

        await db.collection('notifications').updateOne({ _id: new ObjectId(notificationId) }, { $set: { isRead: true } });
        
        revalidatePath('/dashboard', 'layout');
        
        return { success: true };
    } catch (e: any) {
        console.error("Failed to mark notification as read:", e);
        return { success: false, error: e.message };
    }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, updatedCount: 0, error: "Not authenticated" };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const userProjects = await db.collection('projects').find(
            { $or: [{ userId: userObjectId }, { 'agents.userId': userObjectId }] },
            { projection: { _id: 1 } }
        ).toArray();
        const userProjectIds = userProjects.map(p => p._id);
        
        const result = await db.collection('notifications').updateMany(
            { projectId: { $in: userProjectIds }, isRead: false },
            { $set: { isRead: true } }
        );
        
        revalidatePath('/dashboard', 'layout');
        revalidatePath('/dashboard/notifications');

        return { success: true, updatedCount: result.modifiedCount };
    } catch (e: any) {
        console.error("Failed to mark all notifications as read:", e);
        return { success: false, updatedCount: 0, error: e.message };
    }
}


export async function handleClearOldQueueItems(): Promise<{ message?: string; error?: string }> {
    try {
        const { db } = await connectToDatabase();
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        const result = await db.collection('webhook_queue').deleteMany({
            status: { $in: ['COMPLETED', 'FAILED'] },
            createdAt: { $lt: sixHoursAgo }
        });
        
        revalidatePath('/dashboard/webhooks');

        return { message: `Successfully cleared ${result.deletedCount} old queue item(s).` };
    } catch (e: any) {
        console.error('Failed to clear old queue items:', e);
        return { error: e.message || 'An unexpected error occurred.' };
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
                        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
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
                            $setOnInsert: { waId, projectId: new ObjectId(projectId), createdAt: new Date() }
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

    if (!contactId || !projectId || !waId || !phoneNumberId || (!messageText && mediaFile.size === 0)) {
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
        let messageType: 'text' | 'image' | 'video' | 'document' = 'text';

        if (mediaFile && mediaFile.size > 0) {
            const appId = project.appId || process.env.NEXT_PUBLIC_META_APP_ID;
            if (!appId) return { error: 'App ID is not configured.' };

            const mediaData = Buffer.from(await mediaFile.arrayBuffer());
            
            // Step 1: Start an upload session
            const sessionFormData = new FormData();
            sessionFormData.append('file_length', mediaFile.size.toString());
            sessionFormData.append('file_type', mediaFile.type);
            sessionFormData.append('access_token', project.accessToken);

            const sessionResponse = await axios.post(`https://graph.facebook.com/v22.0/${appId}/uploads`, sessionFormData);
            const uploadSessionId = sessionResponse.data.id;
            
            // Step 2: Upload the file
            const uploadResponse = await axios.post(`https://graph.facebook.com/v22.0/${uploadSessionId}`, mediaData, {
                headers: {
                    'Authorization': `OAuth ${project.accessToken}`,
                    'Content-Type': mediaFile.type,
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            const handle = uploadResponse.data.h;

            const mediaType = mediaFile.type.split('/')[0];
            if (mediaType === 'image') {
                messageType = 'image';
                messagePayload.type = 'image';
                messagePayload.image = { id: handle, caption: messageText };
            } else if (mediaType === 'video') {
                messageType = 'video';
                messagePayload.type = 'video';
                messagePayload.video = { id: handle, caption: messageText };
            } else {
                messageType = 'document';
                messagePayload.type = 'document';
                messagePayload.document = { id: handle, caption: messageText, filename: mediaFile.name };
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
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: lastMessage.substring(0, 50), lastMessageTimestamp: now } });
        
        revalidatePath('/dashboard/chat');

        return { message: 'Message sent successfully.' };

    } catch (e: any) {
        console.error('Failed to send message:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
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
                $setOnInsert: {
                    waId,
                    projectId: new ObjectId(projectId),
                    phoneNumberId,
                    name: `User (${waId.slice(-4)})`,
                    createdAt: new Date(),
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

    