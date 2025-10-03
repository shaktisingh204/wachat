import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
export { createSessionToken, createAdminSessionToken } from './jwt'; // re-export
import { verifyJwt as verifyJwtPayload, verifyAdminJwt as verifyAdminJwtPayload } from './jwt';
import type { SessionPayload, AdminSessionPayload } from './definitions';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

async function isTokenRevoked(jti: string): Promise<boolean> {
    try {
        const { db } = await connectToDatabase();
        const revokedToken = await db.collection('revoked_tokens').findOne({ jti });
        return !!revokedToken;
    } catch (error) {
        console.error("Error checking for revoked token:", error);
        return true; 
    }
}

// Full verification for server components (with DB access)
export async function verifyJwt(token: string): Promise<SessionPayload | null> {
    const payload = await verifyJwtPayload(token);
    if (!payload?.jti) {
        return null;
    }
    
    if (await isTokenRevoked(payload.jti)) {
        console.warn(`Attempted to use a revoked token: ${payload.jti}`);
        return null;
    }

    return payload;
}

// Full admin verification for server components (with DB access)
export async function verifyAdminJwt(token: string): Promise<AdminSessionPayload | null> {
    const payload = await verifyAdminJwtPayload(token);
    if (!payload?.jti) {
        return null;
    }
    
    if (await isTokenRevoked(payload.jti)) {
        console.warn(`Attempted to use a revoked admin token: ${payload.jti}`);
        return null;
    }
    
    return payload;
}
