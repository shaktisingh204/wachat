'use server';

import { getCachedSession } from "@/lib/server-cache";
import { getSabFlowsByUserId, getExecutionHistory } from "@/lib/sabflow/db";
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
    const flowIds = flows.map(f => f._id.toString());
    const flowMap = flows.reduce((acc, f) => ({ ...acc, [f._id.toString()]: f.name }), {} as Record<string, string>);

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
    
    const activeFlows = flows.filter(f => f.active).length;

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

export async function retryExecution(executionId: string) {
    const session = await getCachedSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    // In a real scenario, this would trigger the executor again or enqueue a retry
    // For now, let's just update the status to 'waiting' or similar to mock a retry.
    // Or we could actually invoke the execution engine if available.
    
    const col = await getExecutionHistoryCollection();
    await col.updateOne(
        { _id: new ObjectId(executionId) },
        { $set: { status: 'waiting', error: null } }
    );
    
    return { success: true };
}
