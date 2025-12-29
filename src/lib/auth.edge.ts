
'use server';

import 'server-only'
import { jwtVerify, type JWTPayload } from 'jose';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

// This function is a lightweight check for the edge.
// For user tokens (Firebase), it just checks for existence, as real verification needs the Admin SDK.
export async function verifyJwtEdge(token: string): Promise<boolean> {
    console.log('[AUTH_EDGE] Checking for presence of user JWT on edge.');
    // We will not perform cryptographic verification here for Firebase tokens
    // as it requires a heavier setup not suitable for the edge.
    // The presence of the token is enough for the middleware to let it pass to the server,
    // where `getSession` will perform the actual secure verification with Firebase Admin SDK.
    const isValid = !!token;
    console.log(`[AUTH_EDGE] User JWT presence check result: ${isValid}`);
    return isValid;
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
