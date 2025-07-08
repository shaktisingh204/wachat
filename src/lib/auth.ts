
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { connectToDatabase } from './mongodb';

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("CRITICAL: JWT_SECRET environment variable is not set.");
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return secret;
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

export function createSessionToken(payload: Omit<SessionPayload, 'expires' | 'jti'>): string {
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const sessionPayload: SessionPayload = { ...payload, jti: nanoid(), expires };
    return jwt.sign(sessionPayload, getJwtSecret(), { expiresIn: '7d', jwtid: sessionPayload.jti });
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
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret) as SessionPayload;

        if (await isTokenRevoked(decoded.jti)) {
            console.warn(`Attempted to use a revoked token: ${decoded.jti}`);
            return null;
        }
        
        return decoded;
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

export function createAdminSessionToken(): string {
    const expires = Date.now() + 1 * 24 * 60 * 60 * 1000; // 1 day for admin
    const sessionPayload: AdminSessionPayload = { role: 'admin', loggedInAt: Date.now(), jti: nanoid(), expires };
    return jwt.sign(sessionPayload, getJwtSecret(), { expiresIn: '1d', jwtid: sessionPayload.jti });
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
    try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret) as AdminSessionPayload;

        if (await isTokenRevoked(decoded.jti)) {
            console.warn(`Attempted to use a revoked admin token: ${decoded.jti}`);
            return null;
        }

        if (decoded.role !== 'admin') return null;
        
        return decoded;
    } catch (error) {
        console.error("Admin JWT verification failed:", (error as Error).message);
        return null;
    }
}
