'use server';

import { revalidatePath } from "next/cache";
import { getCachedSession } from "@/lib/server-cache";
import {
    getSabFlowsByUserId,
    getExecutionHistory,
    getExecutionById,
    getSabFlowById,
    updateExecutionHistory,
} from "@/lib/sabflow/db";
import { enqueueWorkerExecution } from '@/lib/sabflow/queue/enqueue-worker';
import type { SessionState } from '@/lib/sabflow/engine/types';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function getExecutionHistoryCollection() {
    const { db } = await connectToDatabase();
    return db.collection('sabflow_executions');
}

export async function getSabflowDashboardData(filters?: { from?: string; to?: string }) {
    const session = await getCachedSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    const userId = session.user._id;

    // Get all user flows
    const flows = await getSabFlowsByUserId(userId);
    const flowIds = flows.flatMap(f => (f._id ? [f._id.toString()] : []));
    const flowMap = flows.reduce((acc, f) => (f._id ? { ...acc, [f._id.toString()]: f.name } : acc), {} as Record<string, string>);

    if (flowIds.length === 0) {
        return {
           stats: { 
               totalExecutions: 0, 
               successRate: 0, 
               activeFlows: 0, 
               errorRate: 0 
           },
           chartData: [],
           recentActivity: []
        };
    }

    const col = await getExecutionHistoryCollection();
    
    const query: any = { flowId: { $in: flowIds } };
    
    // Default to last 24 hours if no filter provided
    const now = new Date();
    const fromDate = filters?.from ? new Date(filters.from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const toDate = filters?.to ? new Date(filters.to) : now;

    query.startedAt = { $gte: fromDate, $lte: toDate };

    // Get all documents for the timeframe to calculate stats and chart data
    const executionDocs = await col.find(query).project({ status: 1, startedAt: 1, executionTimeMs: 1, flowId: 1 }).sort({ startedAt: -1 }).toArray();
    
    const total = executionDocs.length;
    const successCount = executionDocs.filter(d => d.status === 'success' || d.status === 'completed').length;
    const failedCount = executionDocs.filter(d => d.status === 'failed' || d.status === 'error').length;
    
    const successRate = total > 0 ? (successCount / total) * 100 : 0;
    const errorRate = total > 0 ? (failedCount / total) * 100 : 0;
    
    const activeFlows = flows.filter(f => f.status === 'PUBLISHED').length;

    // Build chart data: grouping by hours for the last 24 hours or the selected range
    // We'll create bins
    const bins = 6;
    const intervalMs = (toDate.getTime() - fromDate.getTime()) / bins;
    const chartData = Array.from({ length: bins }).map((_, i) => {
        const binStart = new Date(fromDate.getTime() + i * intervalMs);
        const binEnd = new Date(fromDate.getTime() + (i + 1) * intervalMs);
        
        // Find docs in this bin
        const binDocs = executionDocs.filter(d => d.startedAt >= binStart && d.startedAt < binEnd);
        const success = binDocs.filter(d => d.status === 'success' || d.status === 'completed').length;
        const failed = binDocs.filter(d => d.status === 'failed' || d.status === 'error').length;
        
        return {
            time: binStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            success,
            failed,
            binStart: binStart.toISOString()
        };
    });

    // Recent activity (latest 10)
    const recentActivity = executionDocs.slice(0, 10).map(doc => {
        let timeAgo = '';
        const diffMs = now.getTime() - doc.startedAt.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) timeAgo = `${diffMins} mins ago`;
        else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)} hours ago`;
        else timeAgo = `${Math.floor(diffMins / 1440)} days ago`;

        return {
            id: doc._id.toString(),
            flowId: doc.flowId,
            flow: flowMap[doc.flowId] || 'Unknown Flow',
            status: doc.status,
            duration: doc.executionTimeMs ? `${(doc.executionTimeMs / 1000).toFixed(1)}s` : '-',
            time: timeAgo,
            startedAt: doc.startedAt.toISOString()
        };
    });

    return {
        stats: {
            totalExecutions: total,
            successRate,
            activeFlows,
            errorRate
        },
        chartData,
        recentActivity
    };
}

/**
 * Re-runs a finished/failed execution as a fresh run of the same flow.
 *
 * 1. Loads the prior execution + its flow and verifies the caller owns it.
 * 2. Inserts a fresh execution-history row. The row carries BOTH `_id` and
 *    an `executionId` field with the same hex so the history readers
 *    (keyed on `_id`) and the queue worker (`updateOne({ executionId })`)
 *    converge on the same document.
 * 3. Preferred path: enqueue onto the BullMQ queue the PM2 sabflow-worker
 *    consumes (`enqueueWorkerExecution`) — the same path webhook-triggered
 *    runs take, so SSE status updates work end-to-end.
 * 4. Fallback path (Redis/queue down): run `executeFlow` directly in-process
 *    from the flow's start group, seeded with the prior run's variables,
 *    and finalise the history row the same way the rerun route does.
 */
export async function retryExecution(executionId: string) {
    const session = await getCachedSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    const userId = String(session.user._id);

    // 1) Load prior execution + flow; enforce ownership.
    const prior = await getExecutionById(executionId);
    if (!prior) throw new Error("Execution not found");

    const flow = await getSabFlowById(prior.flowId);
    if (!flow) throw new Error("Flow not found");
    if (flow.userId !== userId) throw new Error("Forbidden");

    // 2) Fresh execution-history row (status 'queued' until something runs it).
    const col = await getExecutionHistoryCollection();
    const oid = new ObjectId();
    const newExecutionId = oid.toHexString();
    const now = new Date();

    const variables: Record<string, string> = Object.fromEntries(
        Object.entries(prior.variables ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    );

    await col.insertOne({
        _id: oid,
        executionId: newExecutionId,
        flowId: prior.flowId,
        projectId: userId,
        sessionId: `retry:${executionId}`,
        triggerMode: 'manual',
        retryOf: executionId,
        status: 'queued',
        startedAt: now,
        finishedAt: null,
        error: null,
        nodeCount: 0,
        createdAt: now,
        updatedAt: now,
    });

    // 3) Preferred path — push onto the BullMQ queue the PM2 worker consumes.
    try {
        await enqueueWorkerExecution({
            executionId: newExecutionId,
            flowId: prior.flowId,
            projectId: userId,
            flowSnapshot: flow,
            triggerMode: 'manual',
            triggerData: { retryOf: executionId },
            variables,
        });
        revalidatePath('/dashboard/sabflow');
        return { success: true, executionId: newExecutionId, via: 'queue' as const };
    } catch (queueErr) {
        console.warn(
            '[SABFLOW RETRY] enqueue failed — falling back to direct execution:',
            queueErr instanceof Error ? queueErr.message : queueErr,
        );
    }

    // 4) Fallback path — run the flow in-process. Dynamic imports keep the
    //    engine out of the action bundle on the happy (queued) path.
    const [{ executeFlow }, { findStartGroup }] = await Promise.all([
        import('@/lib/sabflow/engine'),
        import('@/lib/sabflow/start'),
    ]);

    const startGroup = findStartGroup(flow) ?? flow.groups?.[0];
    if (!startGroup) {
        await updateExecutionHistory(newExecutionId, {
            finishedAt: new Date(),
            status: 'error',
            error: 'Flow has no start group',
        });
        revalidatePath('/dashboard/sabflow');
        return { success: false, executionId: newExecutionId, error: 'Flow has no start group' };
    }

    const sessionState: SessionState = {
        flowId: prior.flowId,
        currentGroupId: startGroup.id,
        currentBlockIndex: 0,
        variables,
        history: [],
    };

    await updateExecutionHistory(newExecutionId, { status: 'running', startedAt: new Date() });
    const startedAt = Date.now();

    try {
        const result = await executeFlow(flow, sessionState, undefined, newExecutionId);
        const durationMs = Date.now() - startedAt;
        await updateExecutionHistory(newExecutionId, {
            finishedAt: new Date(),
            status: result.result.isCompleted ? 'success' : 'running',
            nodeCount: result.updatedSession.history.length,
            executionTimeMs: durationMs,
            variables: result.result.updatedVariables as Record<string, unknown>,
            nodes: result.updatedSession.history
                .filter((step) => step.blockId !== '__end__')
                .map((step) => ({
                    blockId: step.blockId,
                    blockType: step.blockType,
                    status: step.status ?? 'success',
                    startedAt: step.startedAt,
                    finishedAt: step.startedAt
                        ? new Date((step.startedAt as Date).getTime() + (step.durationMs ?? 0))
                        : undefined,
                    durationMs: step.durationMs,
                    input: step.input,
                    output: step.output,
                    error: step.error,
                })),
        });
        revalidatePath('/dashboard/sabflow');
        return { success: true, executionId: newExecutionId, via: 'direct' as const };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[SABFLOW RETRY] direct execution failed (new=${newExecutionId}):`, err);
        await updateExecutionHistory(newExecutionId, {
            finishedAt: new Date(),
            status: 'error',
            error: message,
            executionTimeMs: Date.now() - startedAt,
        });
        revalidatePath('/dashboard/sabflow');
        return { success: false, executionId: newExecutionId, error: message };
    }
}
