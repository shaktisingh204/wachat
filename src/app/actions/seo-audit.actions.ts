'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { SeoAudit, SeoProject } from '@/lib/seo/definitions';
import { seoAuditQueue } from '@/workers/seo/bullmq-setup';
import { ObjectId } from 'mongodb';

export async function startAudit(projectId: string) {
    const { db } = await connectToDatabase();

    const project = await db.collection<SeoProject>('seo_projects').findOne({
        _id: new ObjectId(projectId)
    });

    if (!project) {
        throw new Error('Project not found');
    }

    // 1. Create Audit Record
    const auditId = new ObjectId();
    const newAudit: SeoAudit = {
        _id: auditId,
        projectId: new ObjectId(projectId),
        pages: [], // Will be empty initially for massive crawls, or keep legacy array? 
        // For massive crawls, we should NOT store pages here. 
        // But for MVP/Compatibility, let's keep it empty and use 'audit_snapshots' collection.
        totalScore: 0,
        startedAt: new Date(),
        status: 'pending',
        summary: {
            totalPages: 0,
            criticalIssues: 0,
            warningIssues: 0
        },
        visitedPages: false
    };

    await db.collection('seo_audits').insertOne(newAudit);

    // 2. Add Job to Queue
    const domainUrl = project.domain.startsWith('http') ? project.domain : `https://${project.domain}`;

    await seoAuditQueue.add('crawl-page', {
        projectId,
        auditId: auditId.toString(),
        url: domainUrl,
        depth: 0,
        maxDepth: project.settings.crawlDepth || 2 // Default depth 2
    });

    return {
        success: true,
        auditId: auditId.toString(),
        message: 'Audit started successfully'
    };
}

export async function getAuditStatus(auditId: string) {
    const { db } = await connectToDatabase();

    const audit = await db.collection<SeoAudit>('seo_audits').findOne({
        _id: new ObjectId(auditId)
    });

    if (!audit) throw new Error("Audit not found");

    // Get snapshot count
    const crawledCount = await db.collection('audit_snapshots').countDocuments({
        auditId: new ObjectId(auditId)
    });

    // Check if jobs actve?
    // Start with basic DB status
    return {
        status: audit.status,
        crawledCount,
        summary: audit.summary
    };
}
