
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
import { executeArrayFunctionAction } from './array-function';
import { executeApiFileProcessorAction } from './api-file-processor';
import type { WithId, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';


function getValueFromPath(obj: any, path: string): any {
    if (!path || typeof path !== 'string') return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    let interpolatedText = text;
    const regex = /{{\s*([^}]+)\s*}}/g;
    
    let maxIterations = 10;
    let i = 0;
    let lastText = interpolatedText;

    while (i < maxIterations) {
        const matches = [...interpolatedText.matchAll(regex)];
        if (matches.length === 0) {
            break;
        }

        for (const match of matches) {
            const fullMatch = match[0];
            const varName = match[1].trim();
            const value = getValueFromPath(context, varName);

            if (value !== undefined && value !== null) {
                 if (interpolatedText.trim() === fullMatch && (typeof value === 'object' || typeof value === 'number' || typeof value === 'boolean')) {
                    return value;
                }
                interpolatedText = interpolatedText.replace(fullMatch, typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
            }
        }
        
        if (interpolatedText === lastText) {
            break;
        }
        lastText = interpolatedText;
        i++;
    }

    return interpolatedText;
};


export async function executeSabFlowAction(executionId: ObjectId, node: SabFlowNode, logger: any) {
    const { db } = await connectToDatabase();
    const execution = await db.collection('sabflow_executions').findOne({ _id: executionId });
    if (!execution) {
        logger.log(`Error: Could not find execution document with ID ${executionId}`);
        return { error: 'Execution context not found.' };
    }
    
    const user = await db.collection<User>('users').findOne({ _id: execution.userId });
    if (!user) {
        throw new Error("User not found for this execution.");
    }

    const context = execution.context || {};
    const rawInputs = node.data.inputs || {};
    
    logger.log(`Preparing to execute action: ${node.data.actionName} for app: ${node.data.appId}`, { inputs: rawInputs });
    
    const interpolatedInputs: Record<string, any> = {};
    for (const key in rawInputs) {
        if (Object.prototype.hasOwnProperty.call(rawInputs, key)) {
            interpolatedInputs[key] = interpolate(rawInputs[key], context);
        }
    }

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
            // Pass the whole context for interpolation inside the API action
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
        case 'array_function':
            return await executeArrayFunctionAction(actionName, interpolatedInputs, user, logger);
        case 'api_file_processor':
            return await executeApiFileProcessorAction(actionName, interpolatedInputs, context, logger);
        default:
            logger.log(`Error: Action app "${appId}" is not implemented.`);
            return { error: `Action app "${appId}" is not implemented.` };
    }
}
