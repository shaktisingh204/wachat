
'use server';

/**
 * @fileOverview High-Throughput Broadcast Scheduler
 *
 * This file contains the cron job logic that now handles the entire broadcast process.
 * Its primary responsibility is to:
 * 1. Find projects with broadcasts in the 'QUEUED' state.
 * 2. Acquire a project-level lock to ensure only one process handles its broadcast.
 * 3. Fetch 'PENDING' contacts in batches from MongoDB.
 * 4. Process these batches in parallel to maximize throughput.
 * 5. Update the status of the broadcast job and individual contacts.
 * 6. This implementation removes the dependency on Redis for queuing.
 */

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import axios from 'axios';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType, Contact } from './definitions';
import { getErrorMessage } from './utils';

const API_VERSION = 'v23.0';
const DB_BATCH_SIZE = 1000; // How many contacts to fetch from DB at once
const PARALLEL_SEND_LIMIT = 500; // How many messages to send concurrently in memory

async function sendWhatsAppMessage(job: BroadcastJobType, contact: Contact) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, headerImageUrl, headerMediaId, variableMappings } = job;
        
        const getVars = (text: string | undefined): number[] => {
            if (!text) return [];
            const matches = text.match(/{{\s*(\d+)\s*}}/g);
            return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const payloadComponents: any[] = [];
        const headerComponent = components.find(c => c.type === 'HEADER');
        if (headerComponent) {
            let parameter;
            const format = headerComponent.format?.toLowerCase();
            if (headerMediaId) {
                parameter = { type: format, [format]: { id: headerMediaId } };
            } else if (headerImageUrl) {
                parameter = { type: format, [format]: { link: headerImageUrl } };
            } else if (format === 'TEXT' && headerComponent.text) {
                 const headerVars = getVars(headerComponent.text);
                 if (headerVars.length > 0) {
                     parameter = {
                        type: 'text',
                        text: interpolate(headerComponent.text, contact.variables || {})
                     }
                 }
            }

            if (parameter) payloadComponents.push({ type: 'header', parameters: [parameter] });
        }
        
        const bodyComponent = components.find(c => c.type === 'BODY');
        if (bodyComponent?.text) {
            const bodyVars = getVars(bodyComponent.text);
            if (bodyVars.length > 0) {
                const parameters = bodyVars.sort((a,b) => a-b).map(varNum => {
                    const mapping = variableMappings?.find(m => m.var === String(varNum));
                    const varKey = mapping ? mapping.value : `variable${varNum}`;
                    const value = contact.variables?.[varKey] || '';
                    return { type: 'text', text: value };
                });
                payloadComponents.push({ type: 'body', parameters });
            }
        }
        
        const messageData = {
            messaging_product: 'whatsapp', to: contact.phone, recipient_type: 'individual', type: 'template',
            template: { name: templateName, language: { code: language || 'en_US' }, ...(payloadComponents.length > 0 && { components: payloadComponents }) },
        };
        
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, messageData, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        
        const messageId = response.data?.messages?.[0]?.id;
        if (!messageId) return { success: false, error: "No message ID returned from Meta." };

        return { success: true, messageId };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        return { success: false, error: errorMessage };
    }
}

function interpolate(text: string, variables: Record<string, any>): string {
    if (!text) return '';
    return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
        const value = variables[key];
        return value !== undefined ? String(value) : match;
    });
}


export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;

        const projectsWithQueuedJobs = await db.collection('broadcasts').distinct('projectId', { status: 'QUEUED' });
        if (projectsWithQueuedJobs.length === 0) {
            return { message: 'No active broadcasts to process.' };
        }

        let totalProcessed = 0;
        let jobsStarted = 0;

        for (const projectId of projectsWithQueuedJobs) {
            const lockAcquired = await db.collection('projects').findOneAndUpdate(
                { _id: projectId, lock: { $ne: true } },
                { $set: { lock: true, lockTimestamp: new Date() } }
            );

            if (!lockAcquired) {
                console.log(`Project ${projectId} is locked. Skipping.`);
                continue;
            }

            try {
                const job = await db.collection<BroadcastJobType>('broadcasts').findOne({
                    projectId: projectId,
                    status: 'QUEUED'
                }, { sort: { createdAt: 1 } });
                
                if (!job) {
                    await db.collection('projects').updateOne({ _id: projectId }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
                    continue;
                }

                await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'PROCESSING', startedAt: new Date() } });
                jobsStarted++;
                
                let pendingContacts = true;
                
                while(pendingContacts) {
                    const contacts = await db.collection('broadcast_contacts').find({
                        broadcastId: job._id,
                        status: 'PENDING'
                    }).limit(DB_BATCH_SIZE).toArray();

                    if (contacts.length === 0) {
                        pendingContacts = false;
                        continue;
                    }

                    // Process contacts in parallel chunks
                    for (let i = 0; i < contacts.length; i += PARALLEL_SEND_LIMIT) {
                        const chunk = contacts.slice(i, i + PARALLEL_SEND_LIMIT);
                        const contactPromises = chunk.map(contact => 
                            sendWhatsAppMessage(job, contact as any)
                                .then(result => ({ contactId: contact._id, ...result }))
                        );
                        
                        const results = await Promise.all(contactPromises);
                        
                        const bulkOps: any[] = [];
                        let successCount = 0;
                        let errorCount = 0;

                        for(const result of results) {
                            if (result.success) {
                                successCount++;
                                bulkOps.push({ updateOne: { filter: { _id: result.contactId }, update: { $set: { status: 'SENT', sentAt: new Date(), messageId: result.messageId, error: null } } } });
                            } else {
                                errorCount++;
                                bulkOps.push({ updateOne: { filter: { _id: result.contactId }, update: { $set: { status: 'FAILED', error: result.error } } } });
                            }
                        }

                        if (bulkOps.length > 0) {
                            await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
                        }
                        
                        await db.collection('broadcasts').updateOne({ _id: job._id }, { $inc: { successCount, errorCount }});
                        totalProcessed += chunk.length;
                    }

                    if (contacts.length < DB_BATCH_SIZE) {
                        pendingContacts = false;
                    }
                }

                await db.collection('broadcasts').updateOne({ _id: job._id }, { $set: { status: 'Completed', completedAt: new Date() } });

            } finally {
                await db.collection('projects').updateOne({ _id: projectId }, { $set: { lock: false }, $unset: { lockTimestamp: '' } });
            }
        }
        
        return { message: `Started ${jobsStarted} job(s). Total contacts processed: ${totalProcessed}.` };

    } catch (error: any) {
        console.error("Cron scheduler failed:", error);
        throw new Error(`Cron scheduler failed: ${error.message}`);
    }
}
