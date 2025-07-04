

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { User, Plan, Tag } from './definitions';

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

// --- Admin Session ---

export interface AdminSessionPayload {
    role: 'admin';
    loggedInAt: number;
    expires: number;
}

export function createAdminSessionToken(): string {
    const expires = Date.now() + 1 * 24 * 60 * 60 * 1000; // 1 day for admin
    const sessionPayload: AdminSessionPayload = { role: 'admin', loggedInAt: Date.now(), expires };
    return jwt.sign(sessionPayload, getJwtSecret(), { expiresIn: '1d' });
}

export function verifyAdminSessionToken(token: string): AdminSessionPayload | null {
    try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        return decoded as AdminSessionPayload;
    } catch (error) {
        console.error("Admin JWT verification failed:", (error as Error).message);
        return null;
    }
}

export async function getSession(): Promise<{ user: Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null, tags?: Tag[] } } | null> {
    const sessionToken = cookies().get('session')?.value;
    if (!sessionToken) {
        return null;
    }

    const payload = verifySessionToken(sessionToken);
    if (!payload) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(payload.userId) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return null;
        }

        return { user: JSON.parse(JSON.stringify(user)) };
    } catch (error) {
        console.error("Error fetching session user from DB:", error);
        return null;
    }
}

export async function getAdminSession(): Promise<{ isAdmin: boolean }> {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('admin_session')?.value;
    if (!sessionToken) {
        return { isAdmin: false };
    }

    const payload = verifyAdminSessionToken(sessionToken);
    if (payload && payload.role === 'admin') {
        return { isAdmin: true };
    }

    return { isAdmin: false };
}
