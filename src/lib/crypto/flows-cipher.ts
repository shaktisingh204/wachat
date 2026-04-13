/**
 * WhatsApp Flows data-exchange encryption.
 *
 * Protocol (from Meta):
 *   Request  → base64( RSA-OAEP(SHA-256) AES-128 key ) + base64(IV) + base64( AES-128-GCM(payload) || tag )
 *   Response → base64( AES-128-GCM(payload, iv^0xFF..FF) || tag ) returned as text/plain
 *
 * Return HTTP 421 on decryption / key-mismatch so Meta refetches the public key
 * and retries once; HTTP 427 to force-close the client session.
 */

import crypto from 'node:crypto';

export interface DecryptedFlowRequest {
    payload: Record<string, any>;
    aesKey: Buffer;
    iv: Buffer;
}

export interface EncryptedFlowEnvelope {
    encrypted_flow_data: string;
    encrypted_aes_key: string;
    initial_vector: string;
}

const AUTH_TAG_BYTES = 16;

export function decryptFlowRequest(
    envelope: EncryptedFlowEnvelope,
    privateKeyPem: string,
): DecryptedFlowRequest {
    if (!envelope?.encrypted_flow_data || !envelope?.encrypted_aes_key || !envelope?.initial_vector) {
        throw new Error('Missing encryption envelope fields');
    }

    const encryptedAesKey = Buffer.from(envelope.encrypted_aes_key, 'base64');
    const iv = Buffer.from(envelope.initial_vector, 'base64');
    const encryptedFlowData = Buffer.from(envelope.encrypted_flow_data, 'base64');

    let aesKey: Buffer;
    try {
        aesKey = crypto.privateDecrypt(
            {
                key: privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            encryptedAesKey,
        );
    } catch (e: any) {
        const err: any = new Error(`RSA decrypt failed: ${e.message}`);
        err.code = 'RSA_DECRYPT_FAILED';
        throw err;
    }

    if (aesKey.length !== 16) {
        const err: any = new Error(`Unexpected AES key length: ${aesKey.length}`);
        err.code = 'RSA_DECRYPT_FAILED';
        throw err;
    }

    const tag = encryptedFlowData.subarray(encryptedFlowData.length - AUTH_TAG_BYTES);
    const ciphertext = encryptedFlowData.subarray(0, encryptedFlowData.length - AUTH_TAG_BYTES);

    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
    decipher.setAuthTag(tag);
    let decrypted: Buffer;
    try {
        decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (e: any) {
        const err: any = new Error(`AES-GCM decrypt failed: ${e.message}`);
        err.code = 'AES_DECRYPT_FAILED';
        throw err;
    }

    let payload: Record<string, any>;
    try {
        payload = JSON.parse(decrypted.toString('utf8'));
    } catch (e: any) {
        const err: any = new Error(`Decrypted payload is not JSON: ${e.message}`);
        err.code = 'PAYLOAD_NOT_JSON';
        throw err;
    }

    return { payload, aesKey, iv };
}

export function encryptFlowResponse(
    responseJson: Record<string, any>,
    aesKey: Buffer,
    iv: Buffer,
): string {
    const flippedIv = Buffer.alloc(iv.length);
    for (let i = 0; i < iv.length; i++) flippedIv[i] = iv[i] ^ 0xff;

    const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
    const plaintext = Buffer.from(JSON.stringify(responseJson), 'utf8');
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([enc, tag]).toString('base64');
}
