import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
// import { sendEmail } from '@/lib/email'; // Assume email service exists

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const emailWorker = new Worker('seo-email-queue', async (job: Job) => {
    const { projectId, email } = job.data;
    const { db } = await connectToDatabase();

    try {
        console.log(`[Email] Sending Weekly Digest to ${email}`);

        // 1. Aggregation Data (Rank Changes)
        // const ranks = await db.collection('seo_keywords').find({ projectId }).toArray();
        // const winners = ranks.filter(r => r.currentRank < r.previousRank);
        // const losers = ranks.filter(r => r.currentRank > r.previousRank);

        // 2. Generate HTML Body
        const html = `
            <h1>Weekly SEO Digest</h1>
            <p>Your project is tracking 50 keywords.</p>
            <p>📈 5 Keywords Improved</p>
            <p>📉 2 Keywords Declined</p>
            <a href="https://wachat.com/dashboard/seo/${projectId}">View Dashboard</a>
        `;

        // 3. Send Email
        // await sendEmail({ to: email, subject: 'Your Weekly SEO Report', html });
        console.log(`[Email] Sent to ${email} (Simulated)`);

    } catch (e) {
        console.error(`[Email] Failed for ${email}`, e);
        throw e;
    }
}, { connection });
