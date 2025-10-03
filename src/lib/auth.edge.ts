// IMPORTANT: This file is intended for use in Edge runtime environments (like Next.js Middleware).
// It contains a subset of auth functions that do NOT depend on Node.js APIs (e.g., database connections).

import { jwtVerify } from 'jose';
import type { SessionPayload, AdminSessionPayload } from './definitions';

// This is a simplified secret retrieval that does not involve database calls.
function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

/**
 * Verifies a JWT signature for the Edge runtime.
 * This function DOES NOT check for token revocation in the database.
 * It's suitable for initial, fast checks in middleware.
 */
export async function verifyJwtEdge(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (!payload.jti || !payload.exp || !payload.userId || !payload.email) {
            return null;
        }
        return payload as SessionPayload;
    } catch (error) {
        // Errors like token expiration will be caught here.
        return null;
    }
}

/**
 * Verifies an Admin JWT signature for the Edge runtime.
 * This function DOES NOT check for token revocation in the database.
 */
export async function verifyAdminJwtEdge(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (payload.role !== 'admin' || !payload.jti || !payload.exp) {
            return null;
        }
        return payload as AdminSessionPayload;
    } catch (error) {
        return null;
    }
}
