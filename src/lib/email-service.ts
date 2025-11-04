
'use server';

import nodemailer from 'nodemailer';
import { googleAuthClient, outlookAuthClient } from './crm-auth';
import type { EmailSettings, WithId } from './definitions';
import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from './mongodb';
import { saveOAuthTokens } from '@/app/actions/email.actions';
import { ConfidentialClientApplication } from '@azure/msal-node';

async function createSmtpTransporter(settings: EmailSettings) {
    if (!settings.smtp) throw new Error('SMTP settings are not configured.');
    return nodemailer.createTransport({
        host: settings.smtp.host,
        port: settings.smtp.port,
        secure: settings.smtp.secure,
        auth: {
            user: settings.smtp.user,
            pass: settings.smtp.pass,
        },
    });
}

async function createGoogleTransporter(settings: EmailSettings, userId: string) {
    if (!settings.googleOAuth) throw new Error('Google account is not connected.');
    
    let { accessToken, refreshToken, expiryDate } = settings.googleOAuth;

    if (!accessToken || !refreshToken || !expiryDate) throw new Error("Incomplete Google OAuth tokens.");

    if (Date.now() >= expiryDate) {
        googleAuthClient.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await googleAuthClient.refreshAccessToken();
        accessToken = credentials.access_token!;
        expiryDate = credentials.expiry_date!;
        
        await saveOAuthTokens({
            userId, provider: 'google', accessToken, refreshToken, expiryDate, fromEmail: settings.fromEmail!, fromName: settings.fromName!
        });
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: settings.fromEmail,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken,
            accessToken,
        },
    });
}

async function createOutlookTransporter(settings: EmailSettings, userId: string) {
    if (!settings.outlookOAuth) throw new Error('Outlook account is not connected.');
    
    let { accessToken, refreshToken, expiryDate } = settings.outlookOAuth;
    
    if (!accessToken || !refreshToken || !expiryDate) throw new Error("Incomplete Outlook OAuth tokens.");
    
     if (Date.now() >= expiryDate) {
        const msalInstance = new ConfidentialClientApplication({ auth: { clientId: process.env.OUTLOOK_CLIENT_ID!, clientSecret: process.env.OUTLOOK_CLIENT_SECRET! } });
        const response = await msalInstance.acquireTokenByRefreshToken({
            refreshToken,
            scopes: ["User.Read", "Mail.Send"],
        });
        accessToken = response.accessToken;
        expiryDate = response.expiresOn!.getTime();
        
        await saveOAuthTokens({
            userId, provider: 'outlook', accessToken, refreshToken, expiryDate, fromEmail: settings.fromEmail!, fromName: settings.fromName!
        });
     }

    return nodemailer.createTransport({
        service: 'hotmail',
        auth: {
            type: 'OAuth2',
            user: settings.fromEmail,
            accessToken,
        },
    });
}

export async function getTransporter() {
    const session = await getSession();
    if (!session?.user) throw new Error("Authentication required.");
    
    const { db } = await connectToDatabase();
    // This assumes the user has one primary sending configuration.
    // To support multiple senders, this would need to be adapted to accept an `accountId` or `fromEmail`.
    const settings = await db.collection<WithId<EmailSettings>>('email_settings').findOne({ userId: new ObjectId(session.user._id) });

    if (!settings) throw new Error("Email settings not found for this user.");
    
    switch (settings.provider) {
        case 'smtp': return createSmtpTransporter(settings);
        case 'google': return createGoogleTransporter(settings, session.user._id.toString());
        case 'outlook': return createOutlookTransporter(settings, session.user._id.toString());
        default: throw new Error("Unsupported email provider.");
    }
}
