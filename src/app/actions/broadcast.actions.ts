

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import FormData from 'form-data';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import type { Project, BroadcastJob, BroadcastState, Template, MetaFlow, Contact, BroadcastAttempt } from '@/lib/definitions';

const BATCH_SIZE = 1000;

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

const processContactBatch = async (db: Db, broadcastId: ObjectId, batch: Partial<Contact>[], variablesFromColumn: boolean = true) => {
    if (batch.length === 0) return { insertedIds: [], processedCount: 0 };
    
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
        
        const phoneStr = String(phone).trim();
        const cleanedPhone = phoneStr.startsWith('+') ? `+${phoneStr.replace(/\D/g, '')}` : phoneStr.replace(/\D/g, '');

        return {
            broadcastId,
            phone: cleanedPhone,
            variables,
            status: 'PENDING' as const,
            createdAt: new Date(),
        };
    }).filter(contact => contact && contact.phone);

    if (contactsToInsert.length === 0) {
        return { insertedIds: [], processedCount: 0 };
    }

    try {
        const result = await db.collection('broadcast_contacts').insertMany(contactsToInsert as any[], { ordered: false });
        const insertedIds = Object.values(result.insertedIds);
        return { insertedIds, processedCount: insertedIds.length };
    } catch(err: any) {
        if (err.code === 11000) { 
            const successfulIds = err.result?.insertedIds?.map((doc: any) => doc._id) || [];
            return { insertedIds: successfulIds, processedCount: successfulIds.length };
        }
        console.warn("Bulk insert for broadcast contacts failed with a non-duplicate error.", err.code);
        return { insertedIds: [], processedCount: 0 };
    }
};


const processStreamedContacts = (inputStream: NodeJS.ReadableStream | string, db: Db, broadcastId: ObjectId, redis: any): Promise<number> => {
     return new Promise<number>((resolve, reject) => {
        let contactBatch: any[] = [];
        let totalProcessedCount = 0;
        const queueName = `broadcast:${broadcastId}:queue`;
        
        const parser = Papa.parse(inputStream, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            step: async (results, stepParser) => {
                contactBatch.push(results.data);
                if (contactBatch.length >= BATCH_SIZE) {
                    stepParser.pause(); 
                    try {
                        const { insertedIds, processedCount } = await processContactBatch(db, broadcastId, contactBatch, true);
                        if (insertedIds.length > 0) {
                            await redis.rPush(queueName, insertedIds.map(id => id.toString()));
                        }
                        totalProcessedCount += processedCount;
                        contactBatch = [];
                    } catch(err) {
                        return reject(err);
                    } finally {
                        stepParser.resume();
                    }
                }
            },
            complete: async () => {
                try {
                     if (contactBatch.length > 0) {
                        const { insertedIds, processedCount } = await processContactBatch(db, broadcastId, contactBatch, true);
                        if (insertedIds.length > 0) {
                           await redis.rPush(queueName, insertedIds.map(id => id.toString()));
                        }
                        totalProcessedCount += processedCount;
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
  const redis = await getRedisClient();

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
                const { insertedIds, processedCount } = await processContactBatch(db, broadcastId, contactBatch, false);
                if (insertedIds.length > 0) {
                    await redis.rPush(`broadcast:${broadcastId}:queue`, insertedIds.map(id => id.toString()));
                }
                contactCount += processedCount;
                contactBatch = [];
            }
        }
        if (contactBatch.length > 0) {
            const { insertedIds, processedCount } = await processContactBatch(db, broadcastId, contactBatch, false);
            if (insertedIds.length > 0) {
                await redis.rPush(`broadcast:${broadcastId}:queue`, insertedIds.map(id => id.toString()));
            }
            contactCount += processedCount;
        }

    } else { // audienceType is 'file'
        const contactFile = formData.get('csvFile') as File;
        if (!contactFile || contactFile.size === 0) {
            await db.collection('broadcasts').deleteOne({ _id: broadcastId });
            return { error: 'Please upload a contact file.' };
        }

        if (contactFile.name.endsWith('.csv')) {
            const nodeStream = Readable.fromWeb(contactFile.stream() as any);
            contactCount = await processStreamedContacts(nodeStream, db, broadcastId, redis);
        } else if (contactFile.name.endsWith('.xlsx')) {
            const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new Error('The XLSX file contains no sheets.');
            }
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet, { raw: false });
            contactCount = await processStreamedContacts(csvData, db, broadcastId, redis);
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
        try {
            const redis = await getRedisClient();
            await redis.del(`broadcast:${broadcastId}:queue`);
        } catch (redisError) {
            console.error(`Failed to clean up Redis queue for cancelled broadcast ${broadcastId}:`, redisError);
        }
    }
    return { error: getErrorMessage(e) || 'An unexpected error occurred while processing the broadcast.' };
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

        const matchCriteria = {
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

        // Clear Redis queue as well
        try {
            const redis = await getRedisClient();
            await redis.del(`broadcast:${broadcastId}:queue`);
        } catch (redisError) {
            console.error(`Could not clear Redis queue for stopped broadcast ${broadcastId}:`, redisError);
        }

        revalidatePath('/dashboard/broadcasts');

        return { message: `Broadcast has been stopped. ${deleteResult.deletedCount} pending messages were cancelled.` };
    } catch (e: any) {
        console.error('Failed to stop broadcast:', e);
        return { error: e.message || 'An unexpected error occurred while stopping the broadcast.' };
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
    const redis = await getRedisClient();
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
            contactCount: 0, 
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
        let contactIdsToQueueInRedis: string[] = [];

        for await (const contact of originalContactsCursor) {
            const newContact = {
                broadcastId: newBroadcastId,
                phone: contact.phone,
                variables: contact.variables,
                status: 'PENDING' as const,
                createdAt: new Date(),
            };
            contactBatch.push(newContact);

            if (contactBatch.length >= contactBatchSize) {
                const result = await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
                const insertedIds = Object.values(result.insertedIds).map(id => id.toString());
                contactIdsToQueueInRedis.push(...insertedIds);
                newContactsCount += insertedIds.length;
                contactBatch = [];
            }
        }
        
        if (contactBatch.length > 0) {
            const result = await db.collection('broadcast_contacts').insertMany(contactBatch, { ordered: false });
            const insertedIds = Object.values(result.insertedIds).map(id => id.toString());
            contactIdsToQueueInRedis.push(...insertedIds);
            newContactsCount += insertedIds.length;
        }

        if (contactIdsToQueueInRedis.length > 0) {
            await redis.rPush(`broadcast:${newBroadcastId}:queue`, contactIdsToQueueInRedis);
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
        return { error: 'An unexpected error occurred while requeuing the broadcast.' };
    }
}

    