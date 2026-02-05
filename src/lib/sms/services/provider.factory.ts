

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ISmsProvider } from '../providers/types';
import { TwilioAdapter } from '../providers/twilio';
import { Msg91Adapter } from '../providers/msg91';
import { GupshupAdapter } from '../providers/gupshup';
import { PlivoAdapter } from '../providers/plivo';
import { SmsProviderConfig } from '../types';

export class SmsService {

    /**
     * Get an instantiated provider for the given user.
     * @param userId The User ID (ObjectId or string)
     */
    static async getProvider(userId: string | ObjectId): Promise<ISmsProvider | null> {
        try {
            const { db } = await connectToDatabase();
            const config = await db.collection<SmsProviderConfig>('sms_configs').findOne({
                userId: new ObjectId(userId),
                isActive: true
            });

            if (!config) return null;

            if (config.provider === 'twilio') {
                const { accountSid, authToken, fromNumber } = config.credentials;
                if (!accountSid || !authToken || !fromNumber) return null;
                return new TwilioAdapter(accountSid, authToken, fromNumber);
            }

            if (config.provider === 'msg91') {
                const { authKey, senderId } = config.credentials;
                if (!authKey || !senderId) return null;
                return new Msg91Adapter(authKey, senderId);
            }

            if (config.provider === 'gupshup') {
                const { userId: gUserId, password } = config.credentials;
                if (!gUserId || !password) return null;
                return new GupshupAdapter(gUserId, password);
            }

            if (config.provider === 'plivo') {
                const { authId, authToken, src } = config.credentials;
                if (!authId || !authToken || !src) return null;
                return new PlivoAdapter(authId, authToken, src);
            }

            // For others, use Generic or return null if implementation missing.
            // For now, only the dedicated ones are fully wired.
            // The "Presets" logic would reside here to instantiate GenericHttpProvider with correct config.

            return null;
        } catch (error) {
            console.error('Failed to get SMS Provider:', error);
            return null;
        }
    }
}
