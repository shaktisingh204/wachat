
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in the environment variables.');
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
    return jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded as SessionPayload;
    } catch (error) {
        return null;
    }
}
