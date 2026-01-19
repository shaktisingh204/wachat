
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import * as admin from 'firebase-admin';
import { serviceAccount } from '@/lib/firebase/service-account';

const FIREBASE_APP_NAME = 'sabnode-admin-app'; // Use the same name

// Helper to initialize Firebase Admin idempotently
function initializeFirebaseAdmin() {
  // Check if app with this name already exists
  if (admin.apps.some(app => app?.name === FIREBASE_APP_NAME)) {
    return admin.app(FIREBASE_APP_NAME);
  }
  
  console.log(`[LOGOUT] Initializing Firebase Admin SDK with name: ${FIREBASE_APP_NAME}`);
  
  let parsedServiceAccount;
  try {
      if (typeof serviceAccount === 'string') {
          parsedServiceAccount = JSON.parse(serviceAccount);
      } else {
          parsedServiceAccount = serviceAccount;
      }
  } catch (e) {
      console.error("FATAL: Could not parse Firebase service account JSON in logout route.");
      throw new Error("Invalid Firebase service account configuration.");
  }
  
  // Ensure the private key is correctly formatted by replacing escaped newlines.
  if (parsedServiceAccount.private_key) {
       parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(parsedServiceAccount),
  }, FIREBASE_APP_NAME);
}

export async function GET(request: NextRequest) {
    const sessionToken = request.cookies.get('session')?.value;
    
    if (sessionToken) {
        try {
            initializeFirebaseAdmin();
            const decodedToken = await admin.auth().verifyIdToken(sessionToken);
            await admin.auth().revokeRefreshTokens(decodedToken.uid);
            console.log(`[LOGOUT] Revoked tokens for UID: ${decodedToken.uid}`);
        } catch (error: any) {
            // Log error but proceed with logout. Token might be invalid/expired anyway.
            console.error('[LOGOUT] Error revoking tokens:', error.code, error.message);
        }
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    
    // Clear the session cookie
    response.cookies.set({
        name: 'session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
