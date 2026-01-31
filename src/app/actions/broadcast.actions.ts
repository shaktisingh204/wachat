
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/user.actions';
import { handleManualWachatSetup } from '@/app/actions/whatsapp.actions';
import { getErrorMessage, validateFile } from '@/lib/utils';
import type { Project, Template, Broadcast, Contact } from '@/lib/definitions';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { nanoid } from 'nanoid';

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20
): Promise<{ broadcasts: WithId<Broadcast>[], total: number }> {
    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;
        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts').find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcasts').countDocuments()
        ]);

        return {
            broadcasts: JSON.parse(JSON.stringify(broadcasts)),
            total
        };

    } catch(e) {
        console.error("Failed to get all broadcasts:", e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcasts(
    projectId: string,
    page: number = 1,
    limit: number = 10
): Promise<{ broadcasts: WithId<Broadcast>[], total: number }> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { broadcasts: [], total: 0 };
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { broadcasts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;
        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts')
                .find({ projectId: new ObjectId(projectId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('broadcasts').countDocuments({ projectId: new ObjectId(projectId) })
        ]);
        
        return {
            broadcasts: JSON.parse(JSON.stringify(broadcasts)),
            total
        };
    } catch (e) {
        console.error("Failed to get broadcasts for project:", e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcastById(broadcastId: string): Promise<WithId<any> | null> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return null;

    try {
        const { db } = await connectToDatabase();
        const broadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(broadcastId) });
        if (!broadcast) return null;

        const hasAccess = await getProjectById(broadcast.projectId.toString());
        if (!hasAccess) return null;
        
        return JSON.parse(JSON.stringify(broadcast));

    } catch (e) {
        console.error("Failed to get broadcast by ID:", e);
        return null;
    }
}

export async function getBroadcastAttempts(
    broadcastId: string,
    page: number = 1,
    limit: number = 50,
    statusFilter?: string
): Promise<{ attempts: any[], total: number }> {
     if (!broadcastId || !ObjectId.isValid(broadcastId)) return { attempts: [], total: 0 };
     try {
        const { db } = await connectToDatabase();
        
        const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
        if(statusFilter && statusFilter !== 'ALL') {
            filter.status = statusFilter;
        }

        const skip = (page - 1) * limit;

        const [attempts, total] = await Promise.all([
            db.collection('broadcast_contacts').find(filter).sort({ _id: 1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcast_contacts').countDocuments(filter)
        ]);

        return {
            attempts: JSON.parse(JSON.stringify(attempts)),
            total
        };

     } catch(e) {
         return { attempts: [], total: 0 };
     }
}

export async function getBroadcastAttemptsForExport(broadcastId: string, statusFilter?: string): Promise<any[]> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
     try {
        const { db } = await connectToDatabase();
        const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
        if(statusFilter && statusFilter !== 'ALL') {
            filter.status = statusFilter;
        }
        const attempts = await db.collection('broadcast_contacts').find(filter).project({ phone: 1, status: 1, messageId: 1, error: 1, sentAt: 1 }).toArray();
        return JSON.parse(JSON.stringify(attempts));
     } catch(e) {
         return [];
     }
}


export async function getBroadcastLogs(broadcastId: string): Promise<WithId<any>[]> {
     if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
     try {
        const { db } = await connectToDatabase();
        const logs = await db.collection('broadcast_logs').find({ broadcastId: new ObjectId(broadcastId) }).sort({ timestamp: -1 }).limit(100).toArray();
        return JSON.parse(JSON.stringify(logs));
     } catch(e) {
        return [];
     }
}


const parseContactFile = async (file: File) => {
    const { isValid, error } = validateFile(file, ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    if (!isValid) throw new Error(error);

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    let rows: any[] = [];
    if(file.type === 'text/csv') {
        const text = new TextDecoder("utf-8").decode(data);
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    } else {
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const header = rows[0];
        rows = rows.slice(1).map(row => {
            const rowData: any = {};
            header.forEach((h: any, i: number) => {
                rowData[h] = row[i];
            });
            return rowData;
        });
    }

    if (!rows[0] || !Object.keys(rows[0]).some(h => h.toLowerCase().includes('phone'))) {
        throw new Error("Invalid file format. The first column must be named 'phone'.");
    }

    return rows.map((row) => ({
        phone: String(row.phone || row.Phone || row.PHONE).trim().replace(/\D/g, ''),
        name: row.name || row.Name || 'Subscriber',
        ...row // include other columns as variables
    }));
};

async function createBroadcastContacts(db: Db, broadcastId: ObjectId, contacts: any[]) {
    if (contacts.length === 0) return 0;

    const contactsToInsert = contacts.map(c => ({
        broadcastId: broadcastId,
        phone: c.phone,
        name: c.name,
        variables: { ...c }, // All columns are available as variables
        status: 'PENDING',
    }));

    // Use bulk write for efficient insertion
    const batchSize = 1000;
    let totalInserted = 0;
    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        const result = await db.collection('broadcast_contacts').insertMany(batch);
        totalInserted += result.insertedCount;
    }
    return totalInserted;
}


export async function handleStartBroadcast(
    prevState: any,
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const templateId = formData.get('templateId') as string;
    const audienceType = formData.get('audienceType') as 'file' | 'tags';
    const tagIds = formData.getAll('tagIds') as string[];
    
    // Header variables
    const headerImageUrl = formData.get('headerImageUrl') as string | null;
    const headerMediaFile = formData.get('headerImageFile') as File | null;
    const headerText = formData.get('headerText') as string | null;
    
    // Body variables mapping
    const variableMappingsJSON = formData.get('variableMappings') as string | null;
    const variableMappings = variableMappingsJSON ? JSON.parse(variableMappingsJSON) : [];
    
    const { db } = await connectToDatabase();
    
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: new ObjectId(projectId) });
    if (!template) return { error: 'Template not found for this project.' };

    let contacts: any[] = [];

    if (audienceType === 'file') {
        const csvFile = formData.get('csvFile') as File;
        if (!csvFile || csvFile.size === 0) return { error: 'Contact file is required.' };
        try {
            contacts = await parseContactFile(csvFile);
        } catch (e: any) {
            return { error: `Failed to parse file: ${e.message}` };
        }
    } else if (audienceType === 'tags' && tagIds.length > 0) {
        const validTagIds = tagIds.map(id => new ObjectId(id));
        contacts = await db.collection<Contact>('contacts').find({
            projectId: new ObjectId(projectId),
            tagIds: { $in: validTagIds }
        }).toArray();
    }
    
    if (contacts.length === 0) {
        return { error: 'No contacts found for the selected audience.' };
    }

    // --- Build Component Payload ---
    const components: any[] = [];
    const templateComponents = template.components || [];

    const headerComponentDef = templateComponents.find(c => c.type === 'HEADER');
    if (headerComponentDef) {
        const format = headerComponentDef.format?.toLowerCase();
        
        let parameter: any = {};
        let shouldAddComponent = false;

        if (format && ['image', 'video', 'document'].includes(format)) {
            parameter.type = format;
            if (headerImageUrl) {
                parameter[format] = { link: headerImageUrl };
                shouldAddComponent = true;
            } else if (headerMediaFile && headerMediaFile.size > 0) {
                // The worker will handle the upload, we just need to signal it.
                // An empty object signifies the worker needs to create the ID.
                parameter[format] = {};
                shouldAddComponent = true;
            }
        } else if (format === 'text' && headerText) {
            parameter = { type: 'text', text: headerText };
            shouldAddComponent = true;
        }
        
        if (shouldAddComponent) {
            components.push({ type: 'header', parameters: [parameter] });
        }
    }


    if (variableMappings.length > 0) {
        components.push({
            type: 'body',
            parameters: variableMappings.map((m: any) => ({
                type: 'text',
                text: `{{${m.contactField}}}` // The worker will interpolate this
            }))
        });
    }
    
    const broadcastData: Omit<Broadcast, '_id'> = {
        name: `${template.name} - ${new Date().toLocaleString()}`,
        projectId: new ObjectId(projectId),
        phoneNumberId,
        templateName: template.name,
        templateId: template._id,
        language: template.language,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        audienceType: audienceType,
        tagIds: audienceType === 'tags' ? tagIds.map(id => new ObjectId(id)) : [],
        accessToken: project.accessToken,
        components,
        createdAt: new Date(),
        headerMediaFile: headerMediaFile?.size > 0 ? {
            buffer: Buffer.from(await headerMediaFile.arrayBuffer()),
            name: headerMediaFile.name,
            type: headerMediaFile.type,
        } : undefined,
    };
    
    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData as any);
    const broadcastId = broadcastResult.insertedId;
    
    const contactsInserted = await createBroadcastContacts(db, broadcastId, contacts);

    revalidatePath('/dashboard/broadcasts');
    
    return { message: `Broadcast successfully queued for ${contactsInserted} contacts. Sending will begin shortly.` };
}

