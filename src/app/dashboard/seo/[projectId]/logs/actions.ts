'use server';

import { uploadToR2, buildFileKey } from '@/lib/r2';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function uploadLogFile(projectId: string, formData: FormData) {
    const file = formData.get('file') as File | null;
    
    if (!file) {
        return { success: false, error: 'No file provided' };
    }

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // 1. Stream log file to S3 bucket (R2)
        const fileKey = buildFileKey(projectId, file.name);
        await uploadToR2({
            key: fileKey,
            body: buffer,
            contentType: file.type || 'text/plain',
        });

        // The background processing is now handled by the client-side Web Worker
        // which sends the result to saveLogReport.

        return { 
            success: true, 
            message: 'File successfully streamed to S3.' 
        };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || 'Upload failed' };
    }
}

export async function saveLogReport(projectId: string, stats: any) {
    const { db } = await connectToDatabase();
    
    await db.collection('seo_log_reports').insertOne({
        projectId: new ObjectId(projectId),
        createdAt: new Date(),
        distribution: [
            { name: 'Googlebot', value: stats.googlebot, color: '#4285F4' },
            { name: 'Bingbot', value: stats.bingbot, color: '#F25022' },
            { name: 'Real Users', value: stats.realUsers, color: '#34A853' },
            { name: 'Others', value: stats.others, color: '#9AA0A6' },
        ],
        waste: {
            bot404s: stats.bot404s,
            slowResponses: stats.slowResponses
        }
    });
    
    return { success: true };
}

export async function getLogReport(projectId: string) {
    const { db } = await connectToDatabase();
    
    const report = await db.collection('seo_log_reports').findOne(
        { projectId: new ObjectId(projectId) },
        { sort: { createdAt: -1 } }
    );
    
    if (report) {
        return {
            distribution: report.distribution,
            waste: report.waste,
            createdAt: report.createdAt.toISOString()
        };
    }
    
    return null;
}
