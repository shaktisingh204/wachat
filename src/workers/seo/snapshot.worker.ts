import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import puppeteer from 'puppeteer';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const snapshotWorker = new Worker('seo-snapshot-queue', async (job: Job) => {
    const { projectId, keyword, url } = job.data;
    const { db } = await connectToDatabase();

    // Use Puppeteer directly here or reuse Crawler class (better)
    // For Diffing, we want raw HTML

    console.log(`[Snapshot] Time Travel Capture for ${url}`);

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Remove scripts/styles to make diff cleaner? Maybe not.
        // Let's capture body text mostly for readable diffs.
        // Or full HTML for rigor.

        const html = await page.content();
        const text = await page.evaluate(() => document.body.innerText);

        await browser.close();

        // Save Snapshot
        await db.collection('seo_serp_snapshots').insertOne({
            projectId,
            keyword,
            url,
            html, // Ideally store in S3, storing in Mongo for MVP
            text, // Good for diffing content changes
            capturedAt: new Date()
        });

        console.log(`[Snapshot] Saved snapshot for ${url}`);

    } catch (e) {
        console.error(`[Snapshot] Failed for ${url}`, e);
        throw e;
    }
}, { connection });
