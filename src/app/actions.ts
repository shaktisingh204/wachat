
'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId, Filter } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template } from '@/app/dashboard/page';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';

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
    status: 'PENDING' | 'SENT' | 'FAILED';
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
}

export type IncomingMessage = {
    _id: ObjectId;
    direction: 'in';
    contactId: ObjectId;
    projectId: ObjectId;
    wamid: string;
    messageTimestamp: Date;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'unknown';
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
    type: 'text' | 'image' | 'video' | 'document' | 'audio';
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

export type AnyMessage = (WithId<IncomingMessage> | WithId<OutgoingMessage>) & { direction: 'in' | 'out' };


// Re-export types for client components
export type { Project, Template, PhoneNumber };

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
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Project> = {};
        if (query) {
            filter.name = { $regex: query, $options: 'i' }; // case-insensitive regex search
        }
        const projects = await db.collection('projects').find(filter).sort({ name: 1 }).toArray();
        return JSON.parse(JSON.stringify(projects));
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
}

export async function getProjectById(projectId: string): Promise<WithId<Project> | null> {
    try {
        if (!ObjectId.isValid(projectId)) {
            console.error("Invalid Project ID in getProjectById:", projectId);
            return null;
        }
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project) {
            console.error("Project not found in getProjectById for ID:", projectId);
            return null;
        }
        return JSON.parse(JSON.stringify(project));
    } catch (error: any) {
        console.error("Exception in getProjectById:", error);
        return null;
    }
}

export async function getProjectForBroadcast(projectId: string): Promise<Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null> {
    try {
        if (!ObjectId.isValid(projectId)) {
            console.error("Invalid Project ID in getProjectForBroadcast:", projectId);
            return null;
        }
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne(
            { _id: new ObjectId(projectId) },
            { 
                projection: { 
                    'phoneNumbers.id': 1, 
                    'phoneNumbers.display_phone_number': 1 
                } 
            }
        );

        if (!project) {
            console.error("Project not found for ID:", projectId);
            return null;
        }
        
        return JSON.parse(JSON.stringify(project));
    } catch (error: any) {
        console.error("Exception in getProjectForBroadcast:", error);
        return null;
    }
}


export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
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

export async function getBroadcasts(): Promise<WithId<any>[]> {
  try {
    const { db } = await connectToDatabase();
    const broadcasts = await db.collection('broadcasts').aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'templates',
          localField: 'templateId',
          foreignField: '_id',
          as: 'templateInfo'
        }
      },
      {
        $unwind: {
          path: '$templateInfo',
          preserveNullAndEmptyArrays: true // Keep broadcasts even if template is deleted
        }
      },
      {
        $project: {
          templateId: 1,
          templateName: 1,
          templateStatus: '$templateInfo.status', // Get live status from joined collection
          fileName: 1,
          contactCount: 1,
          successCount: 1,
          errorCount: 1,
          status: 1,
          createdAt: 1,
          startedAt: 1,
          completedAt: 1,
          messagesPerSecond: 1,
          projectMessagesPerSecond: 1,
        }
      }
    ]).toArray();

    return JSON.parse(JSON.stringify(broadcasts));
  } catch (error) {
    console.error('Failed to fetch broadcast history:', error);
    return [];
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
    filter: 'ALL' | 'SENT' | 'FAILED' | 'PENDING' = 'ALL'
): Promise<{ attempts: BroadcastAttempt[], total: number }> {
    if (!ObjectId.isValid(broadcastId)) {
        console.error("Invalid Broadcast ID in getBroadcastAttempts:", broadcastId);
        return { attempts: [], total: 0 };
    }
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

export async function getDashboardStats(projectId: string): Promise<{
    totalMessages: number;
    totalSent: number;
    totalFailed: number;
    totalCampaigns: number;
} | null> {
    const defaultStats = { totalMessages: 0, totalSent: 0, totalFailed: 0, totalCampaigns: 0 };
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
                    totalCampaigns: { $sum: 1 }
                }
            }
        ]).toArray();

        if (stats.length > 0) {
            return {
                totalMessages: stats[0].totalMessages || 0,
                totalSent: stats[0].totalSent || 0,
                totalFailed: stats[0].totalFailed || 0,
                totalCampaigns: stats[0].totalCampaigns || 0,
            };
        }
        return defaultStats;
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return defaultStats;
    }
}

type CreateProjectState = {
  message?: string | null;
  error?: string | null;
};