export async function handleBulkBroadcast(
    prevState: any,
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectIdsString = formData.get('projectIds') as string;
    const templateName = formData.get('templateName') as string;
    const language = formData.get('language') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectIdsString || !templateName || !language || !contactFile || contactFile.size === 0) {
        return { error: 'Missing required fields for bulk broadcast.' };
    }

    const projectIds = projectIdsString.split(',');
    
    try {
        const { db } = await connectToDatabase();
        const allContacts = await parseContactFile(contactFile);
        
        if (allContacts.length === 0) {
            return { error: 'Contact file is empty or could not be parsed.' };
        }

        const contactsPerProject = Math.ceil(allContacts.length / projectIds.length);
        let successCount = 0;
        let failedProjects: string[] = [];

        for (let i = 0; i < projectIds.length; i++) {
            const projectId = projectIds[i];
            const projectContacts = allContacts.slice(i * contactsPerProject, (i + 1) * contactsPerProject);
            
            if (projectContacts.length === 0) continue;

            const project = await getProjectById(projectId);
            if (!project) {
                failedProjects.push(`Project ID ${projectId} (not found)`);
                continue;
            }

            const template = await db.collection<Template>('templates').findOne({ projectId: new ObjectId(projectId), name: templateName, language: language });
            if (!template) {
                failedProjects.push(`${project.name} (template not found)`);
                continue;
            }
            if (template.status !== 'APPROVED') {
                failedProjects.push(`${project.name} (template not approved)`);
                continue;
            }

            const broadcastData: Omit<Broadcast, '_id'> = {
                name: `Bulk: ${template.name} - ${new Date().toLocaleString()}`,
                projectId: new ObjectId(projectId),
                phoneNumberId: project.phoneNumbers?.[0]?.id || '', // Use the first available number
                templateName: template.name,
                templateId: template._id,
                language: template.language,
                status: 'PENDING_PROCESSING',
                contactCount: projectContacts.length,
                audienceType: 'file-bulk',
                accessToken: project.accessToken,
                components: template.components || [],
                createdAt: new Date(),
            };
    
            const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData as any);
            const broadcastId = broadcastResult.insertedId;
            
            await createBroadcastContacts(db, broadcastId, projectContacts);
            successCount++;
        }

        let message = `Successfully queued broadcasts for ${successCount} project(s).`;
        if (failedProjects.length > 0) {
            message += ` Failed on ${failedProjects.length} project(s): ${failedProjects.join(', ')}.`;
        }

        revalidatePath('/dashboard/bulk');
        revalidatePath('/dashboard/broadcasts');
        
        return { message };

    } catch (e: any) {
        return { error: `Failed to process bulk broadcast: ${getErrorMessage(e)}` };
    }
}

