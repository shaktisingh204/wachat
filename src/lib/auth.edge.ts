
'use server';

import 'server-only'
import { jwtVerify, decodeJwt, JWTExpired } from 'jose';

// This function performs a lightweight check on the Edge without full verification.
// It decodes the token and checks the expiration time. The full, secure verification
// happens on the server with the Firebase Admin SDK.
export async function verifyJwtEdge(token: string): Promise<any | null> {
    try {
        const payload = decodeJwt(token);

        // Check if token has an expiration time
        if (!payload.exp) {
            return null;
        }

        // Check if token is expired. `exp` is in seconds, Date.now() is in milliseconds.
        const isExpired = Date.now() >= payload.exp * 1000;

        if (isExpired) {
            // Throw the specific error the middleware expects
            throw new JWTExpired('Firebase ID token has expired.');
        }

        // If not expired, return the payload so the check passes
        return payload;
    } catch (error) {
        // Re-throw JWTExpired so the middleware can catch it, return null for other parsing issues.
        if (error instanceof JWTExpired) {
            throw error;
        }
        return null;
    }
}


export async function verifyAdminJwtEdge(token: string): Promise<any | null> {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables for admin verification.');
        }
        const secretKey = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, secretKey);
        if (payload.role === 'admin') {
            return payload;
        }
        return null;
    } catch(e) {
        // Re-throw JWTExpired so middleware can handle it
        if (e instanceof JWTExpired) {
            throw e;
        }
        console.error("Admin JWT Edge Verification Error:", e);
        return null;
    }
}
