
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import type { SessionPayload } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (sessionToken) {
        try {
            const payload = jwt.decode(sessionToken) as SessionPayload;
            if (payload && payload.jti && payload.expires) {
                const { db } = await connectToDatabase();
                await db.collection('revoked_tokens').insertOne({
                    jti: payload.jti,
                    expireAt: new Date(payload.expires),
                });
            }
        } catch (error) {
            console.error("Error during token revocation on logout:", error);
        }
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set({
        name: 'session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
