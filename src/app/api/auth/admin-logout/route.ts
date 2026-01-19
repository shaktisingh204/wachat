
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
    const token = request.cookies.get('admin_session')?.value;

    if (token) {
        try {
            const { payload } = await jwtVerify(token, getJwtSecretKey());
            if (payload.jti && payload.exp) {
                const { db } = await connectToDatabase();
                // Add the token's JTI to a "deny list" until it expires
                await db.collection('revoked_tokens').insertOne({
                    jti: payload.jti,
                    expiresAt: new Date(payload.exp * 1000),
                });
                console.log(`[ADMIN-LOGOUT] Revoked admin token JTI: ${payload.jti}`);
            }
        } catch (error) {
            console.error('Error revoking admin token during logout:', error);
        }
    }

    const response = NextResponse.redirect(new URL('/admin-login', request.url));
    
    // Clear the admin session cookie
    response.cookies.delete('admin_session');
    
    return response;
}
