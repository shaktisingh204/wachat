
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { connectToDatabase } from './mongodb';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("CRITICAL: JWT_SECRET environment variable is not set.");
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

export interface SessionPayload {
    userId: string;
    email: string;
    jti: string; // JWT ID
    expires: number;
}

export async function createSessionToken(payload: Omit<SessionPayload, 'expires' | 'jti'>): Promise<string> {
    const jti = nanoid();
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getJwtSecretKey());
}

async function isTokenRevoked(jti: string): Promise<boolean> {
    try {
        const { db } = await connectToDatabase();
        const revokedToken = await db.collection('revoked_tokens').findOne({ jti });
        return !!revokedToken;
    } catch (error) {
        console.error("Error checking for revoked token:", error);
        // Fail safe: if DB check fails, treat token as potentially revoked.
        return true; 
    }
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey(), {
            algorithms: ['HS256']
        });
        
        if (!payload.jti || !payload.exp) {
            return null;
        }
        
        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked token: ${payload.jti}`);
            return null;
        }

        return {
            userId: payload.userId as string,
            email: payload.email as string,
            jti: payload.jti,
            expires: payload.exp * 1000,
        };
    } catch (error) {
        // Log the error for debugging but don't expose details
        console.error("JWT verification failed:", (error as Error).message);
        return null;
    }
}

// --- Admin Session ---

export interface AdminSessionPayload {
    role: 'admin';
    loggedInAt: number;
    jti: string;
    expires: number;
}

export async function createAdminSessionToken(): Promise<string> {
    const jti = nanoid();
    return new SignJWT({ role: 'admin', loggedInAt: Date.now() })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(getJwtSecretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey(), {
            algorithms: ['HS256']
        });
        
        if (!payload.jti || !payload.exp) {
            return null;
        }
        
        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked admin token: ${payload.jti}`);
            return null;
        }

        if (payload.role !== 'admin') return null;
        
        return {
            role: 'admin',
            loggedInAt: payload.loggedInAt as number,
            jti: payload.jti,
            expires: payload.exp * 1000
        };
    } catch (error) {
        console.error("Admin JWT verification failed:", (error as Error).message);
        return null;
    }
}
