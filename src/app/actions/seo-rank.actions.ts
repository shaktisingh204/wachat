'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { SeoKeyword, SeoProject } from '@/lib/seo/definitions';
import { DataForSeoClient } from '@/lib/seo/data-for-seo-client';
import { ObjectId } from 'mongodb';
// We'll add the queue later once the worker is set up
// import { seoRankQueue } from '@/workers/seo/bullmq-setup';

export async function addKeyword(projectId: string, keyword: string, location: string = '2840') {
    const { db } = await connectToDatabase();

    // 1. Check if exists
    const existing = await db.collection('seo_keywords').findOne({
        projectId: new ObjectId(projectId),
        keyword: keyword
    });

    if (existing) return { error: "Keyword already tracked" };

    // 2. Fetch Initial Data (Live)
    let rank = 0;
    let volume = 0;
    let difficulty = 0;
    let url = '';

    try {
        // Parallel Fetch
        const [serpRes, volRes] = await Promise.all([
            DataForSeoClient.getSerpLive(keyword, parseInt(location)),
            DataForSeoClient.getVolumeLive([keyword], parseInt(location))
        ]);

        // Process SERP
        if (serpRes.tasks?.[0]?.result?.[0]?.items) {
            const project = await db.collection<SeoProject>('seo_projects').findOne({ _id: new ObjectId(projectId) });
            const domain = project?.domain || '';

            // Simple Rank Find
            const items = serpRes.tasks[0].result[0].items;
            for (const item of items) {
                if (item.type === 'organic' && item.domain && item.domain.includes(domain)) {
                    rank = item.rank_group;
                    url = item.url;
                    break;
                }
            }
        }

        // Process Volume
        if (volRes.tasks?.[0]?.result?.[0]) {
            volume = volRes.tasks[0].result[0].search_volume || 0;
            difficulty = volRes.tasks[0].result[0].competition || 0; // Competition index as proxy
        }

    } catch (e) {
        console.error("Initial Data Fetch Failed", e);
        // Continue adding keyword anyway
    }

    // 3. Save to DB
    const newKeyword: SeoKeyword = {
        _id: new ObjectId(),
        projectId: new ObjectId(projectId),
        keyword,
        location,
        currentRank: rank,
        currentVolume: volume,
        currentDifficulty: difficulty,
        history: [{
            date: new Date(),
            rank: rank,
            volume: volume,
            // url prop handles URL tracking if needed in history, simplified here
            cpc: 0
        }],
        lastUpdated: new Date(),
        createdAt: new Date()
    };

    await db.collection('seo_keywords').insertOne(newKeyword);
    return { success: true };
}

export async function getKeywords(projectId: string) {
    const { db } = await connectToDatabase();
    // Sort by Rank (Ascending 1-100), then untracked (0) at bottom? 
    // Usually Rank 1 is top. 0 means not found.
    // Let's just sort by Created for now.
    const keywords = await db.collection('seo_keywords')
        .find({ projectId: new ObjectId(projectId) })
        .sort({ createdAt: -1 })
        .toArray();

    return JSON.parse(JSON.stringify(keywords));
}

export async function deleteKeyword(keywordId: string) {
    const { db } = await connectToDatabase();
    await db.collection('seo_keywords').deleteOne({ _id: new ObjectId(keywordId) });
    return { success: true };
}
