

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, eventType } = body;

        if (!projectId || !ObjectId.isValid(projectId) || !['open', 'click'].includes(eventType)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
        
        let fieldToIncrement = '';
        if (eventType === 'open') fieldToIncrement = 'widgetSettings.stats.opens';
        if (eventType === 'click') fieldToIncrement = 'widgetSettings.stats.clicks';

        const { db } = await connectToDatabase();
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $inc: { [fieldToIncrement]: 1 } }
        );

        return NextResponse.json({ success: true }, { status: 200 });
        
    } catch (error) {
        console.error("Widget tracking error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
