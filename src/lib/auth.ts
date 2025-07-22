
import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
export { createSessionToken, createAdminSessionToken } from './jwt'; // re-export
import { verifyJwt, verifyAdminJwt } from './jwt';
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
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
    const payload = await verifyJwt(token);
    if (!payload) {
        return null;
    }
    
    // Then, check against the database for revocation
    if (await isTokenRevoked(payload.jti)) {
        console.warn(`Attempted to use a revoked token: ${payload.jti}`);
        return null;
    }

    return payload;
}

// Full admin verification for server components (with DB access)
export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
    const payload = await verifyAdminJwt(token);
    if (!payload) {
        return null;
    }
    
    // Then, check revocation
    if (await isTokenRevoked(payload.jti)) {
        console.warn(`Attempted to use a revoked admin token: ${payload.j