'use server';

import 'server-only'
import { jwtVerify } from 'jose';
import type { JWTExpired } from 'jose/errors';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}


// This function performs a lightweight check on the Edge without full verification.
// It decodes the token and checks the expiration time. The full, secure verification
// happens on the server with the Firebase Admin SDK.
export async function verifyJwtEdge(token: string): Promise<any | null> {
    try {
        const firebaseAdmin = (await import('firebase-admin')).default;
        // This is a superficial check on the edge. The real verification is in `getDecodedSession`.
        // We can't use the full Admin SDK on the Edge, so we just decode.
        const payload = firebaseAdmin.auth().decodeJwt(token);

        // Check if token has an expiration time
        if (!payload.exp) {
            return null;
        }

        // Check if token is expired. `exp` is in seconds, Date.now() is in milliseconds.
        const isExpired = Date.now() >= payload.exp * 1000;

        if (isExpired) {
            // Throw an error that the middleware will catch
            const error = new Error('Firebase ID token has expired.');
            (error as any).code = 'ERR_JWT_EXPIRED';
            throw error;
        }

        // If not expired, return the payload so the check passes
        return payload;
    } catch (error: any) {
        // Re-throw JWTExpired so the middleware can catch it, return null for other parsing issues.
        if (error.code === 'auth/id-token-expired' || error.code === 'ERR_JWT_EXPIRED') {
            throw error;
        }
        return null;
    }
}


export async function verifyAdminJwtEdge(token: string): Promise<any | null> {
    try {
        const secretKey = getJwtSecretKey();
        const { payload } = await jwtVerify(token, secretKey);
        
        if (payload.role === 'admin') {
            return payload;
        }
        return null;
    } catch(e: any) {
        // Re-throw JWTExpired so middleware can handle it
        if (e.code === 'ERR_JWT_EXPIRED') {
            throw e;
        }
        console.error("Admin JWT Edge Verification Error:", e.code, e.message);
        return null;
    }
}

