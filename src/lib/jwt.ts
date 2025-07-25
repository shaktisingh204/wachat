
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import type { SessionPayload, AdminSessionPayload } from './definitions';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

// This function is safe for both Edge and Node.js runtimes.
export async function verifyJwt(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        
        if (!payload.jti || !payload.exp || !payload.userId || !payload.email) {
            console.error('JWT payload missing required fields');
            return null;
        }

        return {
            userId: payload.userId as string,
            email: payload.email as string,
            jti: payload.jti,
            expires: payload.exp * 1000,
        };
    } catch (error) {
        console.error('Error verifying JWT:', error);
        return null;
    }
}

// This function is safe for both Edge and Node.js runtimes.
export async function verifyAdminJwt(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (payload.role !== 'admin' || !payload.jti || !payload.exp) {
            return null;
        }
        
        return {
            role: 'admin',
            loggedInAt: payload.loggedInAt as number,
            jti: payload.jti,
            expires: payload.exp * 1000
        };
    } catch (error) {
        return null;
    }
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

export async function createAdminSessionToken(): Promise<string> {
    const jti = nanoid();
    return new SignJWT({ role: 'admin', loggedInAt: Date.now() })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(getJwtSecretKey());
}
