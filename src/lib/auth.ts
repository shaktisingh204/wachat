
'use server';

import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import type { SessionPayload, AdminSessionPayload } from './definitions';
import * as admin from 'firebase-admin';
import { serviceAccount } from './firebase/service-account';
import { cookies } from 'next/headers';

const SALT_ROUNDS = 10;

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  console.log('[AUTH_LIB] Initializing Firebase Admin SDK...');

  // Handle potential JSON parsing errors
  let parsedServiceAccount;
  try {
      if (typeof serviceAccount === 'string') {
          parsedServiceAccount = JSON.parse(serviceAccount);
      } else {
          parsedServiceAccount = serviceAccount;
      }
  } catch (e) {
      console.error("[AUTH_LIB] FATAL: Could not parse Firebase service account JSON.");
      throw new Error("Invalid Firebase service account configuration.");
  }

  // Ensure the private key is correctly formatted by replacing escaped newlines.
  if (parsedServiceAccount.private_key) {
       parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(parsedServiceAccount),
  });
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

export async function verifyJwt(token: string): Promise<any | null> {
    console.log('[AUTH_LIB] Verifying Firebase ID token on server...');
    try {
        const firebaseAdmin = initializeFirebaseAdmin();
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token, true); // Set checkRevoked to true
        console.log('[AUTH_LIB] Firebase ID token verified successfully.');
        return decodedToken;
    } catch (error: any) {
        console.error('[AUTH_LIB] Error verifying Firebase ID token:', error.code, error.message);
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
        // This will catch expired tokens and other verification errors from jose
        console.error("Admin JWT verification failed on server:", error);
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

// This function is for server components/actions ONLY
export async function getDecodedSession(sessionCookie: string) {
  console.log('[AUTH_LIB] getDecodedSession called.');
  if (!sessionCookie) {
    console.log('[AUTH_LIB] No session cookie provided to getDecodedSession.');
    return null;
  };

  try {
    console.log('[AUTH_LIB] Attempting to verify token with Firebase Admin SDK...');
    const firebaseAdmin = initializeFirebaseAdmin();
    // Setting checkRevoked to true here as well
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(sessionCookie, true);
    console.log(`[AUTH_LIB] Token successfully decoded for UID: ${decodedToken.uid}`);
    return decodedToken;
  } catch (e: any) {
    console.error('[AUTH_LIB] Failed to decode session:', e.code, e.message);
    return null;
  }
}
