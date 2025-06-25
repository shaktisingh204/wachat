

'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId, WithId } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template } from '@/app/dashboard/page';
import axios from 'axios';
import { Readable } from 'stream';
import { processBroadcastJob } from '@/lib/cron-scheduler';

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
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
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

const getAxiosErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            const apiError = error.response.data?.error;
            if (apiError) {
                return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
            }
            return `Request failed with status code ${error.response.status}`;
        } else if (error.request) {
            return 'No response received from server. Check network connectivity.';
        } else {
            return error.message;
        }
    }
    return error.message || 'An unknown error occurred';
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

export async function getProjects(): Promise<WithId<Project>[]> {
    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection('projects').find({}).sort({ name: 1 }).toArray();
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


export async function getTemplates(projectId: string) {
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

export async function getBroadcasts() {
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
}> {
    if (!ObjectId.isValid(projectId)) {
        return { totalMessages: 0, totalSent: 0, totalFailed: 0, totalCampaigns: 0 };
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
        return { totalMessages: 0, totalSent: 0, totalFailed: 0, totalCampaigns: 0 };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return { totalMessages: 0, totalSent: 0, totalFailed: 0, totalCampaigns: 0 };
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
    const templateHasMediaHeader = template.components?.some((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(c.format));
    
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
        let nextUrl: string | undefined = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id&limit=100`;

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
            return {
                name: t.name,
                category: t.category,
                language: t.language,
                status: t.status,
                body: bodyComponent?.text || '',
                projectId: new ObjectId(projectId),
                metaId: t.id,
                components: t.components,
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
    let debugInfo: string | null = null;
    try {
        const projectId = formData.get('projectId') as string;
        const name = formData.get('templateName') as string;
        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const bodyText = formData.get('body') as string;
        const language = formData.get('language') as string;
        const headerFormat = formData.get('headerFormat') as string;
        const headerText = formData.get('headerText') as string;
        const headerSampleUrl = formData.get('headerSampleUrl') as string;
        const footerText = formData.get('footer') as string;
        const buttonsJson = formData.get('buttons') as string;
        const buttons = buttonsJson ? JSON.parse(buttonsJson) : [];
    
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
        if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerFormat)) {
            if (!headerSampleUrl) {
                return { error: 'Header sample media URL is required for this header type.' };
            }

            const phoneNumberId = project.phoneNumbers[0]?.id;
            if (!phoneNumberId) {
                return { error: 'Project has no registered phone numbers to use for media uploads. Please sync phone numbers first.' };
            }

            try {
                // 1. Download the media from the public URL
                const mediaResponse = await axios.get(headerSampleUrl, { responseType: 'arraybuffer' });
                const mediaData = Buffer.from(mediaResponse.data, 'binary');
                const contentType = mediaResponse.headers['content-type'] || 'application/octet-stream';
                const originalFileName = headerSampleUrl.split('/').pop()?.split('?')[0] || 'sample';

                // 2. Create a Blob to use with FormData
                const mediaBlob = new Blob([mediaData], { type: contentType });

                // 3. Use native FormData for the upload
                const uploadFormData = new FormData();
                uploadFormData.append('file', mediaBlob, originalFileName); 
                uploadFormData.append('messaging_product', 'whatsapp');
                uploadFormData.append('type', contentType);

                // --- Prepare Debug Info ---
                const uploadUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/media`;
                let uploadRequestDebug = `URL: ${uploadUrl}\n\n`;
                uploadRequestDebug += `Method: POST\n`;
                uploadRequestDebug += `Headers: { Authorization: "Bearer <TOKEN>" }\n\n`;
                uploadRequestDebug += `FormData Fields:\n`;
                uploadRequestDebug += `- file: (binary data of size ${mediaData.length} bytes, name: ${originalFileName}, type: ${contentType})\n`;
                uploadRequestDebug += `- messaging_product: whatsapp\n`;
                uploadRequestDebug += `- type: ${contentType}\n`;
                // --- End Prepare Debug Info ---


                // 4. Upload to Meta to get a handle using fetch
                const uploadResponse = await fetch(
                    uploadUrl,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        body: uploadFormData,
                    }
                );

                const responseText = await uploadResponse.text();
                const uploadResponseData = responseText ? JSON.parse(responseText) : {};
                
                // --- Capture Debug Info ---
                debugInfo = `--- MEDIA UPLOAD DEBUG ---\n\n`;
                debugInfo += `== REQUEST ==\n${uploadRequestDebug}\n`;
                debugInfo += `== RESPONSE ==\nStatus: ${uploadResponse.status} ${uploadResponse.statusText}\n`;
                debugInfo += `Body:\n${JSON.stringify(uploadResponseData, null, 2)}`;
                // --- End Capture Debug Info ---

                console.log("Media Upload Response:", JSON.stringify(uploadResponseData, null, 2));

                if (!uploadResponse.ok) {
                    const errorMessage = uploadResponseData?.error?.message || `Failed with status ${uploadResponse.status}`;
                    return { error: `Failed to prepare media for template: ${errorMessage}`, payload: payloadString, debugInfo };
                }
                
                if (!uploadResponseData.id) {
                    return { error: 'Media uploaded, but no ID was returned from Meta.', debugInfo };
                }
                uploadedMediaHandle = uploadResponseData.id;

            } catch (uploadError: any) {
                 console.error('Failed to prepare media for template:', uploadError);
                 const errorMessage = axios.isAxiosError(uploadError) ? `Could not download media from URL. Status: ${uploadError.response?.status}` : uploadError.message;
                 return { error: `Failed to prepare media for template: ${errorMessage || 'An unknown error occurred.'}` };
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
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerFormat)) {
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
                    newButton.url = button.url;
                    if (button.example) {
                        newButton.example = [button.example];
                    }
                }
                if (button.type === 'PHONE_NUMBER') {
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
            body: bodyText,
            projectId: new ObjectId(projectId),
            metaId: newMetaTemplateId,
            components, 
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

    
