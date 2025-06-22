import { NextResponse } from 'next/server';
import { processBroadcastJob } from '@/lib/cron-scheduler';

async function handleRequest(request: Request) {
    try {
        const result = await processBroadcastJob();
        return NextResponse.json(result);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}


export async function GET(request: Request) {
    return handleRequest(request);
}

export async function POST(request: Request) {
    return handleRequest(request);
}
