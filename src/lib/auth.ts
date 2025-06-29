
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
    expires: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'expires'>): string {
    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const sessionPayload: SessionPayload = { ...payload, expires };
    return jwt.sign(sessionPayload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionPayload | null {
    try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        return decoded as SessionPayload;
    } catch (error) {
        // Log the error for debugging but don't expose details
        console.error("JWT verification failed:", (error as Error).message);
        return null;
    }
}
