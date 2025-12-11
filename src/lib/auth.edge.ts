
import 'server-only'
import { jwtVerify } from 'jose';
import type { DecodedIdToken } from 'firebase-admin/auth';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in the environment variables.');
  }
  return new TextEncoder().encode(secret);
}

// This function can run on the Edge because it only uses 'jose'
export async function verifyJwtEdge(token: string): Promise<any | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        return payload;
    } catch (error) {
        console.log("Edge JWT verification failed:", error);
        return null;
    }
}

export async function verifyAdminJwtEdge(token: string): Promise<any | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        if (payload.role === 'admin') {
            return payload;
        }
        return null;
    } catch (error) {
        return null;
    }
}
