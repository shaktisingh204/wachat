import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import { DataForSeoClient } from '@/lib/seo/data-for-seo-client';
// In a real app, we would import KeyManager or similar.
// For MVP, we simulate parsing SERP snippets for sentiment.

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const brandWorker = new Worker('seo-brand-queue', async (job: Job) => {
    const { projectId, brandName } = job.data;
    const { db } = await connectToDatabase();

    try {
        console.log(`[Brand] Checking mentions for ${brandName}`);

        // 1. Fetch Mentions (Simulated via SERP for now)
        // Ensure we filter out own site
        const query = `${brandName} -site:${brandName.replace(' ', '').toLowerCase()}.com`;
        const serps = await DataForSeoClient.getSerpLive(query);

        const mentions = [];

        // 2. Simple Sentiment Analysis (Mock Genkit Call)
        // Real implementation would pass snippet to LLM
        for (const item of (serps as any)) {
            const sentiment = item.title.toLowerCase().includes('scam') || item.title.toLowerCase().includes('bad')
                ? 'negative'
                : item.title.toLowerCase().includes('best') || item.title.toLowerCase().includes('great')
                    ? 'positive'
                    : 'neutral';

            mentions.push({
                url: item.url,
                title: item.title,
                snippet: item.snippet,
                sentiment,
                date: new Date()
            });
        }

        // 3. Save to DB
        await db.collection('seo_brand_mentions').updateOne(
            { projectId: projectId, brandName: brandName },
            {
                $set: {
                    lastChecked: new Date(),
                    mentions: mentions.slice(0, 50) // Keep last 50
                }
            },
            { upsert: true }
        );

        console.log(`[Brand] Saved ${mentions.length} mentions for ${brandName}`);

    } catch (e) {
        console.error(`[Brand] Failed for ${brandName}`, e);
        throw e;
    }
}, { connection });
