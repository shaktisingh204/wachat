import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { SeoContentEmbedding } from '@/lib/seo/definitions';
import { ObjectId } from 'mongodb';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const embeddingWorker = new Worker('seo-embedding-queue', async (job: Job) => {

    // job.data = { projectId, url, content, title }
    const { projectId, url, content, title } = job.data;
    const { db } = await connectToDatabase();

    try {
        if (!content || content.length < 50) {
            console.log(`[Embedding] Content too short for ${url}`);
            return;
        }

        console.log(`[Embedding] Generating vector for ${url}`);

        // Generate Vector (OpenAI)
        const embedding = await generateEmbedding(content.slice(0, 8000)); // Limit to ~2k tokens roughly

        // Simple hash for dedup (not crypto secure but fine for diff checks)
        // Actually, we'll just upsert by URL

        const doc: SeoContentEmbedding = {
            projectId: new ObjectId(projectId),
            url,
            title,
            contentHash: 'hash-placeholder', // TODO: Implement real hash if needed
            embedding,
            updatedAt: new Date()
        };

        await db.collection('seo_content_embeddings').updateOne(
            { url: url, projectId: new ObjectId(projectId) },
            { $set: doc },
            { upsert: true }
        );

        console.log(`[Embedding] Saved vector for ${url}`);

    } catch (e) {
        console.error(`[Embedding] Failed for ${url}`, e);
        throw e;
    }

}, { connection, concurrency: 3 });
