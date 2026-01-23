
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/lib/mongodb';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
    const sessionToken = request.cookies.get('session')?.value;
    
    if (sessionToken) {
        try {
            const { payload } = await jwtVerify(sessionToken, getJwtSecretKey());
            // If the token has a "jti" (JWT ID), add it to a denylist.
            if (payload.jti && payload.exp) {
                const { db } = await connectToDatabase();
                await db.collection('revoked_tokens').insertOne({
                    jti: payload.jti,
                    expiresAt: new Date(payload.exp * 1000), // exp is in seconds
                });
                console.log(`[LOGOUT] Revoked user token JTI: ${payload.jti}`);
            }
        } catch (error) {
            // This catches expired tokens, invalid signatures etc.
            // We can just proceed with logout.
            console.warn('[LOGOUT] Error revoking user token (it may be expired/invalid):', error);
        }
    }

    // Redirect to the login page.
    const response = NextResponse.redirect(new URL('/login', request.url));
    
    // Clear the session cookie regardless of whether token revocation worked.
    response.cookies.set({
        name: 'session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