export async function handleStartApiBroadcast(data: {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    contacts: any[];
    variableMappings?: any[];
}): Promise<{ message?: string; error?: string }> {
    const { projectId, phoneNumberId, templateId, contacts, variableMappings } = data;
    const { db } = await connectToDatabase();
    
    const [project, template] = await Promise.all([
        getProjectById(projectId),
        db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: new ObjectId(projectId) })
    ]);

    if (!project) return { error: 'Project not found.' };
    if (!template) return { error: 'Template not found for this project.' };

    const components: any[] = [];
     if (variableMappings && variableMappings.length > 0) {
        components.push({
            type: 'body',
            parameters: variableMappings.map(m => ({
                type: 'text',
                text: `{{${m.contactField}}}`
            }))
        });
    }

    const broadcastData: Omit<Broadcast, '_id'> = {
        name: `API Broadcast - ${template.name} - ${new Date().toLocaleString()}`,
        projectId: new ObjectId(projectId),
        phoneNumberId,
        templateName: template.name,
        templateId: template._id,
        language: template.language,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        audienceType: 'api',
        accessToken: project.accessToken,
        components,
        createdAt: new Date(),
    };

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData as any);
    const broadcastId = broadcastResult.insertedId;
    
    await createBroadcastContacts(db, broadcastId, contacts);

    return { message: `Broadcast successfully queued via API for ${contacts.length} contacts. Sending will begin shortly.` };
}


