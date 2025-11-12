
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


export async function executeSabFlowAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, appId } = node.data;
    const inputs = node.data.inputs || {};

    switch(appId) {
        case 'wachat':
            return await executeWachatAction(actionName, inputs, user, logger);
        case 'sabchat':
            return await executeSabChatAction(actionName, inputs, user, logger);
        case 'crm':
            return await executeCrmAction(actionName, inputs, user, logger);
        case 'meta':
            return await executeMetaAction(actionName, inputs, user, logger);
        case 'api':
            return await executeApiAction(node, context, logger);
        case 'sms':
            return await executeSmsAction(actionName, inputs, user, logger);
        case 'email':
            return await executeEmailAction(actionName, inputs, user, logger);
        case 'url-shortener':
            return await executeUrlShortenerAction(actionName, inputs, user, logger);
        case 'qr-code-maker':
            return await executeQrCodeAction(actionName, inputs, user, logger);
        case 'google_sheets':
            return await executeGoogleSheetsAction(actionName, inputs, user, logger);
        default:
            logger.log(`Error: Action app "${appId}" is not implemented.`);
            return { error: `Action app "${appId}" is not implemented.` };
    }
}
