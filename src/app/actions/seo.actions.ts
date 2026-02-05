'use server';

import { getSession } from './user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { SeoProject, SeoAudit, SeoKeyword } from '@/lib/seo/definitions';
import { getKeywordDataLive, getSerpLive, extractRankFromSerp } from '@/lib/seo/data-for-seo';

// --- PROJECTS ---

export async function createSeoProject(domain: string, competitors: string[] = []) {
    const session = await getSession();
    if (!session?.user) return { error: "Unauthorized" };

    try {
        const { db } = await connectToDatabase();

        const newProject: Omit<SeoProject, '_id'> = {
            userId: new ObjectId(session.user._id),
            domain,
            competitors,
            settings: {
                crawlFrequency: 'weekly',
                targetedKeywords: [],
                locations: ['2840'] // Default US
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('seo_projects').insertOne(newProject);
        revalidatePath('/dashboard/seo');
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getSeoProjects() {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection('seo_projects')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(projects));
    } catch (e) {
        return [];
    }
}

export async function getSeoProject(id: string) {
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('seo_projects').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id)
        });
        return project ? JSON.parse(JSON.stringify(project)) : null;
    } catch (e) {
        return null;
    }
}

// --- AUDITS ---

export async function startAudit(projectId: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Unauthorized" };

    try {
        const { db } = await connectToDatabase();

        const newAudit: Omit<SeoAudit, '_id'> = {
            projectId: new ObjectId(projectId),
            pages: [],
            totalScore: 0,
            startedAt: new Date(),
            status: 'pending',
            summary: { totalPages: 0, criticalIssues: 0, warningIssues: 0 }
        };

        await db.collection('seo_audits').insertOne(newAudit);
        // The background worker (src/workers/seo.worker.ts) will pick this up

        revalidatePath(`/dashboard/seo/${projectId}/audit`);
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getLatestAudit(projectId: string) {
    try {
        const { db } = await connectToDatabase();
        const audit = await db.collection('seo_audits')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ startedAt: -1 })
            .limit(1)
            .next();
        return audit ? JSON.parse(JSON.stringify(audit)) : null;
    } catch (e) {
        return null;
    }
}

// --- KEYWORDS ---

export async function addKeyword(projectId: string, keyword: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Unauthorized" };

    try {
        const { db } = await connectToDatabase();

        // 1. Fetch live data immediately (or schedule)
        // For MVP, we fetch live.
        let volume = 0;
        let rank = 0;

        try {
            const volData = await getKeywordDataLive([keyword]);
            // Parse volData... simplified for MVP
            volume = volData?.tasks?.[0]?.result?.[0]?.search_volume || 0;

            // Fetch Rank
            const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
            if (project) {
                const serpData = await getSerpLive(keyword);
                rank = extractRankFromSerp(serpData, project.domain) || 0;
            }

        } catch (apiError) {
            console.error("DataForSEO Fetch failed", apiError);
            // Continue adding keyword even if API fails, just 0 data
        }

        const newKeyword: Omit<SeoKeyword, '_id'> = {
            projectId: new ObjectId(projectId),
            keyword,
            location: '2840',
            currentRank: rank,
            currentVolume: volume,
            history: [{ date: new Date(), rank, volume }],
            lastUpdated: new Date(),
            createdAt: new Date()
        };

        await db.collection('seo_keywords').insertOne(newKeyword);
        revalidatePath(`/dashboard/seo/${projectId}/rankings`);
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getKeywords(projectId: string) {
    try {
        const { db } = await connectToDatabase();
        const keywords = await db.collection('seo_keywords')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(keywords));
    } catch (e) {
        return [];
    }
}

// --- PLACEHOLDERS (To fix build errors in legacy components) ---

export interface SiteMetrics {
    domainAuthority: number;
    organicTraffic: number;
    backlinks: number;
    keywords: number;
}

export async function getSiteMetrics(domain: string): Promise<SiteMetrics> {
    // TODO: Implement using DataForSEO
    return {
        domainAuthority: 45,
        organicTraffic: 12500,
        backlinks: 3400,
        keywords: 890
    };
}

export async function getBrandMentions(brandName: string) {
    // TODO: Implement using DataForSEO or a social search API
    return [
        { source: 'Twitter', sentiment: 'positive', text: `Great experience with ${brandName}!`, date: new Date() },
        { source: 'Reddit', sentiment: 'neutral', text: `Anyone tried ${brandName}?`, date: new Date() }
    ];
}

export async function getBacklinks(domain: string) {
    // TODO: Implement using DataForSEO
    return [
        { url: 'https://example-blog.com/top-tools', da: 50, anchor: 'Best Tools' },
        { url: 'https://tech-news.org/reviews', da: 65, anchor: domain }
    ];
}
