import { NextResponse } from 'next/server';
import { getDashboardStats, getDashboardChartData } from '@/app/actions/dashboard.actions';
import { getBroadcasts } from '@/app/actions/broadcast.actions';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    try {
        const [stats, chart, broadcastsResponse] = await Promise.all([
            getDashboardStats(projectId),
            getDashboardChartData(projectId),
            getBroadcasts(projectId, 1, 5),
        ]);

        return NextResponse.json({
            stats,
            chart,
            broadcasts: broadcastsResponse.broadcasts,
        });
    } catch (error) {
        console.error("Dashboard API error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
