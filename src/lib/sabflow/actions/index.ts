
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
    if (!path || typeof path !== 'string') return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o.hasOwnProperty(key) ? o[key] : undefined), obj);
}

// Helper to recursively interpolate context variables into strings
function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    const singleVariableMatch = text.match(/^{{\s*([^}]+)\s*}}$/);
    if (singleVariableMatch) {
        // If the entire string is a single variable, return its raw value from the context.
        return getValueFromPath(context, singleVariableMatch[1]);
    }

    let interpolatedText = text;
    let keepInterpolating = true;
    const maxIterations = 10; // To prevent infinite loops
    let iterations = 0;

    while (keepInterpolating && iterations < maxIterations) {
        const placeholders = interpolatedText.match(/{{\s*([^}]+)\s*}}/g);
        if (!placeholders) {
            keepInterpolating = false;
            continue;
        }

        let madeReplacement = false;
        placeholders.forEach(placeholder => {
            const varName = placeholder.replace(/{{\s*|\s*}}/g, '');
            const value = getValueFromPath(context, varName);

            if (value !== undefined && value !== null) {
                const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
                if (interpolatedText.includes(placeholder)) {
                    interpolatedText = interpolatedText.replace(new RegExp(placeholder, 'g'), replacement);
                    madeReplacement = true;
                }
            }
        });
        
        if (!madeReplacement) {
            keepInterpolating = false;
        }
        
        iterations++;
    }

    return interpolatedText;
};


export async function executeSabFlowAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, appId } = node.data;
    const inputs = node.data.inputs || {};
    
    logger.log(`Preparing to execute action: ${actionName} for app: ${appId}`, { inputs });
    
    const interpolatedInputs = Object.keys(inputs).reduce((acc, key) => {
        acc[key] = interpolate(inputs[key], context);
        return acc;
    }, {} as Record<string, any>);
    
    logger.log(`Interpolated inputs:`, { interpolatedInputs });

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
      
    
