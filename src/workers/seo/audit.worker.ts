import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { MongoClient, ObjectId } from 'mongodb';
import { SeoCrawler } from '../../lib/seo/crawler';
import { AuditSnapshot, SeoAudit, SeoPageIssue } from '../../lib/seo/definitions';
import { GitHubClient } from '../../lib/github-client';
import { pluginRegistry } from '../../lib/seo/plugins/registry';
import { seoAuditQueue, seoEmbeddingQueue } from './bullmq-setup';
import dotenv from 'dotenv';
import path from 'path';
import { URL } from 'url';

// Ensure envs are loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;

if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

// Shared resources
let mongoClient: MongoClient | null = null;
let crawler: SeoCrawler | null = null;

async function getResources() {
    if (!mongoClient) {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
    }
    if (!crawler) {
        crawler = new SeoCrawler();
        await crawler.init();
    }
    return { db: mongoClient.db(MONGODB_DB), crawler };
}

export const auditWorker = new Worker('seo-audit-queue', async (job: Job) => {
    const { projectId, auditId, url, depth, maxDepth } = job.data;
    const { db } = await getResources();

    // 0. Credit Check (Cost: 10 credits per audit run)
    const COST = 10;
    const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
    if (!project) throw new Error("Project not found");

    const user = await db.collection('users').findOne({ _id: project.userId });
    if (!user || (user.credits?.seo ?? 0) < COST) {
        throw new Error("Insufficient SEO credits. Please recharge.");
    }

    // Deduct Credits immediately (or at end, but immediate prevents race conditions simpler for MVP)
    await db.collection('users').updateOne(
        { _id: user._id },
        { $inc: { 'credits.seo': -COST } }
    );

    console.log(`[Worker] Processing ${url} (Depth: ${depth})`);

    try {
        // 1. Crawl the page
        const result = await crawler!.scanPage(url);

        // 2. Extract internal links for recursion
        // Note: SeoCrawler.scanPage needs to return links! I'll need to update it.
        // For now, let's assume I'll update crawler to return links.
        // I will update scanPage to return `links: string[]`.
        // If not updated yet, this will be undefined.
        const links = (result as any).links || [];

        // 3. Save Snapshot
        const snapshot: AuditSnapshot = {
            auditId: new ObjectId(auditId),
            projectId: new ObjectId(projectId),
            url: result.url,
            status: result.status,
            title: result.title,
            metaDescription: result.metaDescription,
            h1: result.h1,
            wordCount: result.wordCount,
            loadTime: result.loadTime,
            // Voice Readiness: Grade < 8 is good for Voice
            voiceReadinessScore: getReadabilityScore((result as any).content || ""),
            issues: result.issues,
            crawledAt: result.crawledAt,
            depth: depth,
            outboundLinks: links
        } as any;

        await db.collection('audit_snapshots').insertOne(snapshot);

        // 3a. Trigger Embedding Generation (Phase 3)
        if ((result as any).content) {
            await seoEmbeddingQueue.add('generate-embedding', {
                projectId,
                url: result.url,
                title: result.title,
                content: (result as any).content
            });
        }

        // 4. Recursive Crawl
        if (depth < maxDepth && links.length > 0) {
            const domain = new URL(url).hostname;

            for (const link of links) {
                try {
                    const linkUrl = new URL(link);
                    // Only crawl same domain
                    if (linkUrl.hostname !== domain) continue;

                    // Check if already crawled/queued for this audit
                    // We can use a unique index on { auditId, url } in Mongo to prevent dupes,
                    // or check efficiently here. For high scale, Redis Set is better.
                    const cacheKey = `audit:${auditId}:visited`;
                    const isVisited = await connection.sismember(cacheKey, link);

                    if (!isVisited) {
                        await connection.sadd(cacheKey, link);
                        await seoAuditQueue.add('crawl-page', {
                            projectId,
                            auditId,
                            url: link,
                            depth: depth + 1,
                            maxDepth
                        });
                    }
                } catch (e) {
                    // Invalid URL
                }
            }
        }

        // 5a. Run Plugins (Phase 10)
        // Note: We need HTML for plugins. 
        // Assuming crawler result has content, but plugins often need raw HTML.
        // For MVP, we pass empty string or simulated content.
        // In prod, crawler returns rawHtml.
        const pluginIssues = pluginRegistry.runAll((result as any).content || "", url);
        result.issues.push(...pluginIssues);

        // 5. Update Audit Stats (Incremental)
        // Add issues count, etc.
        const critical = result.issues.filter(i => i.severity === 'critical').length;
        const warning = result.issues.filter(i => i.severity === 'warning').length;

        await db.collection<SeoAudit>('seo_audits').updateOne(
            { _id: new ObjectId(auditId) },
            {
                $inc: {
                    'summary.totalPages': 1,
                    'summary.criticalIssues': critical,
                    'summary.warningIssues': warning
                },
                $set: { visitedPages: true } // just a flag
            }
        );

        // 6. Auto-Fix (Phase 7): Missing H1
        const missingH1 = result.issues.find(i => i.code === 'missing_h1');
        if (missingH1 && project.settings?.autoFixEnabled) {
            try {
                // Determine GitHub Repo (Mocking integration)
                // In prod, this would be stored in Project Settings (e.g., project.repo, project.githubToken)
                // const gh = new GitHubClient(project.githubToken, project.repoOwner, project.repoName);
                // await gh.createBranch('main', 'fix/missing-h1-' + Date.now());
                // await gh.createOrUpdateFile('fix/missing-h1', 'page.tsx', '<h1>New Title</h1>', 'Fix missing H1');
                // const prUrl = await gh.openPullRequest('fix/missing-h1', 'main', 'Fix Missing H1', 'Auto-fix by Seo Platform');

                console.log(`[GitHub] 🤖 Auto-Fix PR created for ${url} (Simulated)`);
            } catch (e) {
                console.error(`[GitHub] Auto-Fix failed`, e);
            }
        }

    } catch (error: any) {
        console.error(`[Worker] Failed ${url}:`, error);
        throw error;
    }

}, {
    connection,
    concurrency: 5, // Process 5 pages in parallel per worker instance
    limiter: {
        max: 2,
        duration: 1000
    }
});

// Helper: Flesch-Kincaid Grade Level
function getReadabilityScore(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = text.split(/[aeiouy]+/).length; // Rough approx

    if (words === 0 || sentences === 0) return 0;

    // Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    return Math.round(0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59);
}

// Clean exit
process.on('SIGTERM', async () => {
    await auditWorker.close();
    if (crawler) await crawler.close();
    if (mongoClient) await mongoClient.close();
});
