

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

    if (Date.now() >= expiry_date) {
        googleAuthClient.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await googleAuthClient.refreshAccessToken();
        // This is a placeholder. A proper implementation would update the stored credentials.
        console.log("Refreshed Google Sheets token.");
        accessToken = credentials.access_token;
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
