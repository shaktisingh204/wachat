
import { google } from 'googleapis';
import * as msal from '@azure/msal-node';

// --- Google OAuth2 Client ---
export const googleAuthClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// --- Outlook/Microsoft OAuth2 Client ---
const msalConfig = {
    auth: {
        clientId: process.env.OUTLOOK_CLIENT_ID!,
        authority: "https://login.microsoftonline.com/common",
        clientSecret: process.env.OUTLOOK_CLIENT_SECRET!,
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel: any, message: any, containsPii: any) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Info,
        }
    }
};

export const outlookAuthClient = new msal.ConfidentialClientApplication(msalConfig);
