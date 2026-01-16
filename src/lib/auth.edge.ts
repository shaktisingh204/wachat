

'use server';

import 'server-only'
import { jwtVerify, decodeJwt, JWTExpired, type JWTPayload } from 'jose';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

// This function now checks for token expiration for Firebase tokens.
export async function verifyJwtEdge(token: string): Promise<boolean> {
    console.log('[AUTH_EDGE] Verifying user JWT on edge.');
    try {
        const payload = decodeJwt(token);
        if (!payload.exp) {
            console.error('[AUTH_EDGE] User JWT has no expiration time.');
            return false;
        }
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
            console.warn('[AUTH_EDGE] User JWT has expired.');
            throw new JWTExpired('Token expired');
        }

        console.log('[AUTH_EDGE] User JWT is not expired (signature not checked on edge).');
        return true;
    } catch (e: any) {
        console.error("[AUTH_EDGE] User JWT verification failed on edge:", e.code, e.message);
        // Re-throw so middleware can catch it.
        throw e;
    }
}


export async function verifyAdminJwtEdge(token: string): Promise<JWTPayload | null> {
    console.log('[AUTH_EDGE] Verifying admin JWT on edge.');
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (payload.role === 'admin') {
            console.log('[AUTH_EDGE] Admin JWT verified successfully.');
            return payload;
        }
        console.warn('[AUTH_EDGE] JWT verified but role is not admin.');
        return null;
    } catch(e: any) {
        console.error("[AUTH_EDGE] Admin JWT verification failed on edge:", e.code, e.message);
        // Re-throw JWTExpired so middleware can handle it
        if (e.code === 'ERR_JWT_EXPIRED') {
            throw e;
        }
        return null;
    }
}
