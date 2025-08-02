
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { Project, Template } from '@/lib/definitions';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';

async function submitTemplateToMeta(project: WithId<Project>, template: WithId<Template>) {
    const { wabaId, accessToken, appId } = project;
    if (!wabaId || !accessToken || !appId) {
        throw new Error(`Project ${project._id} is missing required credentials.`);
    }

    const payload = {
        name: template.name,
        language: template.language,
        category: template.category,
        allow_category_change: true,
        components: template.components,
    };

    const response = await axios.post(
        `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
        payload,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    
    if (response.data.error) {
        throw new Error(getErrorMessage({ response: { data: response.data } }));
    }

    return response.data;
}


export async function POST(request: Request) {
    try {
        const { db } = await connectToDatabase();
        
        const localTemplates = await db.collection<WithId<Template>>('templates').find({ status: 'LOCAL' }).toArray();

        if (localTemplates.length === 0) {
            return NextResponse.json({ message: 'No local templates found to sync.' });
        }
        
        const projectIds = [...new Set(localTemplates.map(t => t.projectId.toString()))];
        const projects = await db.collection<WithId<Project>>('projects').find({ _id: { $in: projectIds.map(id => new ObjectId(id)) } }).toArray();
        const projectsMap = new Map(projects.map(p => [p._id.toString(), p]));
        
        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        for (const template of localTemplates) {
            const project = projectsMap.get(template.projectId.toString());
            if (!project) {
                failureCount++;
                errors.push(`Project not found for template: ${template.name}`);
                continue;
            }
            
            try {
                const metaResponse = await submitTemplateToMeta(project, template);
                
                await db.collection('templates').updateOne(
                    { _id: template._id },
                    { $set: { status: metaResponse.status || 'PENDING', metaId: metaResponse.id } }
                );
                successCount++;
            } catch (e: any) {
                failureCount++;
                errors.push(`Template "${template.name}": ${e.message}`);
                 await db.collection('templates').updateOne(
                    { _id: template._id },
                    { $set: { status: 'FAILED_SUBMISSION', error: e.message } }
                );
            }
        }
        
        let message = `Sync complete. ${successCount} submitted, ${failureCount} failed.`;
        if (errors.length > 0) {
            message += `\nErrors: ${errors.join('; ')}`;
        }

        return NextResponse.json({ message });

    } catch (error: any) {
        console.error('Error in sync-local-templates cron job:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
