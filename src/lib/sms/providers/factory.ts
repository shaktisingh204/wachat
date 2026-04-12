
import { SmsProviderConfig } from "@/lib/definitions";
import { ISmsProvider } from "./types";
import { TwilioAdapter } from "./twilio";
import { Msg91Adapter } from "./msg91";
import { GupshupAdapter } from "./gupshup";
import { PlivoAdapter } from "./plivo";
import { GenericHttpProvider, GenericProviderConfig } from "./generic";
import { PROVIDER_PRESETS } from "./presets";

export class SmsProviderFactory {
    static getProvider(config: SmsProviderConfig): ISmsProvider {
        const { provider, credentials } = config;

        switch (provider) {
            case 'twilio':
                return new TwilioAdapter(
                    (credentials as any).accountSid,
                    (credentials as any).authToken,
                    (credentials as any).fromNumber,
                );
            case 'msg91':
                return new Msg91Adapter(
                    (credentials as any).authKey,
                    (credentials as any).senderId,
                );
            case 'gupshup':
                return new GupshupAdapter(
                    (credentials as any).userId,
                    (credentials as any).password,
                );
            case 'plivo':
                return new PlivoAdapter(
                    (credentials as any).authId,
                    (credentials as any).authToken,
                    (credentials as any).src,
                );
            // Add specific adapters as they are implemented
            default:
                // Check presets
                const preset = PROVIDER_PRESETS[provider];
                if (preset) {
                    return SmsProviderFactory.createGenericProvider(preset, credentials);
                }

                if (provider === 'generic') {
                    // Assume credentials contain the full generic config? Or we stored it elsewhere?
                    // For now, minimal support or robust handling if we updated GenericProviderConfig
                    return new GenericHttpProvider({
                        baseUrl: credentials.baseUrl || '',
                        method: (credentials.method as any) || 'GET',
                        headers: credentials.headers ? JSON.parse(credentials.headers) : undefined,
                        mapping: { to: 'to', message: 'message' } // Default
                    });
                }

                throw new Error(`Provider ${provider} not supported`);
        }
    }

    private static createGenericProvider(preset: Partial<GenericProviderConfig> & { credentialMapping?: Record<string, string> }, credentials: Record<string, any>): GenericHttpProvider {

        // interpolation helper
        const interpolate = (str?: string) => {
            if (!str) return undefined;
            return str.replace(/\{\{(\w+)\}\}/g, (_, key) => credentials[key] || '');
        };

        const interpolateObj = (obj?: Record<string, string>) => {
            if (!obj) return undefined;
            const newObj: Record<string, string> = {};
            for (const key in obj) {
                newObj[key] = interpolate(obj[key]) || '';
            }
            return newObj;
        };

        // Special handling for ClickSend Basic Auth
        if (preset.headers?.['Authorization'] && preset.headers['Authorization'].includes('{{auth}}')) {
            if (credentials.username && credentials.apiKey) {
                const auth = Buffer.from(`${credentials.username}:${credentials.apiKey}`).toString('base64');
                credentials.auth = auth; // inject for interpolation
            }
        }

        const config: GenericProviderConfig = {
            baseUrl: interpolate(preset.baseUrl) || '',
            method: preset.method || 'GET',
            headers: interpolateObj(preset.headers),
            params: interpolateObj(preset.params),
            bodyTemplate: interpolate(preset.bodyTemplate),
            mapping: preset.mapping || { to: 'to', message: 'message' },
            successIdentifier: preset.successIdentifier
        };

        return new GenericHttpProvider(config);
    }
}
