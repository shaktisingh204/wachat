import { MongoClient, ObjectId } from 'mongodb';
import { SeoCrawler } from '../lib/seo/crawler';
import path from 'path';
import dotenv from 'dotenv';
import { SeoAudit } from '../lib/seo/definitions';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;

if (!MONGODB_URI || !MONGODB_DB) {
    throw new Error('Missing MongoDB env variables');
}

async function startSeoWorker() {
    console.log('[SEO-WORKER] Starting...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    const crawler = new SeoCrawler();
    await crawler.init();

    console.log('[SEO-WORKER] Connected to DB and Browser launched');

    let busy = false;

    setInterval(async () => {
        if (busy) return;
        busy = true;

        try {
            // Find a pending audit
            // We use 'seo_audits' collection
            const job = await db.collection<SeoAudit>('seo_audits').findOneAndUpdate(
                { status: 'running', completedAt: { $exists: false } } as any,
                // Wait, typically we mark it as 'running' when picked up if it was 'pending'.
                // But simplified: Find 'pending', set to 'running'.
                // Let's assume the UI creates it as 'pending'.
                // Query:
                // { status: 'pending' },
                // { $set: { status: 'running', startedAt: new Date() } }
            );

            // Adjust query to find Pending jobs
            const pendingJob = await db.collection('seo_audits').findOneAndUpdate(
                { status: 'pending' },
                { $set: { status: 'running', startedAt: new Date() } },
                { returnDocument: 'after' }
            );

            if (!pendingJob) {
                busy = false;
                return;
            }

            const auditId = pendingJob._id;
            const projectId = pendingJob.projectId;

            // Fetch Project to get Domain
            const project = await db.collection('seo_projects').findOne({ _id: new ObjectId(projectId) });
            if (!project) {
                console.error(`Project not found for audit ${auditId}`);
                await db.collection('seo_audits').updateOne({ _id: auditId }, { $set: { status: 'failed' } });
                busy = false;
                return;
            }

            console.log(`[SEO-WORKER] Crawling: ${project.domain}`);

            // For MVP, just crawl the homepage. Ideally, crawl sitemap.
            // We'll simplisticly crawl the homepage.
            const domainUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;

            const result = await crawler.scanPage(domainUrl);

            const pages = [result];
            const issueCount = result.issues.length;

            // Calculate dummy score
            const score = Math.max(0, 100 - (issueCount * 10));

            await db.collection('seo_audits').updateOne(
                { _id: new ObjectId(auditId) },
                {
                    $set: {
                        status: 'completed',
                        completedAt: new Date(),
                        pages: pages,
                        totalScore: score,
                        summary: {
                            totalPages: 1,
                            criticalIssues: result.issues.filter(i => i.severity === 'critical').length,
                            warningIssues: result.issues.filter(i => i.severity === 'warning').length
                        }
                    }
                }
            );

            // Update Project Health Score
            await db.collection('seo_projects').updateOne(
                { _id: new ObjectId(projectId) },
                { $set: { healthScore: score, lastAuditDate: new Date() } }
            );

            console.log(`[SEO-WORKER] Finished ${project.domain} with score ${score}`);

        } catch (error) {
            console.error('[SEO-WORKER] Error', error);
        } finally {
            busy = false;
        }

    }, 5000);
}

startSeoWorker().catch(console.error);
