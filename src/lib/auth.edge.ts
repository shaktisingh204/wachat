
'use server';

import 'server-only'
import { jwtVerify } from 'jose';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}


// This function is a lightweight check for the edge, using jose.
// It's not using Firebase Admin SDK because that's too heavy for edge functions.
export async function verifyJwtEdge(token: string): Promise<any | null> {
    console.log('[AUTH_EDGE] Verifying user JWT on edge.');
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        console.log('[AUTH_EDGE] User JWT verified successfully.');
        return payload;
    } catch (error: any) {
        console.error('[AUTH_EDGE] User JWT verification failed on edge:', error.code, error.message);
        // Re-throw JWTExpired so middleware can handle it
        if (error.code === 'ERR_JWT_EXPIRED') {
            throw error;
        }
        return null;
    }
}


export async function verifyAdminJwtEdge(token: string): Promise<any | null> {
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
