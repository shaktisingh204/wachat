
'use server';

import type { WithId, User } from '@/lib/definitions';
import { google } from 'googleapis';
import { googleAuthClient } from '@/lib/crm-auth';
import { getSession } from '@/app/actions';
import { saveOAuthTokens } from '@/app/actions/email.actions'; // Re-using this to save tokens

async function getAuthenticatedClient(user: WithId<User>) {
    const settings = user.sabFlowConnections?.find((c: any) => c.appName === 'Google Sheets');
    if (!settings?.credentials) {
        throw new Error("Google Sheets is not connected. Please connect your account in SabFlow connections.");
    }
    
    let { accessToken, refreshToken, expiry_date } = settings.credentials;

    if (!refreshToken) {
         throw new Error("Missing refresh token. Please reconnect your Google Sheets account to grant offline access.");
    }

    // Refresh when: no expiry recorded (undefined/null/0), or expiry has passed,
    // or expiry is within the next 60 seconds (buffer to avoid mid-call expiration).
    const expiryMs = typeof expiry_date === 'number' ? expiry_date : 0;
    const needsRefresh = !accessToken || !expiryMs || Date.now() >= (expiryMs - 60_000);

    if (needsRefresh) {
        googleAuthClient.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await googleAuthClient.refreshAccessToken();
        accessToken = credentials.access_token;
        console.log("[GoogleSheets] Refreshed access token.");
        // Note: token persistence is intentionally skipped here — tokens live on the
        // in-memory credentials object for the request duration. For persistent storage,
        // wire this refresh to user.sabFlowConnections.credentials updates.
    }

    googleAuthClient.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth: googleAuthClient });
}


export async function executeGoogleSheetsAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const sheets = await getAuthenticatedClient(user);
        
        switch (actionName) {
            case 'addRow': {
                const { spreadsheetId, sheetName, rowData } = inputs;
                if (!spreadsheetId || !sheetName || !rowData) {
                    throw new Error("Spreadsheet ID, Sheet Name, and Row Data are required.");
                }
                
                let values;
                try {
                    values = JSON.parse(rowData);
                    if (!Array.isArray(values)) throw new Error();
                } catch {
                    throw new Error("Row Data must be a valid JSON array.");
                }

                const response = await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: sheetName,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [values],
                    },
                });
                return { output: response.data };
            }
            default:
                throw new Error(`Google Sheets action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}
