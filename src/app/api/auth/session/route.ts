
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyJwt } from '@/lib/auth';
import type { User } from '@/lib/definitions';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized: Missing token.', { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
        const decodedToken = await verifyJwt(idToken);
        if (!decodedToken) {
            throw new Error("Invalid or expired token.");
        }

        const { db } = await connectToDatabase();
        
        const now = new Date();
        const requestBody = await request.json().catch(() => ({}));
        const name = requestBody.name || decodedToken.name || decodedToken.email;
        
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

        // Upsert user in our database
        const updateResult = await db.collection('users').findOneAndUpdate(
            { email: decodedToken.email },
            { 
                $setOnInsert: {
                    name,
                    email: decodedToken.email,
                    authProvider: decodedToken.firebase.sign_in_provider,
                    createdAt: now,
                    ...(defaultPlan && { planId: defaultPlan._id, credits: defaultPlan?.signupCredits || 0 }),
                },
                $set: {
                    lastLogin: now,
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const response = NextResponse.json({ success: true, user: updateResult });

        // Correctly set the cookie on the response object
        response.cookies.set('session', idToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_DURATION / 1000,
        });

        return response;
    } catch (error: any) {
        console.error('Session creation failed:', error);
        return new Response(`Authentication error: ${error.message}`, { status: 401 });
    }
}
