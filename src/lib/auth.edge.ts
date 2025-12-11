import 'server-only'
import * as admin from 'firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (!serviceAccount) {
    throw new Error('FIREBASE_ADMIN_SDK_CONFIG environment variable is not set.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  });
}

export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken> {
    const firebaseAdmin = initializeFirebaseAdmin();
    try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        throw new Error('Invalid authentication token.');
    }
}

export async function getDecodedSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;

  try {
    return await verifyFirebaseIdToken(sessionCookie);
  } catch (e) {
    return null;
  }
}
