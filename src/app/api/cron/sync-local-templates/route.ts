

'use client';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { Project, Template } from '@/lib/definitions';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';
const BATCH_SIZE = 10; // Process 10 templates per cron run to avoid timeouts

async function getMediaHandleForDataUri(dataUri: string, accessToken: string, appId: string): Promise<string> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    const sessionUrl = `https://graph.facebook.com/${API_VERSION}/${appId}/uploads?file_length=${buffer.length}&file_type=${blob.type}&access_token=${accessToken}`;
    const sessionResponse = await axios.post(sessionUrl, {});
    const uploadSessionId = sessionResponse.data.id;

    const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${uploadSessionId}`;
    const uploadResponse = await axios.post(uploadUrl, buffer, { headers: { Authorization: `OAuth ${accessToken}` } });
    
    return uploadResponse.data.h;
}

async function submitTemplateToMeta(project: WithId<Project>, template: WithId<Template>) {
    // The project's main 'accessToken' should be the long-lived System User token.
    const { wabaId, accessToken, appId } = project;

    if (!wabaId || !accessToken || !appId) {
        throw new Error(`Project ${project._id} is missing required credentials (WABA ID, App ID, or Access Token).`);
    }

    const components = [...template.components];

    // Handle header media from data URI if it exists
    if (template.headerMediaDataUri) {
        const headerComponentIndex = components.findIndex(c => c.type === 'HEADER');
        if (headerComponentIndex > -1) {
            try {
                const handle = await getMediaHandleForDataUri(template.headerMediaDataUri, accessToken, appId);
                components[headerComponentIndex].example = { header_handle: [handle] };
            } catch (uploadError) {
                 console.error(`Media upload failed for template ${template.name}`, uploadError);
                throw new Error(`Media upload failed: ${getErrorMessage(uploadError)}`);
            }
        }
    }
    
    const payload = {
        name: template.name,
        language: template.language,
        category: template.category,
        allow_category_change: true,
        components: components,
    };

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
            payload,
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
        
        return response.data;
    } catch(error: any) {
        // Re-throw the original error object to preserve all details from Meta
        throw error;
    }
}


async function handleSync() {
    let db;
    try {
        const conn = await connectToDatabase();
        db = conn.db;
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const templatesToProcess = await db.collection<WithId<Template>>('templates').find({ 
             $or: [
                { status: 'LOCAL' },
                { 
                    status: 'FAILED_SUBMISSION',
                    $or: [
                        { lastSubmissionAttemptAt: { $exists: false } },
                        { lastSubmissionAttemptAt: { $lt: oneHourAgo } }
                    ]
                }
            ]
        }).limit(BATCH_SIZE).toArray();

        if (templatesToProcess.length === 0) {
            return NextResponse.json({ message: 'No local or eligible failed templates found to sync.' });
        }
        
        const projectIds = [...new Set(templatesToProcess.map(t => t.projectId.toString()))];
        const projects = await db.collection<WithId<Project>>('projects').find({ _id: { $in: projectIds.map(id => new ObjectId(id)) } }).toArray();
        const projectsMap = new Map(projects.map(p => [p._id.toString(), p]));
        
        let successCount = 0;
        let failureCount = 0;
        const errors = [];
        let firstPayloadString: string | null = null;

        for (const template of templatesToProcess) {
            const project = projectsMap.get(template.projectId.toString());
            if (!project) {
                failureCount++;
                const errorMsg = `Template "${template.name}" on Project ID ${template.projectId}: Project not found`;
                errors.push(errorMsg);
                await db.collection('templates').updateOne({ _id: template._id }, { $set: { status: 'FAILED_SUBMISSION', error: 'Project not found', lastSubmissionAttemptAt: new Date() } });
                continue;
            }
            
            const payloadForDebug = { name: template.name, language: template.language, category: template.category, allow_category_change: true, components: template.components, };
            if (!firstPayloadString) {
                firstPayloadString = JSON.stringify(payloadForDebug, null, 2);
            }

            try {
                const metaResponse = await submitTemplateToMeta(project, template);
                
                await db.collection('templates').updateOne(
                    { _id: template._id },
                    { $set: { status: metaResponse.status || 'PENDING', metaId: metaResponse.id, error: null, lastSubmissionAttemptAt: new Date(), headerMediaDataUri: null } }
                );
                successCount++;
            } catch (e: any) {
                const errorMessage = getErrorMessage(e);
                failureCount++;
                errors.push(`Template "${template.name}": ${errorMessage}`);
                
                let finalStatus: Template['status'] = 'FAILED_SUBMISSION';
                 if (errorMessage.includes('account restricted')) {
                    // Don't change status to REJECTED, keep it as FAILED_SUBMISSION but mark the project
                    await db.collection('projects').updateOne({ _id: project._id }, { $set: { banState: 'RESTRICTED' }});
                }

                 await db.collection('templates').updateOne(
                    { _id: template._id },
                    { $set: { status: finalStatus, error: errorMessage, lastSubmissionAttemptAt: new Date() } }
                );
            }
        }
        
        let message = `Sync complete for batch. ${successCount} submitted, ${failureCount} failed.`;
        if (errors.length > 0) {
            message += `\nErrors: ${errors.join('; ')}`;
        }

        if (firstPayloadString) {
            message += `\n\nDEBUG PAYLOAD (First Template):\n${firstPayloadString}`;
        }

        return NextResponse.json({ message });

    } catch (error: any) {
        console.error('Error in sync-local-templates cron job:', error);
        return new NextResponse(`Internal Server Error: ${getErrorMessage(error)}`, { status: 500 });
    }
}


export async function POST(request: Request) {
    return handleSync();
}

export async function GET(request: Request) {
    return handleSync();
}

