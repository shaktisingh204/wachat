
'use server';

import axios from 'axios';
import FormData from 'form-data';
import { getErrorMessage } from '@/lib/utils';
import type { SabFlowNode } from '@/lib/definitions';

function getValueFromPath(obj: any, path: string): any {
    if (!path) return undefined;
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }
    const match = text.match(/{{\s*([^}]+)\s*}}/);
    if (match && match[0] === text) {
        // If the entire string is a variable, return the raw value (e.g., object, array)
        return getValueFromPath(context, match[1]);
    }
    // Otherwise, perform string interpolation
    return text.replace(/{{\s*([^}]+)\s*}}/g, (m, varName) => {
        const value = getValueFromPath(context, varName);
        if (value !== undefined && value !== null) {
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return m; // Return the original placeholder if not found
    });
}

export async function executeApiAction(node: SabFlowNode, context: any, logger: any) {
    try {
        const { apiRequest } = node.data;
        if (!apiRequest || !apiRequest.url) {
            throw new Error("API Request node is not configured with a URL.");
        }
        const interpolatedUrl = interpolate(apiRequest.url, context);

        const requestConfig: any = {
            method: apiRequest.method || 'GET',
            url: interpolatedUrl,
            headers: {},
        };
        
        if (apiRequest.auth?.type) {
            const { type, ...authDetails } = apiRequest.auth;
            if (type === 'bearer' && authDetails.token) {
                requestConfig.headers['Authorization'] = `Bearer ${interpolate(authDetails.token, context)}`;
            } else if (type === 'api_key' && authDetails.key && authDetails.value) {
                const key = interpolate(authDetails.key, context);
                const value = interpolate(authDetails.value, context);
                if (authDetails.in === 'header') {
                    requestConfig.headers[key] = value;
                } else {
                    const url = new URL(requestConfig.url);
                    url.searchParams.set(key, value);
                    requestConfig.url = url.toString();
                }
            } else if (type === 'basic' && authDetails.username && authDetails.password) {
                const username = interpolate(authDetails.username, context);
                const password = interpolate(authDetails.password, context);
                const encoded = Buffer.from(`${username}:${password}`).toString('base64');
                requestConfig.headers['Authorization'] = `Basic ${encoded}`;
            }
        }
        
        if (Array.isArray(apiRequest.headers)) {
            apiRequest.headers.forEach((header: { key: string, value: string, enabled: boolean }) => {
                if (header.enabled && header.key) {
                    requestConfig.headers[interpolate(header.key, context)] = interpolate(header.value, context);
                }
            });
        }

        const url = new URL(requestConfig.url);
        if (Array.isArray(apiRequest.params)) {
             apiRequest.params.forEach((param: { key: string, value: string, enabled: boolean }) => {
                if (param.enabled && param.key) {
                    url.searchParams.set(interpolate(param.key, context), interpolate(param.value, context));
                }
            });
        }
        requestConfig.url = url.toString();

        if (apiRequest.body?.type === 'json' && apiRequest.body.json) {
            try {
                requestConfig.headers['Content-Type'] = 'application/json';
                const interpolatedBody = interpolate(apiRequest.body.json, context);
                // If interpolate returned an object, use it directly. If string, parse it.
                requestConfig.data = typeof interpolatedBody === 'object' ? interpolatedBody : JSON.parse(interpolatedBody);
            } catch(e) {
                 throw new Error(`Invalid JSON in request body: ${(e as Error).message}`);
            }
        } else if (apiRequest.body?.type === 'form_data' && Array.isArray(apiRequest.body.formData)) {
            const formData = new FormData();
            apiRequest.body.formData.forEach((item: { key: string, value: string, enabled: boolean }) => {
                if(item.enabled && item.key) {
                    formData.append(interpolate(item.key, context), interpolate(item.value, context));
                }
            });
            requestConfig.data = formData;
            Object.assign(requestConfig.headers, formData.getHeaders());
        }

        logger.log(`Making external API call...`, { config: { ...requestConfig, headers: {...requestConfig.headers, Authorization: 'REDACTED'} } });
        const response = await axios(requestConfig);
        logger.log(`External API call successful (Status: ${response.status})`);
        
        const responseData = { status: response.status, headers: response.headers, data: response.data };
        
        const stepName = node.data.name.replace(/ /g, '_');
        context[stepName] = {};

        if (node.data.responseVariableName) {
            context[stepName][node.data.responseVariableName] = responseData;
        }

        if (apiRequest?.responseMappings?.length > 0) {
            apiRequest.responseMappings.forEach((mapping: any) => {
                if (mapping.variable && mapping.path) {
                    const value = getValueFromPath(response.data, mapping.path);
                    if (value !== undefined) {
                        context[stepName][mapping.variable] = value;
                        logger.log(`Mapped response path "${mapping.path}" to context variable "${stepName}.${mapping.variable}".`, { value });
                    }
                }
            });
        }
        
        return { output: responseData };

    } catch (e: any) {
        const errorMsg = `Error executing API action: ${getErrorMessage(e)}`;
        logger.log(errorMsg, { stack: e.stack, response: e.response?.data, context });
        return { error: errorMsg };
    }
}

    