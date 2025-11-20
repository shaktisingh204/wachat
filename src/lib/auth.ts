import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
export { createSessionToken, createAdminSessionToken } from './jwt'; // re-export
import { jwtVerify } from 'jose';
import type { SessionPayload, AdminSessionPayload } from './definitions';

const SALT_ROUNDS = 10;

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

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
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (!payload.jti || !payload.exp || !payload.userId || !payload.email) {
            console.error('JWT payload missing required fields');
            return null;
        }

        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked token: ${payload.jti}`);
            return null;
        }

        return payload as SessionPayload;
    } catch (error) {
        console.error('Error verifying JWT:', error);
        return null;
    }
}


export async function verifyAdminJwt(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (payload.role !== 'admin' || !payload.jti || !payload.exp) {
            return null;
        }

        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked admin token: ${payload.jti}`);
            return null;
        }
        
        return payload as AdminSessionPayload;
    } catch (error) {
        console.error("Admin JWT verification failed:", error);
        return null;
    }
}
