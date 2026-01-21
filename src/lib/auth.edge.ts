
'use server';

import 'server-only'
// The fix is to remove JWTExpired as it is not available in the edge runtime.
import { jwtVerify, decodeJwt, type JWTPayload } from 'jose';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

// This function now checks for token expiration for Firebase tokens.
export async function verifyJwtEdge(token: string): Promise<boolean> {
    try {
        const payload = decodeJwt(token);
        if (!payload.exp) {
            return false;
        }
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
            // Instead of throwing JWTExpired, create a custom error
            // with the code the middleware expects.
            const error = new Error('Token expired');
            (error as any).code = 'ERR_JWT_EXPIRED';
            throw error;
        }

        return true;
    } catch (e: any) {
        // Re-throw so middleware can catch it.
        throw e;
    }
}


export async function verifyAdminJwtEdge(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (payload.role !== 'admin') {
            return null;
        }

        return payload;
    } catch(e: any) {
        // Re-throw JWTExpired so middleware can handle it
        if (e.code === 'ERR_JWT_EXPIRED') {
            throw e;
        }
        return null;
    }
}