export async function handleRequeueBroadcast(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const broadcastId = formData.get('broadcastId') as string;
    const requeueScope = formData.get('requeueScope') as 'ALL' | 'FAILED';
    const newTemplateId = formData.get('templateId') as string;
    const headerImageUrl = formData.get('headerImageUrl') as string | null;

    if(!broadcastId) return { error: 'Original broadcast ID is missing.' };

    const { db } = await connectToDatabase();
    const originalBroadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(broadcastId) });
    if (!originalBroadcast) return { error: 'Original broadcast not found.' };
    
    const projectId = originalBroadcast.projectId.toString();
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const templateId = newTemplateId || originalBroadcast.templateId.toString();
    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Template not found.' };
    
    const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
    if (requeueScope === 'FAILED') {
        filter.status = 'FAILED';
    }

    const contacts = await db.collection('broadcast_contacts').find(filter).toArray();
    if (contacts.length === 0) {
        return { error: 'No contacts found to requeue.' };
    }

    const components: any[] = [];
    if(headerImageUrl) {
         const headerComponentDef = template.components?.find(c => c.type === 'HEADER');
         if (headerComponentDef?.format) {
            const format = headerComponentDef.format.toLowerCase();
            if (['image', 'video', 'document'].includes(format)) {
                const parameter: any = { type: format };
                parameter[format] = { link: headerImageUrl };
                components.push({ type: 'header', parameters: [parameter] });
            }
        }
    }
    
    const newBroadcastData: Omit<Broadcast, '_id'> = {
        ...originalBroadcast,
        name: `${originalBroadcast.name} (Requeued)`,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        successCount: 0,
        errorCount: 0,
        startedAt: undefined,
        completedAt: undefined,
        createdAt: new Date(),
        components: headerImageUrl ? components : originalBroadcast.components,
    };
    delete (newBroadcastData as any)._id;

    const newBroadcastResult = await db.collection('broadcasts').insertOne(newBroadcastData as any);
    await createBroadcastContacts(db, newBroadcastResult.insertedId, contacts);

    revalidatePath('/dashboard/broadcasts');
    return { message: `${contacts.length} contacts have been re-queued for broadcast.` };
}

export async function handleStopBroadcast(broadcastId: string): Promise<{ message?: string; error?: string }> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) {
        return { error: 'Invalid Broadcast ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('broadcasts').updateOne(
            { _id: new ObjectId(broadcastId), status: { $in: ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'] } },
            { $set: { status: 'Cancelled' } }
        );
        if (result.matchedCount === 0) {
            return { error: 'Broadcast not found or has already completed/failed.' };
        }
        revalidatePath('/dashboard/broadcasts');
        return { message: 'Broadcast has been cancelled.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}
