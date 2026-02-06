import { generateKeyPair, sign } from 'crypto';
import { promisify } from 'util';

const generateKeyPairAsync = promisify(generateKeyPair);

export interface FlowsKeyPair {
    privateKey: string;
    publicKey: string;
}

export async function generateFlowsKeyPair(): Promise<FlowsKeyPair> {
    try {
        const { privateKey, publicKey } = await generateKeyPairAsync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki', // standard public key
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8', // standard private key
                format: 'pem'
            }
        });

        return { privateKey, publicKey };
    } catch (error) {
        throw new Error(`Failed to generate RSA key pair: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function formatPublicKeyForMeta(pemDetails: string): string {
    return pemDetails.trim();
}

/**
 * Signs a payload (usually flow_action_payload or flow_token) with the private key.
 * Used for WhatsApp Flows that require request signing.
 */
export function signFlowPayload(payload: any, privateKey: string): string {
    try {
        const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const signature = sign("sha256", Buffer.from(payloadString), privateKey);
        return signature.toString('base64');
    } catch (e: any) {
        throw new Error(`Failed to sign flow payload: ${e.message}`);
    }
}
