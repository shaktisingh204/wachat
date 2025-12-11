import 'server-only'
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { DecodedIdToken } from 'firebase-admin/auth';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in the environment variables.');
  }
  return new TextEncoder().encode(secret);
}

// This function can run on the Edge because it doesn't use firebase-admin
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

// This function is NOT for verifying Firebase ID tokens. It's for custom JWTs.
// The new Firebase auth flow does not require Edge-side verification of Firebase tokens.
// Session management is now handled via API routes.
// However, to avoid breaking middleware, we keep a generic JWT verifier.

export async function getDecodedSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const firebaseAdmin = (await import('firebase-admin')).default;
    const serviceAccount = (await import('@/lib/firebase/service-account')).serviceAccount;
    
    if (firebaseAdmin.apps.length === 0) {
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount)
        });
    }
    
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(sessionCookie);
    return decodedToken;
  } catch (e) {
    return null;
  }
}
