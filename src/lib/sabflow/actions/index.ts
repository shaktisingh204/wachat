

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
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }
    
    const maxIterations = 10;
    let interpolatedText = text;
    let iteration = 0;
    let placeholdersFound = true;

    while(placeholdersFound && iteration < maxIterations) {
        const placeholders = interpolatedText.match(/{{\s*([^}]+)\s*}}/g);
        if (!placeholders) {
            placeholdersFound = false;
            continue;
        }

        let madeReplacement = false;
        for (const placeholder of placeholders) {
            const varName = placeholder.replace(/{{\s*|\s*}}/g, '').trim();
            const value = getValueFromPath(context, varName);

            if (value !== undefined && value !== null) {
                const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
                if (interpolatedText.includes(placeholder)) {
                    interpolatedText = interpolatedText.replace(new RegExp(placeholder, 'g'), replacement);
                    madeReplacement = true;
                }
            }
        }
        
        if (!madeReplacement) {
            placeholdersFound = false;
        }
        iteration++;
    }

    // Final check for single variable match to return non-string types
    const singleVariableMatch = text.match(/^{{\s*([^}]+)\s*}}$/);
    if (singleVariableMatch) {
         const resolvedValue = getValueFromPath(context, singleVariableMatch[1].trim());
         if (resolvedValue !== undefined) return resolvedValue;
    }

    return interpolatedText;
}


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

    // This ensures that even if inputs don't have projectId, it gets added if the action needs it.
    if (!interpolatedInputs.projectId && rawInputs.projectId) {
        interpolatedInputs.projectId = rawInputs.projectId;
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
