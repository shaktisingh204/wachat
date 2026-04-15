'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Date': amzDate,
        'Host': u.host,
        ...extraHeaders,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAwsKmsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://kms.${region}.amazonaws.com/`;

        const operationMap: Record<string, string> = {
            listKeys: 'ListKeys',
            describeKey: 'DescribeKey',
            createKey: 'CreateKey',
            scheduleKeyDeletion: 'ScheduleKeyDeletion',
            cancelKeyDeletion: 'CancelKeyDeletion',
            enableKey: 'EnableKey',
            disableKey: 'DisableKey',
            encrypt: 'Encrypt',
            decrypt: 'Decrypt',
            generateDataKey: 'GenerateDataKey',
            generateRandom: 'GenerateRandom',
            listAliases: 'ListAliases',
            createAlias: 'CreateAlias',
            updateAlias: 'UpdateAlias',
            deleteAlias: 'DeleteAlias',
        };

        const operation = operationMap[actionName];
        if (!operation) return { error: `Unknown KMS action: ${actionName}` };

        const call = async (payload: object) => {
            const body = JSON.stringify(payload);
            const res = await awsFetch('POST', endpoint, region, 'kms', accessKeyId, secretAccessKey, body, {
                'X-Amz-Target': `TrentService.${operation}`,
            });
            const json = await res.json() as any;
            if (!res.ok) throw new Error(json.message || json.Message || json.__type || JSON.stringify(json));
            return json;
        };

        switch (actionName) {
            case 'listKeys': {
                logger.log('[KMS] Listing keys');
                const data = await call({ Limit: Number(inputs.limit ?? 100) });
                return { output: { keys: data.Keys ?? [], truncated: String(data.Truncated ?? false), count: String((data.Keys ?? []).length) } };
            }
            case 'describeKey': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                logger.log(`[KMS] Describing key ${keyId}`);
                const data = await call({ KeyId: keyId });
                const km = data.KeyMetadata ?? {};
                return { output: { keyId: km.KeyId ?? keyId, keyArn: km.Arn ?? '', keyState: km.KeyState ?? '', description: km.Description ?? '', enabled: String(km.Enabled ?? false) } };
            }
            case 'createKey': {
                const description = String(inputs.description ?? '').trim();
                const keyUsage = String(inputs.keyUsage ?? 'ENCRYPT_DECRYPT');
                const keySpec = String(inputs.keySpec ?? 'SYMMETRIC_DEFAULT');
                logger.log('[KMS] Creating key');
                const payload: any = { KeyUsage: keyUsage, KeySpec: keySpec };
                if (description) payload.Description = description;
                const data = await call(payload);
                const km = data.KeyMetadata ?? {};
                return { output: { keyId: km.KeyId ?? '', keyArn: km.Arn ?? '', keyState: km.KeyState ?? '', description: km.Description ?? '' } };
            }
            case 'scheduleKeyDeletion': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                const pendingWindowInDays = Number(inputs.pendingWindowInDays ?? 30);
                logger.log(`[KMS] Scheduling key deletion for ${keyId}`);
                const data = await call({ KeyId: keyId, PendingWindowInDays: pendingWindowInDays });
                return { output: { keyId: data.KeyId ?? keyId, keyArn: data.KeyArn ?? '', deletionDate: data.DeletionDate ? new Date(data.DeletionDate * 1000).toISOString() : '' } };
            }
            case 'cancelKeyDeletion': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                logger.log(`[KMS] Cancelling key deletion for ${keyId}`);
                const data = await call({ KeyId: keyId });
                return { output: { keyId: data.KeyId ?? keyId, keyArn: data.KeyArn ?? '' } };
            }
            case 'enableKey': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                logger.log(`[KMS] Enabling key ${keyId}`);
                await call({ KeyId: keyId });
                return { output: { enabled: 'true', keyId } };
            }
            case 'disableKey': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                logger.log(`[KMS] Disabling key ${keyId}`);
                await call({ KeyId: keyId });
                return { output: { disabled: 'true', keyId } };
            }
            case 'encrypt': {
                const keyId = String(inputs.keyId ?? '').trim();
                const plaintext = String(inputs.plaintext ?? '').trim();
                if (!keyId || !plaintext) throw new Error('keyId and plaintext are required.');
                const plaintextB64 = Buffer.from(plaintext).toString('base64');
                logger.log(`[KMS] Encrypting data with key ${keyId}`);
                const data = await call({ KeyId: keyId, Plaintext: plaintextB64 });
                return { output: { ciphertextBlob: data.CiphertextBlob ?? '', keyId: data.KeyId ?? keyId, encryptionAlgorithm: data.EncryptionAlgorithm ?? '' } };
            }
            case 'decrypt': {
                const ciphertextBlob = String(inputs.ciphertextBlob ?? '').trim();
                if (!ciphertextBlob) throw new Error('ciphertextBlob is required.');
                logger.log('[KMS] Decrypting data');
                const payload: any = { CiphertextBlob: ciphertextBlob };
                if (inputs.keyId) payload.KeyId = String(inputs.keyId);
                const data = await call(payload);
                const decryptedText = data.Plaintext ? Buffer.from(data.Plaintext, 'base64').toString('utf8') : '';
                return { output: { plaintext: decryptedText, keyId: data.KeyId ?? '', encryptionAlgorithm: data.EncryptionAlgorithm ?? '' } };
            }
            case 'generateDataKey': {
                const keyId = String(inputs.keyId ?? '').trim();
                if (!keyId) throw new Error('keyId is required.');
                const keySpec = String(inputs.keySpec ?? 'AES_256');
                logger.log(`[KMS] Generating data key with master key ${keyId}`);
                const data = await call({ KeyId: keyId, KeySpec: keySpec });
                return { output: { ciphertextBlob: data.CiphertextBlob ?? '', plaintext: data.Plaintext ?? '', keyId: data.KeyId ?? keyId } };
            }
            case 'generateRandom': {
                const numberOfBytes = Number(inputs.numberOfBytes ?? 32);
                logger.log(`[KMS] Generating ${numberOfBytes} random bytes`);
                const data = await call({ NumberOfBytes: numberOfBytes });
                return { output: { plaintext: data.Plaintext ?? '', numberOfBytes: String(numberOfBytes) } };
            }
            case 'listAliases': {
                logger.log('[KMS] Listing aliases');
                const payload: any = { Limit: Number(inputs.limit ?? 100) };
                if (inputs.keyId) payload.KeyId = String(inputs.keyId);
                const data = await call(payload);
                return { output: { aliases: data.Aliases ?? [], truncated: String(data.Truncated ?? false), count: String((data.Aliases ?? []).length) } };
            }
            case 'createAlias': {
                const aliasName = String(inputs.aliasName ?? '').trim();
                const targetKeyId = String(inputs.targetKeyId ?? '').trim();
                if (!aliasName || !targetKeyId) throw new Error('aliasName and targetKeyId are required.');
                if (!aliasName.startsWith('alias/')) throw new Error('aliasName must start with "alias/".');
                logger.log(`[KMS] Creating alias ${aliasName} for key ${targetKeyId}`);
                await call({ AliasName: aliasName, TargetKeyId: targetKeyId });
                return { output: { created: 'true', aliasName, targetKeyId } };
            }
            case 'updateAlias': {
                const aliasName = String(inputs.aliasName ?? '').trim();
                const targetKeyId = String(inputs.targetKeyId ?? '').trim();
                if (!aliasName || !targetKeyId) throw new Error('aliasName and targetKeyId are required.');
                logger.log(`[KMS] Updating alias ${aliasName} to point to ${targetKeyId}`);
                await call({ AliasName: aliasName, TargetKeyId: targetKeyId });
                return { output: { updated: 'true', aliasName, targetKeyId } };
            }
            case 'deleteAlias': {
                const aliasName = String(inputs.aliasName ?? '').trim();
                if (!aliasName) throw new Error('aliasName is required.');
                logger.log(`[KMS] Deleting alias ${aliasName}`);
                await call({ AliasName: aliasName });
                return { output: { deleted: 'true', aliasName } };
            }
            default:
                return { error: `Unknown KMS action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[KMS] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
