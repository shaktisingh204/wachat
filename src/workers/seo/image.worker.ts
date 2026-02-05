import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const imageWorker = new Worker('seo-image-queue', async (job: Job) => {
    const { projectId, url, images } = job.data; // images is array of {src, alt}
    const { db } = await connectToDatabase();

    try {
        console.log(`[Image] Analyzing ${images.length} images for ${url}`);

        const issues = [];
        for (const img of images) {
            // Check Alt Text
            if (!img.alt || img.alt.length < 5) {
                issues.push({
                    type: 'missing_alt',
                    src: img.src,
                    suggestion: 'Add descriptive alt text.'
                    // In real app, call Vision API here to suggest: "Golden Retriever playing"
                });
            }

            // Check Size (Mocked)
            // if (img.size > 100000) issues.push({ ... })
        }

        // Save Results
        if (issues.length > 0) {
            await db.collection('seo_image_audits').insertOne({
                projectId,
                url,
                issues,
                analyzedAt: new Date()
            });
        }

        console.log(`[Image] Found ${issues.length} issues`);

    } catch (e) {
        console.error(`[Image] Failed`, e);
        throw e;
    }
}, { connection });
