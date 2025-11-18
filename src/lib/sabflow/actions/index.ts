
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
import type { WithId, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// Helper to get nested value from context
function getValueFromPath(obj: any, path: string): any {
    if (!path || typeof path !== 'string') return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let result = obj;
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            return undefined; // Path does not exist
        }
    }
    return result;
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    let interpolatedText = text;
    let match;
    const regex = /{{\s*([^}]+)\s*}}/g;

    while ((match = regex.exec(interpolatedText)) !== null) {
        const fullMatch = match[0];
        const varName = match[1].trim();
        
        const value = getValueFromPath(context, varName);

        if (value !== undefined && value !== null) {
            if (interpolatedText.trim() === fullMatch) {
                return value;
            }
            interpolatedText = interpolatedText.replace(fullMatch, typeof value === 'object' ? JSON.stringify(value) : String(value));
            regex.lastIndex = 0; 
        }
    }

    return interpolatedText;
};


export async function executeSabFlowAction(executionId: ObjectId, node: SabFlowNode, user: WithId<User>, logger: any) {
    const { db } = await connectToDatabase();
    const execution = await db.collection('sabflow_executions').findOne({ _id: executionId });
    if (!execution) {
        logger.log(`Error: Could not find execution document with ID ${executionId}`);
        return { error: 'Execution context not found.' };
    }

    const context = execution.context || {};
    const rawInputs = node.data.inputs || {};
    
    logger.log(`Preparing to execute action: ${node.data.actionName} for app: ${node.data.appId}`, { inputs: rawInputs });
    
    const interpolatedInputs = Object.keys(rawInputs).reduce((acc, key) => {
        acc[key] = interpolate(rawInputs[key], context);
        return acc;
    }, {} as Record<string, any>);
    
    logger.log(`Interpolated inputs:`, { interpolatedInputs });

    const appId = node.data.appId;
    const actionName = node.data.actionName;

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
            // The API action interpolates internally as it needs the full context
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
