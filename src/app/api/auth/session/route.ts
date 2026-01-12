

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyJwt } from '@/lib/auth';
import type { User } from '@/lib/definitions';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function POST(request: NextRequest) {
    console.log('[API_SESSION] POST /api/auth/session hit.');
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.error('[API_SESSION] Unauthorized: Missing Authorization header.');
        return new Response('Unauthorized: Missing token.', { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('[API_SESSION] Received token.');
    
    try {
        const decodedToken = await verifyJwt(idToken);
        if (!decodedToken) {
            console.error('[API_SESSION] Token verification failed.');
            throw new Error("Invalid or expired token.");
        }
        console.log(`[API_SESSION] Token verified for UID: ${decodedToken.uid}`);

        const { db } = await connectToDatabase();
        
        const now = new Date();
        const requestBody = await request.json().catch(() => ({}));
        const name = requestBody.name || decodedToken.name || decodedToken.email;
        const location = requestBody.location; // GeoJSON object
        console.log(`[API_SESSION] Upserting user: ${decodedToken.email}`);
        
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

        const setOnInsertData: any = {
            name,
            email: decodedToken.email,
            authProvider: decodedToken.firebase.sign_in_provider,
            createdAt: now,
            isApproved: false, 
        };
        
        if (defaultPlan) {
            setOnInsertData.planId = defaultPlan._id;
            setOnInsertData.credits = defaultPlan.signupCredits || 0;
        }
        
        // On every login/session creation, we update the lastLogin time and location.
        const setData: any = {
            lastLogin: now,
        };
        if(location) {
            setData.location = location;
        }

        const updateResult = await db.collection('users').findOneAndUpdate(
            { email: decodedToken.email },
            { 
                $setOnInsert: setOnInsertData,
                $set: setData,
            },
            { upsert: true, returnDocument: 'after' }
        );
        console.log('[API_SESSION] User upserted successfully.');

        const response = NextResponse.json({ success: true, user: updateResult });

        console.log('[API_SESSION] Setting session cookie.');
        response.cookies.set('session', idToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_DURATION / 1000,
        });

        console.log('[API_SESSION] Session successfully created.');
        return response;
    } catch (error: any) {
        console.error('[API_SESSION] Session creation failed:', error);
        return new Response(`Authentication error: ${error.message}`, { status: 401 });
    }
}
