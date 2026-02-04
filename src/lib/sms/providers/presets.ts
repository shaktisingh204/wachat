
import { GenericProviderConfig } from './generic';

export const PROVIDER_PRESETS: Record<string, Partial<GenericProviderConfig>> = {
    'fast2sms': {
        baseUrl: 'https://www.fast2sms.com/dev/bulkV2',
        method: 'GET',
        headers: { 'authorization': '{{apiKey}}' }, // We will need to interpolate headers in GenericProvider
        mapping: {
            to: 'numbers',
            message: 'message',
            dltTemplateId: 'dlt_template_id' // Check exact param
        }
    },
    'textlocal': {
        baseUrl: 'https://api.textlocal.in/send/',
        method: 'GET', // or POST
        mapping: {
            to: 'numbers',
            message: 'message',
        },
        params: {
            // apiKey is usually passed as 'apikey' query param
            // We need a way to map user credentials to params.
        }
    },
    // We can simplify: For the "20+ providers", if they are simple GET/POST, 
    // we assume we just need to pass specific fixed params + user credentials.
    // This Preset system might need to be more robust for variable credential names.
    // For now, let's just define the list of supported IDs.
};

export const SUPPORTED_PROVIDERS = [
    { id: 'twilio', name: 'Twilio', type: 'sdk' },
    { id: 'msg91', name: 'MSG91', type: 'sdk' },
    { id: 'gupshup', name: 'Gupshup', type: 'sdk' },
    { id: 'plivo', name: 'Plivo', type: 'sdk' },
    { id: 'vonage', name: 'Vonage (Nexmo)', type: 'generic', preset: true }, // Can be generic
    { id: 'clickatell', name: 'Clickatell', type: 'generic', preset: true },
    { id: 'textlocal', name: 'TextLocal', type: 'generic', preset: true },
    { id: 'karix', name: 'Karix', type: 'generic', preset: true },
    { id: 'valuefirst', name: 'ValueFirst', type: 'generic', preset: true },
    { id: 'kaleyra', name: 'Kaleyra', type: 'generic', preset: true },
    { id: 'fast2sms', name: 'Fast2SMS', type: 'generic', preset: true },
    { id: 'twofactor', name: '2Factor', type: 'generic', preset: true },
    { id: 'sinch', name: 'Sinch', type: 'generic', preset: true },
    { id: 'infobip', name: 'Infobip', type: 'generic', preset: true },
    { id: 'aws_sns', name: 'AWS SNS', type: 'sdk' }, // We don't have SDK installed
    { id: 'messagebird', name: 'MessageBird', type: 'generic', preset: true },
    { id: 'telesign', name: 'Telesign', type: 'generic', preset: true },
    { id: 'bandwidth', name: 'Bandwidth', type: 'generic', preset: true },
    { id: 'cm_com', name: 'CM.com', type: 'generic', preset: true },
    { id: 'routemobile', name: 'RouteMobile', type: 'generic', preset: true },
    { id: 'generic', name: 'Custom HTTP', type: 'generic' }
];
