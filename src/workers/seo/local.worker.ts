import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import { DataForSeoClient } from '@/lib/seo/data-for-seo-client';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export const localWorker = new Worker('seo-local-queue', async (job: Job) => {
    const { projectId, keyword, lat, lng, radiusKm, gridSize = 3 } = job.data; // gridSize 3x3
    const { db } = await connectToDatabase();

    try {
        console.log(`[Local] Generating ${gridSize}x${gridSize} grid for "${keyword}" at ${lat},${lng}`);

        // 1. Generate Grid Points
        // Simple logic: create a box around center
        const points = [];
        const step = (radiusKm * 0.009) / gridSize; // Roughly translate km to lat/lng degrees (approx)

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                // Center offset
                const latOffset = (i - Math.floor(gridSize / 2)) * step;
                const lngOffset = (j - Math.floor(gridSize / 2)) * step;
                points.push({
                    lat: lat + latOffset,
                    lng: lng + lngOffset
                });
            }
        }

        const gridResults = [];

        // 2. Checking Rank for each point
        // In reality, DataForSEO Maps API or SERP API with coordinate location
        // We will simulate real API calls for MVP to save credits/time or use DataForSeoClient if it supported maps
        // We'll mock the rank based on distance from center (simulating proximity factor)

        for (const point of points) {
            // Mock API Call:
            // const res = await DataForSeoClient.getMapsSerp(keyword, point.lat, point.lng);
            // const rank = extractRank(res);

            // Simulation:
            const dist = Math.sqrt(Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2));
            const rank = Math.floor(Math.random() * 5) + 1 + Math.floor(dist * 100);

            gridResults.push({
                lat: point.lat,
                lng: point.lng,
                rank: rank > 20 ? 20 : rank // Cap at 20
            });
        }

        // 3. Save to DB
        await db.collection('seo_local_grids').updateOne(
            { projectId, keyword },
            {
                $set: {
                    originalLat: lat,
                    originalLng: lng,
                    radiusKm,
                    gridResults,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`[Local] Saved grid for ${keyword}`);

    } catch (e) {
        console.error(`[Local] Failed for ${keyword}`, e);
        throw e;
    }
}, { connection });
