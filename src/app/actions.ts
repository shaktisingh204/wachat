
'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber, Project, Template } from '@/app/dashboard/page';

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
        }
    }
};

type MetaTemplateComponent = {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
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
        }
    }
};

type BroadcastJob = {
    projectId: ObjectId;
    templateId: ObjectId;
    templateName: string;
    phoneNumberId: string;
    accessToken: string;
    contacts: Record<string, string>[];
    status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Partial Failure' | 'Failed';
    createdAt: Date;
    contactCount: number;
    fileName: string;
    components: any[];
    language: string;
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


export async function getTemplates(projectId: string) {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection('templates').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return [];
    }
}

export async function getBroadcasts() {
  try {
    const { db } = await connectToDatabase();
    const broadcasts = await db.collection('broadcasts').find({}).sort({ createdAt: -1 }).limit(10).toArray();
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
            `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
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

    const { db } = await connectToDatabase();
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
    
    const transformedContacts = contacts.map(contact => {
        const phone = contact[phoneColumnHeader];
        const {[phoneColumnHeader]: _, ...rest} = contact;
        return { phone, ...rest };
    });

    const validContacts = transformedContacts.filter((c) => c.phone && String(c.phone).trim() !== '');

    if (validContacts.length === 0) {
      return { error: 'No valid contacts with phone numbers found in the first column of the file.' };
    }
    
    const broadcastJob: Omit<WithId<BroadcastJob>, '_id'> = {
        projectId: new ObjectId(projectId),
        templateId: new ObjectId(templateId),
        templateName: template.name,
        phoneNumberId,
        accessToken,
        contacts: validContacts,
        status: 'QUEUED',
        createdAt: new Date(),
        contactCount: validContacts.length,
        fileName: contactFile.name,
        components: template.components,
        language: template.language,
    };

    await db.collection('broadcasts').insertOne(broadcastJob);

    revalidatePath('/dashboard/broadcasts');
    return { message: `Broadcast successfully queued for ${validContacts.length} contacts. Sending will begin shortly.` };

  } catch (e: any) {
    console.error('Failed to queue broadcast:', e);
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
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}&fields=${fields}`,
            { method: 'GET' }
        );
        
        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : {};
        
        if (!response.ok) {
            const errorMessage = responseData?.error?.message || 'Unknown error syncing phone numbers.';
            return { error: `API Error: ${errorMessage}. Status: ${response.status} ${response.statusText}` };
        }
        
        if (!responseData.data || responseData.data.length === 0) {
            return { message: "No phone numbers found in your WhatsApp Business Account to sync." };
        }

        const phoneNumbers: PhoneNumber[] = responseData.data.map((num: MetaPhoneNumber) => ({
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

        const response = await fetch(
            `https://graph.facebook.com/v18.0/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id`,
            { method: 'GET' }
        );

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
        
        if (!templatesResponse.data || templatesResponse.data.length === 0) {
            return { message: "No templates found in your WhatsApp Business Account to sync." }
        }

        const templatesToUpsert = templatesResponse.data.map(t => {
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
        const headerHandle = formData.get('headerHandle') as string;
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
    
        const components: any[] = [];
    
        // Header Component
        if (headerFormat !== 'NONE') {
            const headerComponent: any = { type: 'HEADER', format: headerFormat };
            if (headerFormat === 'TEXT') {
                if (!headerText) return { error: 'Header text is required for TEXT header format.' };
                headerComponent.text = headerText;
            } else {
                if (!headerHandle) return { error: 'Media handle is required for this header format.' };
                headerComponent.example = { header_handle: [headerHandle] };
            }
            components.push(headerComponent);
        }

        // Body Component
        const bodyComponent: any = { type: 'BODY', text: bodyText };
        const bodyVarMatches = bodyText.match(/{{(\d+)}}/g);
        if (bodyVarMatches) {
            const exampleParams = bodyVarMatches.map((_, i) => `example_var_${i + 1}`);
            bodyComponent.example = { body_text: [exampleParams] };
        }
        components.push(bodyComponent);

        // Footer Component
        if (footerText) {
            components.push({ type: 'FOOTER', text: footerText });
        }

        // Buttons Component
        if (buttons.length > 0) {
            components.push({ type: 'BUTTONS', buttons });
        }
    
        const payload = {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language,
            category,
            components,
        };
    
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
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
    
        await handleSyncTemplates(projectId);
        revalidatePath('/dashboard/templates');
    
        const message = `Template "${name}" submitted successfully!`;
        return { message };
  
    } catch (e: any) {
        console.error('Error in handleCreateTemplate:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleUploadMedia(formData: FormData): Promise<{ handle?: string; error?: string }> {
    try {
        const projectId = formData.get('projectId') as string;
        const phoneNumberId = formData.get('phoneNumberId') as string;
        const file = formData.get('file') as File;

        if (!projectId || !phoneNumberId || !file) {
            return { error: 'Missing project ID, phone number ID, or file.' };
        }
        if (!ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }

        const project = await getProjectById(projectId);
        if (!project) {
            return { error: 'Project not found.' };
        }
        const { accessToken } = project;

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('messaging_product', 'whatsapp');
        
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: uploadFormData,
            }
        );

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : null;

        if (!response.ok) {
            const errorMessage = data?.error?.message || 'Unknown API error during media upload.';
            return { error: `Media upload failed: ${errorMessage}. Status: ${response.status} ${response.statusText}` };
        }
        
        if (!data?.id) {
            return { error: 'Media upload succeeded but did not return an ID.' };
        }

        return { handle: data.id };

    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred during media upload.' };
    }
}
