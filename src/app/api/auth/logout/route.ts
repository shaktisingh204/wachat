
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (sessionToken) {
        try {
            const payload = decodeJwt(sessionToken);
            if (payload && payload.jti && payload.exp) {
                const { db } = await connectToDatabase();
                await db.collection('revoked_tokens').insertOne({
                    jti: payload.jti,
                    expireAt: new Date(payload.exp * 1000), // exp is in seconds, Date needs ms
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
