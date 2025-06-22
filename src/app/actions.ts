
'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template } from '@/app/dashboard/page';
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
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
    button?: any[];
};

type MetaTemplate = {
    id: string;
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
            status: 1
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
    const projection = {
        templateName: 1,
        fileName: 1,
        contactCount: 1,
        successCount: 1,
        errorCount: 1,
        status: 1,
        createdAt: 1,
        completedAt: 1,
    };
    const broadcasts = await db.collection('broadcasts')
      .find({})
      .project(projection)
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
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

export async function getBroadcastAttempts(broadcastId: string, page: number = 1, limit: number = 50): Promise<{ attempts: BroadcastAttempt[], total: number }> {
    if (!ObjectId.isValid(broadcastId)) {
        console.error("Invalid Broadcast ID in getBroadcastAttempts:", broadcastId);
        return { attempts: [], total: 0 };
    }
    try {
        const { db } = await connectToDatabase();
        const query = { broadcastId: new ObjectId(broadcastId) };
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
        const name = formData.get('name') as string;
        const wabaId = formData.get('wabaId') as string;
        const accessToken = formData.get('accessToken') as string;

        if (!name || !wabaId || !accessToken) {
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
        await db.collection('projects').insertOne({
            name,
            wabaId,
            accessToken,
            phoneNumbers,
            createdAt: new Date(),
            messagesPerSecond: 80,
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
    const headerImageUrl = formData.get('headerImageUrl') as string | null;

    if (!templateId) return { error: 'Please select a message template.' };
    if (!ObjectId.isValid(templateId)) {
        return { error: 'Invalid Template ID.' };
    }
    if (!contactFile || contactFile.size === 0) return { error: 'Please upload a contact file.' };

    const template = await db.collection('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Selected template not found.' };

    let contacts: Record<string, string>[] = [];
    const fileBuffer = Buffer.from(await contactFile.arrayBuffer());

    if (contactFile.name.endsWith('.csv')) {
        const csvText = fileBuffer.toString('utf-8');
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        contacts = parsed.data as Record<string, string>[];
    } else if (contactFile.name.endsWith('.xlsx')) {
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            contacts = jsonData.map(row => {
                const newRow: Record<string, string> = {};
                for (const key in row) {
                    newRow[key] = String((row as any)[key]);
                }
                return newRow;
            });
        } catch (e: any) {
            console.error('Error parsing XLSX file:', e);
            return { error: `Error parsing XLSX file: ${e.message}`};
        }
    } else {
        return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
    }
    
    if (contacts.length === 0) {
      return { error: 'Contact file is empty or contains no data.' };
    }

    const firstRow = contacts[0];
    const headers = Object.keys(firstRow);
    if (headers.length === 0) {
        return { error: 'The contact file appears to have no columns.' };
    }
    const phoneColumnHeader = headers[0];
    
    const transformedContacts = contacts
        .map(contact => {
            const phone = contact[phoneColumnHeader];
            if (!phone || String(phone).trim() === '') return null;
            
            const {[phoneColumnHeader]: _, ...rest} = contact;
            return { phone: String(phone).trim(), variables: rest };
        })
        .filter(c => c !== null) as { phone: string; variables: Record<string, string> }[];


    if (transformedContacts.length === 0) {
      return { error: 'No valid contacts with phone numbers found in the first column of the file.' };
    }
    
    let finalHeaderImageUrl: string | undefined = undefined;
    if (headerImageUrl && headerImageUrl.trim() !== '') {
        finalHeaderImageUrl = headerImageUrl.trim();
    }
    
    const broadcastJobData: Omit<WithId<BroadcastJob>, '_id'> = {
        projectId: new ObjectId(projectId),
        templateId: new ObjectId(templateId),
        templateName: template.name,
        phoneNumberId,
        accessToken,
        status: 'QUEUED',
        createdAt: new Date(),
        contactCount: transformedContacts.length,
        fileName: contactFile.name,
        components: template.components,
        language: template.language,
        headerImageUrl: finalHeaderImageUrl,
    };

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastJobData);
    broadcastId = broadcastResult.insertedId;

    const contactsToInsert = transformedContacts.map(c => ({
        broadcastId,
        phone: c.phone,
        variables: c.variables,
        status: 'PENDING' as const,
        createdAt: new Date(),
    }));

    const batchSize = 5000;
    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        await db.collection('broadcast_contacts').insertMany(batch);
    }

    revalidatePath('/dashboard/broadcasts');
    return { message: `Broadcast successfully queued for ${transformedContacts.length} contacts. Sending will begin shortly.` };

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
};
  
export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
  ): Promise<CreateTemplateState> {
    try {
        const projectId = formData.get('projectId') as string;
        const name = formData.get('templateName') as string;
        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const bodyText = formData.get('body') as string;
        const language = formData.get('language') as string;
        const headerFormat = formData.get('headerFormat') as string;
        const headerText = formData.get('headerText') as string;
        const headerUrl = formData.get('headerUrl') as string;
        const footerText = formData.get('footer') as string;
        const buttonsJson = formData.get('buttons') as string;
        const button = buttonsJson ? JSON.parse(buttonsJson) : [];
    
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
    
        const components: any[] = [];
    
        if (headerFormat !== 'NONE') {
            const headerComponent: any = { type: 'HEADER', format: headerFormat };
            if (headerFormat === 'TEXT') {
                if (!headerText) return { error: 'Header text is required for TEXT header format.' };
                headerComponent.text = headerText;
            } else {
                if (!headerUrl) return { error: 'Header media URL is required.' };
                headerComponent.example = { header_handle: [headerUrl] };
            }
            components.push(headerComponent);
        }

        const bodyComponent: any = { type: 'BODY', text: bodyText };
        const bodyVarMatches = bodyText.match(/{{(\d+)}}/g);
        if (bodyVarMatches) {
            const exampleParams = bodyVarMatches.map((_, i) => `example_var_${i + 1}`);
            bodyComponent.example = { body_text: [exampleParams] };
        }
        components.push(bodyComponent);

        if (footerText) {
            components.push({ type: 'FOOTER', text: footerText });
        }

        if (button.length > 0) {
            components.push({
                type: 'BUTTONS',
                button: button,
            });
        }
    
        const payload = {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language,
            category,
            components,
            allow_category_change: true,
        };
    
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
            const errorMessage = responseData?.error?.error_user_title || responseData?.error?.message || 'Unknown error creating template.';
            return { error: `API Error: ${errorMessage}. Status: ${response.status} ${response.statusText}` };
        }

        const newMetaTemplateId = responseData?.id;
        if (!newMetaTemplateId) {
            return { error: 'Template created on Meta, but no ID was returned. Please sync manually.' };
        }

        const { db } = await connectToDatabase();
        const templateToInsert = {
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
        return { message };
  
    } catch (e: any) {
        console.error('Error in handleCreateTemplate:', e);
        return { error: e.message || 'An unexpected error occurred.' };
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
