
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Project, RandomizerPost } from '@/lib/definitions';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import FormData from 'form-data';

export const dynamic = 'force-dynamic';
const API_VERSION = 'v23.0';

async function publishPost(project: WithId<Project>, post: WithId<RandomizerPost>) {
    const { facebookPageId, accessToken } = project;
    
    if (!facebookPageId || !accessToken) {
        console.error(`Project ${project._id} is missing facebookPageId or accessToken.`);
        return { success: false, error: 'Project misconfigured.' };
    }

    try {
        let endpoint = `https://graph.facebook.com/${API_VERSION}/${facebookPageId}/feed`;
        let payload: any = {
            message: post.message,
            access_token: accessToken,
        };
        
        // If there's an image, we need to use the /photos endpoint
        if (post.imageUrl) {
            endpoint = `https://graph.facebook.com/${API_VERSION}/${facebookPageId}/photos`;
            payload = {
                caption: post.message,
                url: post.imageUrl,
                access_token: accessToken,
            };
        }

        await axios.post(endpoint, payload);
        return { success: true };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`Failed to publish post for project ${project._id}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function GET(request: Request) {
    try {
        const { db } = await connectToDatabase();

        const now = new Date();
        const projectsToPost = await db.collection<Project>('projects').find({
            'postRandomizer.enabled': true,
            $or: [
                { 'postRandomizer.lastPostedAt': { $exists: false } },
                { 'postRandomizer.lastPostedAt': { $lt: new Date(now.getTime() - 3600 * 1000) } } // At least 1 hour ago
            ]
        }).toArray();
        
        let postedCount = 0;
        let failedCount = 0;
        
        for (const project of projectsToPost) {
            const settings = project.postRandomizer;
            if (!settings) continue;

            const timeSinceLastPost = now.getTime() - (settings.lastPostedAt?.getTime() || 0);
            const frequencyMillis = settings.frequencyHours * 60 * 60 * 1000;

            if (timeSinceLastPost >= frequencyMillis) {
                const posts = await db.collection<RandomizerPost>('randomizer_posts').find({ projectId: project._id }).toArray();
                if (posts.length === 0) continue;

                // Select a random post
                const randomPost = posts[Math.floor(Math.random() * posts.length)];
                
                const result = await publishPost(project, randomPost);
                
                if (result.success) {
                    await db.collection('projects').updateOne(
                        { _id: project._id },
                        { $set: { 'postRandomizer.lastPostedAt': now } }
                    );
                    postedCount++;
                } else {
                    failedCount++;
                }
            }
        }

        return NextResponse.json({
            message: `Cron job finished. Published ${postedCount} posts. Failed to publish ${failedCount}.`,
            published: postedCount,
            failed: failedCount
        });

    } catch (error: any) {
        console.error('Error in post-randomizer cron job:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: Request) {
    return GET(request);
}
