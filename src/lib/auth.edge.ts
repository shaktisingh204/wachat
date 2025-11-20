
// This file is deprecated as middleware is now handled by NextAuth.js
// It is kept for reference but is no longer used in the auth flow.

import { jwtVerify } from 'jose';
import type { SessionPayload, AdminSessionPayload } from './definitions';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

export async function verifyJwtEdge(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (!payload.jti || !payload.exp || !payload.userId || !payload.email) {
            return null;
        }
        return payload as SessionPayload;
    } catch (error) {
        return null;
    }
}

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
