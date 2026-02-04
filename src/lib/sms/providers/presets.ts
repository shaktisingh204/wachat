
import { GenericProviderConfig } from './generic';


export const PROVIDER_PRESETS: Record<string, Partial<GenericProviderConfig> & { credentialMapping?: Record<string, string> }> = {
    'fast2sms': {
        baseUrl: 'https://www.fast2sms.com/dev/bulkV2',
        method: 'GET',
        headers: { 'authorization': '{{apiKey}}' },
        mapping: { to: 'numbers', message: 'message', dltTemplateId: 'dlt_template_id' },
        credentialMapping: { apiKey: 'authorization' } // Map config.credentials.apiKey to header 'authorization'
    },
    '2factor': {
        baseUrl: 'https://2factor.in/API/V1/{{apiKey}}/SMS/{{to}}/{{message}}/{{senderId}}',
        method: 'GET',
        mapping: { to: 'to', message: 'message' }, // Used for placeholder replacement logic if needed, but URL covers it
        credentialMapping: { apiKey: 'apiKey', senderId: 'senderId' }
    },
    'textlocal': {
        baseUrl: 'https://api.textlocal.in/send/',
        method: 'GET',
        params: { 'apiKey': '{{apiKey}}', 'sender': '{{senderId}}' },
        mapping: { to: 'numbers', message: 'message' },
        credentialMapping: { apiKey: 'apiKey', senderId: 'senderId' }
    },
    'clicksend': {
        baseUrl: 'https://rest.clicksend.com/v3/sms/send',
        method: 'POST',
        headers: { 'Authorization': 'Basic {{auth}}' }, // We need to base64 encode username:apikey
        mapping: { to: 'to', message: 'body' },
        bodyTemplate: '{"messages":[{"to":"{{to}}","body":"{{message}}","source":"sdk"}]}',
        // We might need special logic for Basic Auth in factory
    },
    // ... Add placeholders for others to default generic or specific impl
    'messagebird': {
        baseUrl: 'https://rest.messagebird.com/messages',
        method: 'POST',
        headers: { 'Authorization': 'AccessKey {{accessKey}}' },
        mapping: { to: 'recipients', message: 'body' },
        params: { 'originator': '{{originator}}' }
    },
    'vonage': {
        // Vonage uses API Key/Secret in params usually
        baseUrl: 'https://rest.nexmo.com/sms/json',
        method: 'POST',
        params: { 'api_key': '{{apiKey}}', 'api_secret': '{{apiSecret}}', 'from': '{{from}}' },
        mapping: { to: 'to', message: 'text' }
    },
    'sinch': {
        // Complex, usually /xms/v1/{service_plan_id}/batches
        // Better handled via specific adapter or generic if simple API exists
        baseUrl: 'https://us.sms.api.sinch.com/xms/v1/{{servicePlanId}}/batches',
        method: 'POST',
        headers: { 'Authorization': 'Bearer {{apiToken}}' },
        bodyTemplate: '{"from": "{{from}}", "to": ["{{to}}"], "body": "{{message}}"}',
        mapping: { to: 'to', message: 'body' }
    },
    'kaleyra': {
        baseUrl: 'https://api.kaleyra.io/v1/{{sid}}/messages',
        method: 'POST',
        headers: { 'api-key': '{{apiKey}}' },
        mapping: { to: 'to', message: 'body' },
        params: { sender: '{{senderId}}' }
    },
    // Fallbacks
    'generic': {
        // User supplies everything
    }
};

