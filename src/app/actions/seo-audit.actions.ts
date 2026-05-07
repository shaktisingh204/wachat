'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { SeoAudit } from '@/lib/seo/definitions';
import { ObjectId } from 'mongodb';

import { runAuditImmediate } from './seo.actions';

/**
 * Run the audit inline via `runAuditImmediate`. The previous BullMQ job
 * pipeline relied on a worker that wasn't registered in `ecosystem.config.js`,
 * so jobs queued here never completed and the polling UI hung forever.
 *
 * `runAuditImmediate` performs the crawl synchronously, writes terminal
 * `status: 'completed'` (or `'failed'`) to `seo_audits`, and `revalidatePath`s
 * the audit subroute. It returns `{ success, auditId, message }` on success
 * or `{ error, auditId? }` on failure — we normalize both shapes here so
 * the UI's polling loop terminates correctly.
 */
export async function startAudit(projectId: string) {
    const result = await runAuditImmediate(projectId);
    if ('error' in result && result.error) {
        // Surface the failure but still return an auditId if the run created one,
        // so the UI's polling loop can read terminal status from the row.
        return {
            success: false,
            auditId: (result as any).auditId,
            error: result.error,
        };
    }
    return {
        success: true,
        auditId: (result as any).auditId,
        message: 'Audit completed.',
    };
}

export async function getAuditStatus(auditId: string) {
    const { db } = await connectToDatabase();

    const audit = await db.collection<SeoAudit>('seo_audits').findOne({
        _id: new ObjectId(auditId),
    });

    if (!audit) throw new Error('Audit not found');

    const crawledCount = await db.collection('audit_snapshots').countDocuments({
        auditId: new ObjectId(auditId),
    });

    return {
        status: audit.status,
        crawledCount,
        summary: audit.summary,
        // Surface failures in the polling response so the UI can stop spinning
        // and show the underlying problem.
        error: audit.status === 'failed' ? 'Audit failed.' : undefined,
    };
}
