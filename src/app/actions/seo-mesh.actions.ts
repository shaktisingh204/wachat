'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { SeoContentEmbedding } from '@/lib/seo/definitions';
import { ObjectId } from 'mongodb';

export async function findInternalLinkOpportunities(projectId: string, url: string) {
    const { db } = await connectToDatabase();

    // 1. Get the source page embedding
    const sourcePage = await db.collection<SeoContentEmbedding>('seo_content_embeddings').findOne({
        projectId: new ObjectId(projectId),
        url: url
    });

    if (!sourcePage) {
        return { error: "Page not vectorized yet. Waiting for embedding worker." };
    }

    // 2. Vector Search Aggregation
    // Requires Atlas Vector Search Index 'vector_index' on 'embedding' field
    const pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": sourcePage.embedding,
                "numCandidates": 50,
                "limit": 10
            }
        },
        {
            "$match": {
                "url": { "$ne": url }, // Exclude self
                "projectId": new ObjectId(projectId)
            }
        },
        {
            "$project": {
                "_id": 0,
                "url": 1,
                "title": 1,
                "score": { "$meta": "vectorSearchScore" }
            }
        }
    ];

    try {
        const results = await db.collection('seo_content_embeddings').aggregate(pipeline).toArray();
        return { success: true, matches: results };
    } catch (e: any) {
        console.error("Vector Search Failed:", e);
        return { error: "Vector Search failed. Ensure Atlas Index is configured." };
    }
}
