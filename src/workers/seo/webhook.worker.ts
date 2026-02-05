import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const webhookWorker = new Worker('seo-webhook-queue', async (job: Job) => {
    const { projectId, event, payload } = job.data;
    const { db } = await connectToDatabase();

    try {
        console.log(`[Webhook] Processing event ${event} for ${projectId}`);

        const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
        if (!project || !project.webhooks || project.webhooks.length === 0) {
            console.log(`[Webhook] No webhooks configured for project ${projectId}. Skipping.`);
            return;
        }

        // Send to all configured webhooks
        const promises = project.webhooks.map(async (webhookUrl: string) => {
            try {
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event,
                        projectId,
                        timestamp: new Date().toISOString(),
                        data: payload
                    })
                });
                console.log(`[Webhook] Sent to ${webhookUrl}: ${res.status}`);
            } catch (e) {
                console.error(`[Webhook] Failed to send to ${webhookUrl}`, e);
            }
        });

        await Promise.all(promises);

    } catch (e) {
        console.error(`[Webhook] Worker failed`, e);
        throw e;
    }
}, { connection });
