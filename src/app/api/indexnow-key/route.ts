import { NextResponse } from 'next/server';
import { IndexNowClient } from '@/lib/seo/indexnow-client';

export async function GET() {
    // This route can be used to verify the key.
    // If we map /:key.txt to this, it works.
    const key = IndexNowClient.getKey();
    return new NextResponse(key, {
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}