export async function handleCreateProject(
  prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
    try {
        const wabaId = formData.get('wabaId') as string;
        const accessToken = formData.get('accessToken') as string;

        if (!wabaId || !accessToken) {
            return { error: 'All fields are required.' };
        }
        
        const response = await fetch(
            `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            let reason = 'Invalid credentials or API error.';
            try {
                const errorData = await response.json();
                reason = errorData?.error?.message || reason;
            } catch (e) {
                reason = `Could not parse error response from Meta. Status: ${response.status} ${response.statusText}`;
            }
            return { error: `Verification failed: ${reason}` };
        }
        
        const data: MetaPhoneNumbersResponse = await response.json();
        
        if (!data.data || data.data.length === 0) {
            return { error: 'Verification successful, but no phone numbers are associated with this Business Account ID.' };
        }

        const name = data.data[0].verified_name;
        if (!name) {
            return { error: 'Could not determine the business name from the API. Please ensure your business is verified.' };
        }

        const phoneNumbers: PhoneNumber[] = data.data.map((num: MetaPhoneNumber) => ({
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
        }));

        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({ $or: [{ name }, { wabaId }] });
        if (existingProject) {
            return { error: `A project for "${name}" or with the same Business ID already exists.` };
        }

        await db.collection('projects').insertOne({
            name,
            wabaId,
            accessToken,
            phoneNumbers,
            createdAt: new Date(),
            messagesPerSecond: 1000,
            reviewStatus: 'UNKNOWN',
        });
        
        revalidatePath('/dashboard');

        return { message: `Project "${name}" created successfully with ${phoneNumbers.length} phone number(s)!` };

    } catch (e: any) {
        console.error('Project creation failed:', e);
        if (e.code === 11000) {
            return { error: `A project with this name or Business ID might already exist.` };
        }
        return { error: e.message || 'An unexpected error occurred while saving the project.' };
    }
}


type BroadcastState = {
  message?: string | null;
  error?: string | null;
};

const processStreamedContacts = (inputStream: NodeJS.ReadableStream | string, db: Db, broadcastId: ObjectId): Promise<number> => {
    return new Promise<number>((resolve, reject) => {
        let localContactCount = 0;
        let contactBatch: any[] = [];
        const batchSize = 1000;
        let phoneColumnHeader: string | null = null;
        
        Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            step: async (results, parser) => {
                const row = results.data as Record<string, string>;
                if (!phoneColumnHeader) {
                    phoneColumnHeader = Object.keys(row)[0];
                    if (!phoneColumnHeader) {
                        parser.abort();
                        return reject(new Error("File appears to have no columns or is empty."));
                    }
                }
                
                const phone = row[phoneColumnHeader!];
                if (!phone || String(phone).trim() === '') return;

                const {[phoneColumnHeader!]: _, ...variables} = row;
                const contactDoc = {
                    broadcastId,
                    phone: String(phone).trim(),
                    variables,
                    status: 'PENDING' as const,
                    createdAt: new Date(),
                };
                contactBatch.push(contactDoc);
                localContactCount++;
                
                if (contactBatch.length >= batchSize) {
                    parser.pause();
                    try {
                        await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
                        contactBatch = [];
                    } catch (dbError) {
                        console.warn('Batch insert failed, some contacts may be duplicates:', dbError);
                    } finally {
                        parser.resume();
                    }
                }
            },
            complete: async () => {
                try {
                    if (contactBatch.length > 0) {
                        await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
                    }
                    resolve(localContactCount);
                } catch (dbError) {
                    console.warn('Final batch insert failed:', dbError);
                    resolve(localContactCount);
                }
            },
            error: (error) => {
                reject(error);
            }
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
    if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }
    
    if (!phoneNumberId) {
      return { error: 'No phone number selected. Please select a number to send the broadcast from.' };
    }

    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      return { error: 'Selected project not found. It may have been deleted.' };
    }
    
    const accessToken = project.accessToken;

    const templateId = formData.get('templateId') as string;
    const contactFile = formData.get('csvFile') as File;

    if (!templateId) return { error: 'Please select a message template.' };
    if (!ObjectId.isValid(templateId)) {
        return { error: 'Invalid Template ID.' };
    }
    if (!contactFile || contactFile.size === 0) return { error: 'Please upload a contact file.' };

    const template = await db.collection('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Selected template not found.' };

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
        contactCount = await processStreamedContacts(nodeStream, db, broadcastId);
    } else if (contactFile.name.endsWith('.xlsx')) {
        const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new Error('The XLSX file contains no sheets.');
        }
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        contactCount = await processStreamedContacts(csvData, db, broadcastId);
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
    if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project) {
            return { error: 'Project not found.' };
        }

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
    if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project) {
            return { error: 'Project not found.' };
        }

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
        const appId = process.env.APP_ID;
        if (!appId) {
            return { error: 'APP_ID is not configured in the environment variables. Please set it in the .env file.' };
        }

        const projectId = formData.get('projectId') as string;
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
    
        if (!projectId || !name || !category || !bodyText || !language) {
            return { error: 'Project, Name, Language, Category, and Body are required.' };
        }
        if (!ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }
    
        const project = await getProjectById(projectId);
        if (!project) {
            return { error: 'Project not found.' };
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

        const { db } = await connectToDatabase();
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
    if (!ObjectId.isValid(broadcastId)) {
        return { error: 'Invalid Broadcast ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const broadcastObjectId = new ObjectId(broadcastId);

        const broadcast = await db.collection('broadcasts').findOne({ _id: broadcastObjectId });

        if (!broadcast) {
            return { error: 'Broadcast not found.' };
        }

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
        if (!ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }

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

    if (!broadcastId || !ObjectId.isValid(broadcastId)) {
        return { error: 'Invalid Broadcast ID.' };
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
        const [originalBroadcast, newTemplate] = await Promise.all([
            db.collection('broadcasts').findOne({ _id: originalBroadcastId }),
            db.collection('templates').findOne({ _id: new ObjectId(newTemplateId) })
        ]);
        
        if (!originalBroadcast) {
            return { error: 'Original broadcast not found.' };
        }
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
                             reviewStatus: 'UNKNOWN',
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
    createdAt: Date;
};

export async function getWebhookLogs(
    page: number = 1, 
    limit: number = 20, 
    query?: string
): Promise<{ logs: WithId<WebhookLog>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<WebhookLog> = {};
        if (query) {
            // A text index on 'searchableText' would be ideal for performance
            filter.searchableText = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            db.collection('webhook_logs').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('webhook_logs').countDocuments(filter)
        ]);
        
        return { logs: JSON.parse(JSON.stringify(logs)), total };
    } catch (error) {
        console.error('Failed to fetch webhook logs:', error);
        return { logs: [], total: 0 };
    }
}

export async function handleClearWebhookLogs(): Promise<{ message?: string; error?: string, deletedCount?: number }> {
    try {
        const { db } = await connectToDatabase();
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const result = await db.collection('webhook_logs').deleteMany({
            createdAt: { $lt: twentyFourHoursAgo }
        });

        revalidatePath('/dashboard/webhooks');

        return { message: `Successfully cleared ${result.deletedCount} old webhook log(s).`, deletedCount: result.deletedCount };
    } catch (e: any) {
        console.error('Failed to clear webhook logs:', e);
        return { error: e.message || 'An unexpected error occurred while clearing logs.' };
    }
}

export async function getNotifications(): Promise<WithId<NotificationWithProject>[]> {
    try {
        const { db } = await connectToDatabase();
        const notifications = await db.collection('notifications').aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 50 },
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
            }
        ]).toArray();

        return JSON.parse(JSON.stringify(notifications));
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }
}

export async function getAllNotifications(
    page: number = 1, 
    limit: number = 20, 
    filter?: string
): Promise<{ notifications: WithId<NotificationWithProject>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        
        const query: Filter<Notification> = {};
        if (filter) {
            query.eventType = filter;
        }

        const skip = (page - 1) * limit;

        const pipeline: any[] = [
            { $match: query },
            { $sort: { createdAt: -1 } },
            {
                $facet: {
                    paginatedResults: [
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
                        }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
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


export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    if (!ObjectId.isValid(notificationId)) {
        return { success: false };
    }
    try {
        const { db } = await connectToDatabase();
        await db.collection('notifications').updateOne(
            { _id: new ObjectId(notificationId) },
            { $set: { isRead: true } }
        );
        revalidatePath('/dashboard', 'layout'); // Revalidate layout to update count
        return { success: true };
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return { success: false };
    }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean, updatedCount: number }> {
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('notifications').updateMany(
            { isRead: false },
            { $set: { isRead: true } }
        );
        revalidatePath('/dashboard', 'layout');
        return { success: true, updatedCount: result.modifiedCount };
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return { success: false, updatedCount: 0 };
    }
}

// --- Live Chat & Contacts Actions ---

export async function getContactsForProject(projectId: string, phoneNumberId: string): Promise<WithId<Contact>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection('contacts')
            .find({ projectId: new ObjectId(projectId), phoneNumberId })
            .sort({ lastMessageTimestamp: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(contacts));
    } catch (error) {
        console.error("Failed to fetch contacts:", error);
        return [];
    }
}

export async function getConversation(contactId: string): Promise<AnyMessage[]> {
    if (!ObjectId.isValid(contactId)) return [];
    try {
        const { db } = await connectToDatabase();
        const contactObjectId = new ObjectId(contactId);

        const incoming = await db.collection<IncomingMessage>('incoming_messages').find({ contactId: contactObjectId }).toArray();
        const outgoing = await db.collection<OutgoingMessage>('outgoing_messages').find({ contactId: contactObjectId }).toArray();

        const allMessages: AnyMessage[] = [
            ...incoming.map(m => ({ ...m, direction: 'in' as const })),
            ...outgoing.map(m => ({ ...m, direction: 'out' as const }))
        ];

        allMessages.sort((a, b) => {
            const timeA = a.messageTimestamp || a.createdAt;
            const timeB = b.messageTimestamp || b.createdAt;
            return new Date(timeA).getTime() - new Date(timeB).getTime();
        });

        return JSON.parse(JSON.stringify(allMessages));
    } catch (error) {
        console.error("Failed to fetch conversation:", error);
        return [];
    }
}

export async function markConversationAsRead(contactId: string): Promise<{ success: boolean }> {
    if (!ObjectId.isValid(contactId)) return { success: false };
    try {
        const { db } = await connectToDatabase();
        const contactObjectId = new ObjectId(contactId);

        await db.collection('incoming_messages').updateMany(
            { contactId: contactObjectId, isRead: false },
            { $set: { isRead: true } }
        );
        await db.collection('contacts').updateOne(
            { _id: contactObjectId },
            { $set: { unreadCount: 0 } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (error) {
        console.error("Failed to mark conversation as read:", error);
        return { success: false };
    }
}


export async function handleSendMessage(
    prevState: { message: string | null; error: string | null },
    formData: FormData
): Promise<{ message: string | null; error: string | null }> {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const waId = formData.get('waId') as string; // The recipient's ID
    const messageText = formData.get('messageText') as string;
    const mediaFile = formData.get('mediaFile') as File;

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne({ _id: new ObjectId(projectId) });
        if (!project) throw new Error('Project not found.');

        const { accessToken } = project;
        let messagePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: waId,
        };

        let wamid: string | null = null;
        let outgoingMessageDoc: Omit<OutgoingMessage, '_id'>;
        const now = new Date();

        if (mediaFile && mediaFile.size > 0) {
            // Step 1: Upload media to get an ID
            const mediaFormData = new FormData();
            mediaFormData.append('messaging_product', 'whatsapp');
            mediaFormData.append('file', new Blob([await mediaFile.arrayBuffer()]), mediaFile.name);

            const uploadResponse = await axios.post(
                `https://graph.facebook.com/v22.0/${phoneNumberId}/media`,
                mediaFormData,
                { headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    ...mediaFormData.getHeaders(),
                }}
            );

            const mediaId = uploadResponse.data.id;
            if (!mediaId) throw new Error("Failed to get media ID from Meta.");

            // Step 2: Send message with media ID
            const type = mediaFile.type.split('/')[0]; // 'image', 'video', 'application' -> 'document'
            const messageType = type === 'application' ? 'document' : type;

            messagePayload.type = messageType;
            messagePayload[messageType] = { id: mediaId, caption: messageText };

        } else if (messageText) {
            messagePayload.type = 'text';
            messagePayload.text = { preview_url: true, body: messageText };
        } else {
            return { message: null, error: "Message cannot be empty." };
        }

        const sendMessageResponse = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            messagePayload,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        wamid = sendMessageResponse.data?.messages?.[0]?.id;

        if (!wamid) throw new Error("Message sent but no WAMID was returned from Meta.");

        outgoingMessageDoc = {
            direction: 'out',
            contactId: new ObjectId(contactId),
            projectId: new ObjectId(projectId),
            wamid,
            messageTimestamp: now,
            type: messagePayload.type,
            content: messagePayload,
            status: 'pending',
            statusTimestamps: {},
            createdAt: now,
        };

        await db.collection('outgoing_messages').insertOne(outgoingMessageDoc);

        // Update last message on contact
        const lastMessage = messageText || `[${messagePayload.type}]`;
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { lastMessage, lastMessageTimestamp: now } }
        );

        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        return { message: 'Message sent successfully', error: null };

    } catch (e: any) {
        console.error("Error sending message:", e);
        const error = getErrorMessage(e);
        return { message: null, error };
    }
}

