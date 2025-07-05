
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
import type { Project, BroadcastJob, BroadcastState, Template, MetaFlow } from '@/lib/definitions';

const BATCH_SIZE = 5000;

const processContactBatch = async (db: Db, broadcastId: ObjectId, project: WithId<Project>, batch: any[]) => {
    if (batch.length === 0) return 0;

    const phoneColumnHeader = Object.keys(batch[0])[0];
    if (!phoneColumnHeader) {
        throw new Error("CSV file appears to be missing a header row or has no columns.");
    }

    let contactsToInsert = batch.map(row => {
        const phone = String(row[phoneColumnHeader] || '').trim();
        if (!phone) return null;
        const { [phoneColumnHeader]: _, ...variables } = row;
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
            if (err.code !== 11000) { 
                console.warn("Bulk insert for broadcast contacts failed.", err.code);
            }
        });
    }
    
    return contactsToInsert.length;
};


const processStreamedContacts = (inputStream: NodeJS.ReadableStream | string, db: Db, broadcastId: ObjectId, project: WithId<Project>): Promise<number> => {
    return new Promise<number>((resolve, reject) => {
        let contactBatch: any[] = [];
        let totalProcessedCount = 0;
        
        Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            step: (results, parser) => {
                contactBatch.push(results.data as Record<string, string>);
                if (contactBatch.length >= BATCH_SIZE) {
                    parser.pause(); 
                    processContactBatch(db, broadcastId, project, contactBatch)
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
                        const processedInBatch = await processContactBatch(db, broadcastId, project, contactBatch);
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
    const broadcastType = formData.get('broadcastType') as 'template' | 'flow';
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

    if(broadcastType === 'flow') {
        const metaFlowId = formData.get('metaFlowId') as string;
        if (!metaFlowId) return { error: 'Please select a Meta Flow.' };
        if (!ObjectId.isValid(metaFlowId)) return { error: 'Invalid Meta Flow ID.' };
        const flow = await db.collection<MetaFlow>('meta_flows').findOne({ _id: new ObjectId(metaFlowId), projectId: projectObjectId });
        if (!flow) return { error: 'Selected flow not found for this project.' };

        broadcastJobData = {
            projectId: projectObjectId,
            broadcastType: 'flow',
            metaFlowId: new ObjectId(metaFlowId),
            templateName: flow.name, 
            phoneNumberId,
            accessToken,
            status: 'QUEUED',
            createdAt: new Date(),
            contactCount: 0,
            fileName: contactFileName,
            category: 'UTILITY', 
            components: [], // Required for type, but not used for flows
            language: '', // Required for type, but not used for flows
        };

    } else { 
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
                
                const uploadResponse = await axios.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/media`, form, { headers: { ...form.getHeaders(), 'Authorization': `Bearer ${accessToken}` } });
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
    }

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastJobData as any);
    broadcastId = broadcastResult.insertedId;

    let contactCount = 0;
    
    if (audienceType === 'tags') {
        const contactsFromTags = await db.collection('contacts').find({
            projectId: projectObjectId,
            tagIds: { $in: tagIds },
            ...(project.optInOutSettings?.enabled ? { isOptedOut: { $ne: true } } : {})
        }).toArray();

        if (contactsFromTags.length > 0) {
            const contactsToInsert = contactsFromTags.map(c => ({
                broadcastId,
                phone: c.waId,
                variables: c.variables || {},
                status: 'PENDING' as const,
                createdAt: new Date()
            }));
            await db.collection('broadcast_contacts').insertMany(contactsToInsert);
            contactCount = contactsToInsert.length;
        }

    } else { // audienceType is 'file'
        const contactFile = formData.get('csvFile') as File;
        if (!contactFile || contactFile.size === 0) {
            await db.collection('broadcasts').deleteOne({ _id: broadcastId });
            return { error: 'Please upload a contact file.' };
        }

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
