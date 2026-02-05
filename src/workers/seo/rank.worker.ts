import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { DataForSeoClient } from '@/lib/seo/data-for-seo-client';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const rankWorker = new Worker('seo-rank-queue', async (job: Job) => {
    // 1. Fetch Resources
    const { db } = await connectToDatabase();

    // Default mode: Refresh Single Keyword Live
    if (job.name === 'refresh-keyword') {
        const { keywordId, projectId } = job.data;

        // 0. Credit Check (Cost: 1 per keyword)
        const COST = 1;
        const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
        if (!project) throw new Error("Project not found");

        const user = await db.collection('users').findOne({ _id: project.userId });
        if (!user || (user.credits?.seo ?? 0) < COST) {
            console.error(`[Rank] Insufficient credits for user ${project.userId}`);
            return; // Skip silently or fail job
        }

        // Deduct
        await db.collection('users').updateOne(
            { _id: user._id },
            { $inc: { 'credits.seo': -COST } }
        );

        const keywordDoc = await db.collection('seo_keywords').findOne({ _id: new ObjectId(keywordId) });

        if (!keywordDoc) throw new Error("Keyword not found");

        console.log(`[RankWorker] Refreshing: ${keywordDoc.keyword}`);

        // Get Live Data
        const serp = await DataForSeoClient.getSerpLive(keywordDoc.keyword, parseInt(keywordDoc.location));

        // Extract Rank
        let newRank = 0;
        let url = '';

        // Get Domain
        // const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
        // if (!project) throw new Error("Project not found");

        if (serp.tasks?.[0]?.result?.[0]?.items) {
            const items = serp.tasks[0].result[0].items;
            for (const item of items) {
                // Feature: Position Zero Detection
                if (item.rank_group === 0) {
                    // We found a featured snippet!
                    // Check if it's OURS or Competitor
                }

                if (item.type === 'organic' && item.domain && item.domain.includes(project.domain)) {
                    newRank = item.rank_group;
                    url = item.url; // Use item.url directly
                    break;
                }
            }
        }

        // Update DB
        await db.collection('seo_keywords').updateOne(
            { _id: new ObjectId(keywordId) },
            {
                $set: {
                    currentRank: newRank,
                    lastUpdated: new Date()
                },
                $push: {
                    history: {
                        date: new Date(),
                        rank: newRank,
                        volume: keywordDoc.currentVolume || 0, // Keep existing volume
                        url: url
                    }
                }
            } as any
        );

        console.log(`[RankWorker] Updated ${keywordDoc.keyword} -> Rank ${newRank}`);
    }

}, { connection, concurrency: 5 });
