
'use server';

import type { SabFlowNode, User } from '@/lib/definitions';
import { executeWachatAction } from './wachat';
import { executeCrmAction } from './crm';
import { executeApiAction } from './api';
import { executeSmsAction } from './sms';
import { executeEmailAction } from './email';
import { executeUrlShortenerAction } from './url-shortener';
import { executeQrCodeAction } from './qr-code';
import { executeSabChatAction } from './sabchat';
import { executeMetaAction } from './meta';
import { executeGoogleSheetsAction } from './google-sheets';
import type { WithId } from 'mongodb';

// Helper to get nested value from context
function getValueFromPath(obj: any, path: string): any {
    if (!path) return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

// Helper to interpolate context variables into strings
function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }
    // Check if the entire string is a single variable, e.g., "{{user}}"
    const singleVariableMatch = text.match(/^{{\s*([^}]+)\s*}}$/);
    if (singleVariableMatch) {
        // If so, return the raw value from context, which could be an object, array, etc.
        return getValueFromPath(context, singleVariableMatch[1]);
    }

    // Otherwise, perform standard string interpolation
    return text.replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
        const value = getValueFromPath(context, varName);
        
        if (value !== undefined && value !== null) {
            // If we find a value, stringify it for interpolation, even if it's an object.
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return match; // Return the original placeholder like "{{...}}" if not found
    });
};

export async function executeSabFlowAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, appId } = node.data;
    const inputs = node.data.inputs || {};
    const interpolatedInputs: Record<string, any> = {};

    logger.log(`Preparing to execute action: ${actionName} for app: ${appId}`, { inputs, context });

    // Interpolate all input values from the context
    if (inputs) {
        for(const key in inputs) {
            interpolatedInputs[key] = interpolate(inputs[key], context);
        }
    }

    switch(appId) {
        case 'wachat':
            return await executeWachatAction(actionName, interpolatedInputs, user, logger);
        case 'sabchat':
            return await executeSabChatAction(actionName, interpolatedInputs, user, logger);
        case 'crm':
            return await executeCrmAction(actionName, interpolatedInputs, user, logger);
        case 'meta':
            return await executeMetaAction(actionName, interpolatedInputs, user, logger);
        case 'api':
            // API action interpolates internally as it has a more complex structure
            return await executeApiAction(node, context, logger);
        case 'sms':
            return await executeSmsAction(actionName, interpolatedInputs, user, logger);
        case 'email':
            return await executeEmailAction(actionName, interpolatedInputs, user, logger);
        case 'url-shortener':
            return await executeUrlShortenerAction(actionName, interpolatedInputs, user, logger);
        case 'qr-code-maker':
            return await executeQrCodeAction(actionName, interpolatedInputs, user, logger);
        case 'google_sheets':
            return await executeGoogleSheetsAction(actionName, interpolatedInputs, user, logger);
        default:
            logger.log(`Error: Action app "${appId}" is not implemented.`);
            return { error: `Action app "${appId}" is not implemented.` };
    }
}
      
    
