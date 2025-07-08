
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import type { AdminSessionPayload } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const cookieStore = cookies();
    const adminSessionToken = cookieStore.get('admin_session')?.value;

    if (adminSessionToken) {
        try {
            const payload = jwt.decode(adminSessionToken) as AdminSessionPayload;
            if (payload && payload.jti && payload.expires) {
                const { db } = await connectToDatabase();
                await db.collection('revoked_tokens').insertOne({
                    jti: payload.jti,
                    expireAt: new Date(payload.expires),
                });
            }
        } catch (error) {
            console.error("Error during admin token revocation on logout:", error);
        }
    }

    const response = NextResponse.redirect(new URL('/admin-login', request.url));
    response.cookies.set({
        name: 'admin_session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
