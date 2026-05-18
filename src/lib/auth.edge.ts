import { jwtVerify, type JWTPayload } from 'jose';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

// This function now correctly verifies the token's signature and expiration on the Edge.
export async function verifyJwtEdge(token: string): Promise<boolean> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        if (!isBrowserSessionPayload(payload)) {
            throw new Error('Session JWT payload missing required browser-session claims.');
        }
        return true;
    } catch (e: any) {
        // Re-throw the error so the middleware can catch it and handle cookie deletion.
        throw e;
    }
}

function isBrowserSessionPayload(payload: JWTPayload): boolean {
    return Boolean(
        payload.jti &&
        payload.exp &&
        typeof payload.userId === 'string' &&
        payload.userId.length > 0 &&
        typeof payload.email === 'string' &&
        payload.email.length > 0,
    );
}

export async function verifyAdminJwtEdge(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (payload.role !== 'admin') {
            return null;
        }

        return payload;
    } catch (e: any) {
        // Re-throw the error so the middleware can catch it and handle cookie deletion.
        throw e;
    }
}
