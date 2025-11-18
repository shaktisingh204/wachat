
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
function interpolate(text: string | undefined, context: any): string {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
        const value = getValueFromPath(context, varName);
        
        if (value !== undefined && value !== null) {
            // If the value is an object or array, and it's the *only* thing in the string,
            // we might want to keep it as an object for JSON bodies, but this function returns a string.
            // For now, we'll stringify it, which is safer for most use cases.
            if(typeof value === 'object') {
                 // Check if the entire string is just the variable.
                if (match === text) {
                    // This is a special case that we'll handle by returning the object itself,
                    // but the function signature expects a string. We'll cast it, and the caller
                    // must be aware of this possibility.
                    return value as any;
                }
                return JSON.stringify(value);
            }
            return String(value);
        }
        return match; 
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

    