
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import type { Project, BroadcastJob, BroadcastState, Template, MetaFlow, Contact } from '@/lib/definitions';

const BATCH_SIZE = 1000;

const processContactBatch = async (db: Db, broadcastId: ObjectId, batch: Partial<Contact>[], variablesFromColumn: boolean = true) => {
    if (batch.length === 0) return 0;
    
    const contactsToInsert = batch.map(row => {
        let phone;
        let variables: Record<string, any>;

        if (variablesFromColumn) {
            const keys = Object.keys(row as any);
            phone = keys.length > 0 ? (row as any)[keys[0]] : null;
            variables = { ...row };
            if (keys.length > 0) delete (variables as any)[keys[0]];
        } else {
            phone = row.waId;
            variables = row.variables || {};
        }
        
        if (!phone) return null;
        
        return {
            broadcastId,
            phone: String(phone).trim().replace(/\D/g, ''),
            variables,
            status: 'PENDING' as const,
            createdAt: new Date(),
        };
    }).filter(Boolean);

    // OPT-OUT CHECK REMOVED: This is now handled by the cron sender for better performance.

    if (contactsToInsert.length > 0) {
        try {
            await db.collection('broadcast_contacts').insertMany(contactsToInsert as any[], { ordered: false });
        } catch(err: any) {
            // Non-fatal error for duplicate keys, which we can ignore.
            if (err.code !== 11000) { 
                console.warn("Bulk insert for broadcast contacts failed.", err.code);
            }
        }
    }
    
    return contactsToInsert.length;
};


const processStreamedContacts = (inputStream: NodeJS.ReadableStream | string, db: Db, broadcastId: ObjectId): Promise<number> => {
    return new Promise<number>((resolve, reject) => {
        let contactBatch: any[] = [];
        let totalProcessedCount = 0;
        
        Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            step: (results, parser) => {
                contactBatch.push(results.data);
                if (contactBatch.length >= BATCH_SIZE) {
                    parser.pause(); 
                    processContactBatch(db, broadcastId, contactBatch, true)
                        .then(processedInBatch => {
                            totalProcessedCount += processedInBatch;
                            contactBatch = [];
                            parser.resume();
                        })
                        .catch(err => reject(err));
                }
            },
            complete: async () => {
                try {
                     if (contactBatch.length > 0) {
                        const processedInBatch = await processContactBatch(db, broadcastId, contactBatch, true);
                        totalProcessedCount += processedInBatch;
                    }
                    resolve(totalProcessedCount);
                } catch(e) {
                    reject(e);
                }
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
    const mediaSource = formData.get('mediaSource') as 'url' | 'file';
    const audienceType = formData.get('audienceType') as 'file' | 'tags';
    const tagIds = formData.getAll('tagIds') as string[];

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

    let contactFileName = 'From Tags';
    if(audienceType === 'file') {
        const contactFile = formData.get('csvFile') as File;
        if (!contactFile || contactFile.size === 0) return { error: 'Please upload a contact file.' };
        contactFileName = contactFile.name;
    } else {
        if(!tagIds || tagIds.length === 0) return { error: 'Please select at least one contact tag.'};
    }
    
    let broadcastJobData: Omit<WithId<BroadcastJob>, '_id'>;
    const projectObjectId = new ObjectId(projectId);
    
    const templateId = formData.get('templateId') as string;
    if (!templateId) return { error: 'Please select a message template.' };
    if (!ObjectId.isValid(templateId)) return { error: 'Invalid Template ID.' };

    const template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: projectObjectId });
    if (!template) return { error: 'Selected template not found for this project.' };

    let headerMediaId: string | undefined = undefined;
    let headerImageUrl: string | undefined = undefined;

    const templateHasMediaHeader = template.components?.some((c: any) => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));
    
    if (templateHasMediaHeader) {
        if (mediaSource === 'file') {
            const mediaFile = formData.get('headerImageFile') as File;
            if (!mediaFile || mediaFile.size === 0) return { error: 'Please upload a media file for this template header.' };
            
            const form = new FormData();
            const buffer = Buffer.from(await mediaFile.arrayBuffer());
            form.append('file', buffer, {
                filename: mediaFile.name, contentType: mediaFile.type,
            });
            form.append('messaging_product', 'whatsapp');
            
            const uploadResponse = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, form, { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${accessToken}` } });
            const mediaId = uploadResponse.data.id;
            if (!mediaId) return { error: 'Failed to upload media to Meta. No ID returned.' };
            headerMediaId = mediaId;

        } else { 
            const overrideUrl = formData.get('headerImageUrl') as string | null;
            if (overrideUrl && overrideUrl.trim() !== '') {
                headerImageUrl = overrideUrl.trim();
            } else {
                return { error: 'A public media URL is required for this template.' };
            }
        }
    }
    
    const variableMappings = (JSON.parse(formData.get('variableMappings') as string || '[]')) as any[];

    broadcastJobData = {
        projectId: projectObjectId,
        broadcastType: 'template',
        templateId: new ObjectId(templateId),
        templateName: template.name,
        phoneNumberId,
        accessToken,
        status: 'QUEUED',
        createdAt: new Date(),
        contactCount: 0,
        fileName: contactFileName,
        components: template.components,
        language: template.language,
        headerImageUrl: headerImageUrl,
        headerMediaId: headerMediaId,
        category: template.category,
        variableMappings: variableMappings
    };

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastJobData as any);
    broadcastId = broadcastResult.insertedId;

    let contactCount = 0;
    
    if (audienceType === 'tags') {
        const contactsCursor = db.collection('contacts').find({
            projectId: projectObjectId,
            tagIds: { $in: tagIds },
        });

        let contactBatch: Partial<Contact>[] = [];
        for await (const contact of contactsCursor) {
            contactBatch.push(contact);
            if (contactBatch.length >= BATCH_SIZE) {
                const processedInBatch = await processContactBatch(db, broadcastId, contactBatch, false);
                contactCount += processedInBatch;
                contactBatch = [];
            }
        }
        if (contactBatch.length > 0) {
            const processedInBatch = await processContactBatch(db, broadcastId, contactBatch, false);
            contactCount += processedInBatch;
        }

    } else { // audienceType is 'file'
        const contactFile = formData.get('csvFile') as File;
        if (!contactFile || contactFile.size === 0) {
            await db.collection('broadcasts').deleteOne({ _id: broadcastId });
            return { error: 'Please upload a contact file.' };
        }

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
    }


    if (contactCount === 0) {
        await db.collection('broadcasts').deleteOne({ _id: broadcastId });
        return { error: 'No valid contacts with phone numbers found to send to.' };
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
    return { error: getErrorMessage(e) || 'An unexpected error occurred while processing the broadcast.' };
  }
}
