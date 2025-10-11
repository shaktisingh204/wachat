
'use server';

/**
 * @fileOverview High-Throughput Broadcast Job Processor (Consumer)
 *
 * This file now acts as the "Consumer" in a producer-consumer pattern.
 * When triggered (e.g., by a cron job), it:
 * 1. Pulls a batch of jobs (micro-batches of contacts) from the Redis queue.
 * 2. Processes each job by sending messages via the WhatsApp API.
 * 3. Updates the database with the results.
 * This runs within the Next.js server process, suitable for serverless environments
 * and local development without requiring separate, persistent worker processes.
 */

import { config } from 'dotenv';
config();

import { connectToDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';
import { Db, ObjectId } from 'mongodb';
import type { BroadcastJob as BroadcastJobType } from './definitions';
import axios from 'axios';
import { getErrorMessage } from './utils';

const API_VERSION = 'v23.0';
const BATCH_SIZE = 1; // Number of jobs to pull from Redis queue per execution
const CONCURRENCY_LIMIT = 5; // Number of micro-batches to process in parallel

/**
 * Sends a single WhatsApp message using a pre-constructed job and contact object.
 */
async function sendWhatsAppMessage(job: BroadcastJobType, contact: any) {
    try {
        const { accessToken, phoneNumberId, templateName, language, components, headerImageUrl, headerMediaId, variableMappings } = job;
        
        const getVars = (text: string | undefined): number[] => {
            if (!text) return [];
            const matches = text.match(/{{\s*(\d+)\s*}}/g);
            return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))] : [];
        };

        const interpolate = (text: string | undefined, variables: any): string => {
            if (!text) return '';
            return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
                const value = variables[key];
                return value !== undefined ? String(value) : match;
            });
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
            } else if (format === 'text' && headerComponent.text) {
                 if (getVars(headerComponent.text).length > 0) {
                     parameter = { type: 'text', text: interpolate(headerComponent.text, contact.variables || {}) };
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


/**
 * The main function for processing broadcast jobs. It pulls jobs from Redis and processes them.
 */
export async function processBroadcastJob() {
    let db: Db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
        const redis = await getRedisClient();

        const jobStrings = await redis.lPopCount('broadcast-queue', BATCH_SIZE);
        
        if (!jobStrings || jobStrings.length === 0) {
            return { message: 'No broadcast jobs to process.' };
        }

        console.log(`[Processor] Pulled ${jobStrings.length} micro-batches from Redis queue.`);

        let totalSuccess = 0;
        let totalFailed = 0;

        const processMicroBatch = async (jobString: string) => {
            const { jobDetails, contacts } = JSON.parse(jobString);
            
            const contactPromises = contacts.map((contact: any) => 
                sendWhatsAppMessage(jobDetails, contact)
                    .then((result: any) => ({ contactId: contact._id, ...result }))
            );
            
            const results = await Promise.allSettled(contactPromises);
            
            const bulkOps = [];
            let successCount = 0;
            let errorCount = 0;

            for (const res of results) {
                if (res.status === 'fulfilled') {
                    const { contactId, success, messageId, error } = res.value;
                    if (success) {
                        successCount++;
                        bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'SENT', sentAt: new Date(), messageId, error: null } } } });
                    } else {
                        errorCount++;
                        bulkOps.push({ updateOne: { filter: { _id: new ObjectId(contactId) }, update: { $set: { status: 'FAILED', error } } } });
                    }
                } else {
                    errorCount++;
                    console.error(`[Processor] A send promise was rejected:`, res.reason);
                }
            }

            if (bulkOps.length > 0) {
                await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
            }
            
            await db.collection('broadcasts').updateOne(
                { _id: new ObjectId(jobDetails._id) },
                { $inc: { successCount, errorCount } }
            );

            // Check if the overall broadcast is complete
            const broadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(jobDetails._id) });
            if (broadcast && (broadcast.successCount || 0) + (broadcast.errorCount || 0) >= broadcast.contactCount) {
                await db.collection('broadcasts').updateOne({ _id: broadcast._id }, { $set: { status: 'Completed', completedAt: new Date() } });
            }
            
            return { successCount, errorCount };
        };
        
        // Process jobs with a concurrency limit
        const queue = [...jobStrings];
        while (queue.length > 0) {
            const batchToProcess = queue.splice(0, CONCURRENCY_LIMIT);
            const batchResults = await Promise.allSettled(batchToProcess.map(processMicroBatch));
            
            batchResults.forEach(res => {
                if (res.status === 'fulfilled') {
                    totalSuccess += res.value.successCount;
                    totalFailed += res.value.errorCount;
                } else {
                    console.error("[Processor] Critical error processing a micro-batch:", res.reason);
                }
            });
        }
        
        const message = `Processing complete. Sent: ${totalSuccess}, Failed: ${totalFailed}.`;
        console.log(`[Processor] ${message}`);
        return { message };

    } catch (error: any) {
        console.error("[Processor] Main processing function failed:", error);
        throw new Error(`Broadcast processor failed: ${error.message}`);
    }
}
