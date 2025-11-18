
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
    return keys.reduce((o, key) => (o && typeof o === 'object' && key in o ? o[key] : undefined), obj);
}

// Recursive helper to interpolate context variables into strings
function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    let interpolatedText = text;
    let keepInterpolating = true;
    const maxIterations = 10;
    let iterations = 0;

    // This loop handles nested variables like {{step1.output.{{trigger.field}}}}
    while (keepInterpolating && iterations < maxIterations) {
        const placeholders = interpolatedText.match(/{{\s*([^}]+)\s*}}/g);
        if (!placeholders) {
            keepInterpolating = false;
            continue;
        }

        let madeReplacementInThisPass = false;
        placeholders.forEach(placeholder => {
            const varName = placeholder.replace(/{{\s*|\s*}}/g, '').trim();
            const value = getValueFromPath(context, varName);

            if (value !== undefined && value !== null) {
                // If the entire string is just one variable, replace it with the raw value (could be an object/array)
                if (interpolatedText.trim() === placeholder) {
                    interpolatedText = value;
                    madeReplacementInThisPass = true;
                    // Exit forEach as the entire string is replaced
                    return; 
                }

                const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
                if (interpolatedText.includes(placeholder)) {
                    interpolatedText = interpolatedText.replace(placeholder, replacement);
                    madeReplacementInThisPass = true;
                }
            }
        });
        
        // If the whole string was replaced with a non-string value, we're done with this text.
        if (typeof interpolatedText !== 'string') {
            break;
        }
        
        if (!madeReplacementInThisPass) {
            keepInterpolating = false;
        }
        iterations++;
    }

    return interpolatedText;
}


export async function executeSabFlowAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, appId } = node.data;
    const rawInputs = node.data.inputs || {};
    
    logger.log(`Preparing to execute action: ${actionName} for app: ${appId}`, { inputs: rawInputs });
    
    // Create a deep copy and interpolate every value in place.
    const interpolatedInputs = JSON.parse(JSON.stringify(rawInputs));
    for (const key in interpolatedInputs) {
        if (Object.prototype.hasOwnProperty.call(interpolatedInputs, key)) {
            interpolatedInputs[key] = interpolate(interpolatedInputs[key], context);
        }
    }
    
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
            // The API action interpolates internally as it has complex needs (headers, body etc.)
            // We pass the full context to it.
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
      
    