export async function findOrCreateContact(
    projectId: string, 
    phoneNumberId: string, 
    waId: string
): Promise<{ contact?: WithId<Contact>; error?: string }> {
    if (!ObjectId.isValid(projectId) || !phoneNumberId || !waId) {
        return { error: 'Invalid input provided.' };
    }
    try {
        const { db } = await connectToDatabase();
        
        const { value: contact } = await db.collection<Contact>('contacts').findOneAndUpdate(
            { projectId: new ObjectId(projectId), waId },
            {
                $setOnInsert: {
                    projectId: new ObjectId(projectId),
                    phoneNumberId,
                    waId,
                    name: waId, // Default name to phone number
                    createdAt: new Date(),
                    unreadCount: 0,
                    lastMessage: 'New Contact',
                    lastMessageTimestamp: new Date(),
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        if (!contact) {
            return { error: 'Failed to find or create contact.' };
        }
        
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/contacts');
        return { contact: JSON.parse(JSON.stringify(contact)) };
    } catch (error: any) {
        console.error("Error in findOrCreateContact:", error);
        return { error: error.message || 'An unexpected error occurred.' };
    }
}

export async function handleAddNewContact(
    prevState: { message: string | null; error: string | null },
    formData: FormData
): Promise<{ message: string | null; error: string | null }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const waId = formData.get('waId') as string;

    if (!projectId || !phoneNumberId || !name || !waId) {
        return { error: 'All fields are required.' };
    }
     if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const existingContact = await db.collection('contacts').findOne({
            projectId: new ObjectId(projectId),
            waId,
        });

        if (existingContact) {
            return { error: 'A contact with this WhatsApp ID already exists for this project.' };
        }

        const newContact: Omit<Contact, '_id'> = {
            projectId: new ObjectId(projectId),
            phoneNumberId,
            name,
            waId,
            lastMessage: 'Manually added',
            lastMessageTimestamp: new Date(),
            unreadCount: 0,
            createdAt: new Date(),
        };

        await db.collection('contacts').insertOne(newContact);

        revalidatePath('/dashboard/contacts');
        return { message: `Contact "${name}" added successfully.`, error: null };

    } catch (error: any) {
        console.error("Error adding new contact:", error);
        return { message: null, error: error.message || 'An unexpected error occurred.' };
    }
}

export async function handleImportContacts(
    prevState: { message: string | null; error: string | null },
    formData: FormData
): Promise<{ message: string | null; error: string | null }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectId || !phoneNumberId || !contactFile) {
        return { error: 'Project, phone number, and a file are required.' };
    }
    if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    const { db } = await connectToDatabase();
    
    const processContacts = (data: string): Promise<number> => {
        return new Promise((resolve, reject) => {
            let importedCount = 0;
            const operations: any[] = [];
            
            Papa.parse(data, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const rows = results.data as Record<string, string>[];
                    if (rows.length === 0) {
                        return reject(new Error("File is empty or not formatted correctly."));
                    }
                    
                    const waIdHeader = Object.keys(rows[0])[0];
                    const nameHeader = Object.keys(rows[0])[1];

                    if (!waIdHeader) {
                        return reject(new Error("Could not find a header for the phone number (first column)."));
                    }

                    rows.forEach(row => {
                        const waId = row[waIdHeader]?.trim();
                        if (!waId) return;

                        const name = row[nameHeader]?.trim() || waId;
                        const { [waIdHeader]: _, [nameHeader]: __, ...variables } = row;

                        const op = {
                            updateOne: {
                                filter: { projectId: new ObjectId(projectId), waId },
                                update: {
                                    $set: { name, variables },
                                    $setOnInsert: {
                                        projectId: new ObjectId(projectId),
                                        phoneNumberId,
                                        waId,
                                        createdAt: new Date(),
                                    }
                                },
                                upsert: true
                            }
                        };
                        operations.push(op);
                    });

                    if (operations.length > 0) {
                        const result = await db.collection('contacts').bulkWrite(operations, { ordered: false });
                        importedCount = result.upsertedCount + result.modifiedCount;
                    }
                    
                    resolve(importedCount);
                },
                error: (error: any) => reject(error)
            });
        });
    };

    try {
        let importedCount = 0;
        if (contactFile.name.endsWith('.csv')) {
            const text = await contactFile.text();
            importedCount = await processContacts(text);
        } else if (contactFile.name.endsWith('.xlsx')) {
            const buffer = Buffer.from(await contactFile.arrayBuffer());
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('XLSX file has no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            importedCount = await processContacts(csvData);
        } else {
            return { error: 'Unsupported file type. Please upload a CSV or XLSX file.' };
        }
        
        revalidatePath('/dashboard/contacts');
        return { message: `Successfully imported ${importedCount} contacts.`, error: null };

    } catch (error: any) {
        console.error("Error importing contacts:", error);
        return { message: null, error: error.message || 'An unexpected error occurred.' };
    }
}
