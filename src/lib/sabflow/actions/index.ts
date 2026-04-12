
'use server';

import type { SabFlowNode, User } from '@/lib/definitions';
import type { WithId, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

// Core App Processors
import { executeFilterAction, executeDelayAction, executeRouterAction } from './core/logic';
import { executeTextAction, executeNumberAction, executeDateAction, executeJsonAction, executeDataTransformerAction, executeDataForwarderAction } from './core/transform';
import { executeCodeAction } from './core/code';

// SabNode Internal Apps
import { executeWachatAction } from './wachat';
import { executeSabChatAction } from './sabchat';
import { executeCrmAction } from './crm';
import { executeApiAction } from './api';
import { executeSmsAction } from './sms';
import { executeEmailAction } from './email';
import { executeUrlShortenerAction } from './url-shortener';
import { executeQrCodeAction } from './qr-code';
import { executeMetaAction } from './meta';
import { executeGoogleSheetsAction } from './google-sheets';
import { executeArrayFunctionAction } from './array-function';
import { executeApiFileProcessorAction } from './api-file-processor';

// External App Processors
import { executeStripeAction } from './stripe';
import { executeShopifyAction } from './shopify';
import { executeSlackAction } from './slack';
import { executeHubSpotAction } from './hubspot';
import { executeDiscordAction } from './discord';
import { executeNotionAction } from './notion';

// Tier-1 Core/Internal Apps (previously empty stubs)
import { executeDynamicWebPageAction } from './dynamic-web-page';
import { executeFileUploaderAction } from './file-uploader';
import { executeLookupTableAction } from './lookup-table';
import { executeConnectManagerAction } from './connect-manager';
import { executeHookAction } from './hook';
import { executeSubscriptionBillingAction } from './subscription-billing';
import { executeSelectTransformJsonAction } from './select-transform-json';
import { executeSeoSuiteAction } from './seo-suite';

// Tier-2 (instagram/team/gmail/iterator)
import { executeInstagramAction } from './instagram';
import { executeTeamAction } from './team';
import { executeGmailAction } from './gmail';
import { executeIteratorAction } from './iterator';


function getValueFromPath(obj: any, path: string): any {
    if (!path || typeof path !== 'string') return undefined;
    // Updated to handle array access like `items[0]` correctly.
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    let interpolatedText = text;
    // Using a global regex to find ALL occurrences, not just the first one.
    const regex = /{{\s*([^}]+)\s*}}/g;

    let maxIterations = 10;
    let i = 0;

    while (i < maxIterations) {
        let matchFound = false;
        interpolatedText = interpolatedText.replace(regex, (fullMatch, varName) => {
            const trimmedVarName = varName.trim();
            const value = getValueFromPath(context, trimmedVarName);

            if (value !== undefined && value !== null) {
                matchFound = true;
                // If the entire string is just a single variable, return the raw value (e.g., for arrays/objects)
                if (interpolatedText.trim() === fullMatch) {
                    return value;
                }
                return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            }
            return fullMatch; // Return the original placeholder if value not found
        });

        // If a single pass results in an object or array, return it directly.
        if (typeof interpolatedText !== 'string') {
            return interpolatedText;
        }

        if (!matchFound) {
            break; // No more variables found, exit loop
        }
        i++;
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

    const interpolatedInputs: Record<string, any> = {};
    for (const key in rawInputs) {
        if (Object.prototype.hasOwnProperty.call(rawInputs, key)) {
            interpolatedInputs[key] = interpolate(rawInputs[key], context);
        }
    }

    logger.log(`Interpolated inputs:`, { interpolatedInputs });

    const appId = node.data.appId;
    const actionName = node.data.actionName;

    switch (appId) {
        // Core Apps: Logic
        case 'filter':
            return await executeFilterAction(actionName, interpolatedInputs);
        case 'delay':
            // Backward compatibility for legacy Delay nodes storing data in node.data
            if ((!interpolatedInputs.value) && node.data.delaySeconds) {
                interpolatedInputs.value = node.data.delaySeconds;
                interpolatedInputs.unit = 'seconds';
                logger.log('Applied backward compatibility for Delay node', { delaySeconds: node.data.delaySeconds });
            }
            return await executeDelayAction(actionName, interpolatedInputs);
        case 'router':
            return await executeRouterAction(actionName, interpolatedInputs);

        // Core Apps: Transform
        case 'text_formatter':
            return await executeTextAction(actionName, interpolatedInputs);
        case 'number_formatter':
            return await executeNumberAction(actionName, interpolatedInputs);
        case 'datetime_formatter':
            return await executeDateAction(actionName, interpolatedInputs);
        case 'json_extractor':
            return await executeJsonAction(actionName, interpolatedInputs);
        case 'data_transformer':
            return await executeDataTransformerAction(actionName, interpolatedInputs);
        case 'data_forwarder':
            return await executeDataForwarderAction(actionName, interpolatedInputs);

        // Core Apps: Code
        case 'code':
            return await executeCodeAction(actionName, interpolatedInputs, context);

        // Tier-1 Core/Internal Apps
        case 'dynamic_web_page':
            return await executeDynamicWebPageAction(actionName, interpolatedInputs, user, logger);
        case 'file_uploader':
            return await executeFileUploaderAction(actionName, interpolatedInputs, user, logger);
        case 'lookup_table':
            return await executeLookupTableAction(actionName, interpolatedInputs, user, logger);
        case 'connect_manager':
            return await executeConnectManagerAction(actionName, interpolatedInputs, user, logger);
        case 'hook':
            return await executeHookAction(actionName, interpolatedInputs, user, logger);
        case 'subscription_billing':
            return await executeSubscriptionBillingAction(actionName, interpolatedInputs, user, logger);
        case 'select_transform_json':
            return await executeSelectTransformJsonAction(actionName, interpolatedInputs, user, logger);
        case 'seo-suite':
            return await executeSeoSuiteAction(actionName, interpolatedInputs, user, logger);

        // Tier-2 apps
        case 'instagram':
            return await executeInstagramAction(actionName, interpolatedInputs, user, logger);
        case 'team':
            return await executeTeamAction(actionName, interpolatedInputs, user, logger);
        case 'gmail':
            return await executeGmailAction(actionName, interpolatedInputs, user, logger);
        case 'iterator':
            return await executeIteratorAction(actionName, interpolatedInputs, user, logger);

        // External Apps
        case 'stripe':
            return await executeStripeAction(actionName, interpolatedInputs, user, logger);
        case 'shopify':
            return await executeShopifyAction(actionName, interpolatedInputs, user, logger);
        case 'slack':
            return await executeSlackAction(actionName, interpolatedInputs, user, logger);
        case 'hubspot':
            return await executeHubSpotAction(actionName, interpolatedInputs, user, logger);
        case 'discord':
            return await executeDiscordAction(actionName, interpolatedInputs, user, logger);
        case 'notion':
            return await executeNotionAction(actionName, interpolatedInputs, user, logger);

        // SabNode Internal Apps
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
