
import 'dotenv/config'; // Load .env
import { connectToDatabase } from '../src/lib/mongodb';
import { ObjectId } from 'mongodb';
import PQueue from 'p-queue';
import { SmsProviderFactory } from '../src/lib/sms/providers/factory';
import { SmsCampaign, SmsLog } from '../src/lib/sms/types';

const LOG_PREFIX = '[SMS-WORKER]';

async function log(db: any, campaignId: ObjectId | undefined, level: string, message: string) {
    console.log(`${LOG_PREFIX} [${level}] ${message}`);
}

async function startSmsWorker(workerId: string) {
    const { db } = await connectToDatabase();
    console.log(`${LOG_PREFIX} Started Worker: ${workerId}`);

    let busy = false;

    setInterval(async () => {
        if (busy) return;
        busy = true;

        try {
            // 1. Find and Lock a Job
            const job = await db.collection<SmsCampaign>('sms_campaigns').findOneAndUpdate(
                { status: 'PROCESSING' },
                { $set: { status: 'SENDING', updatedAt: new Date() } } as any,
                { returnDocument: 'after' }
            );

            if (!job) {
                busy = false;
                return;
            }

            const campaign = job as unknown as SmsCampaign;
            const { _id, userId, name, templateId, variableMapping, audienceConfig } = campaign;

            await log(db, _id, 'INFO', `Processing campaign: ${name}`);

            try {
                // 1. Fetch SMS Config
                const config = await db.collection('sms_configs').findOne({ userId });
                if (!config || !config.isActive) {
                    await db.collection('sms_campaigns').updateOne({ _id }, { $set: { status: 'FAILED', error: 'No active provider config' } });
                    return;
                }

                // 2. Get Provider
                const provider = SmsProviderFactory.getProvider(config as any);
                if (!provider) {
                    await db.collection('sms_campaigns').updateOne({ _id }, { $set: { status: 'FAILED', error: 'Provider instantiation failed' } });
                    return;
                }

                // 3. Fetch Template
                const template = await db.collection('dlt_templates').findOne({ _id: templateId });
                if (!template) {
                    await db.collection('sms_campaigns').updateOne({ _id }, { $set: { status: 'FAILED', error: 'Template not found' } });
                    return;
                }

                // 4. Resolve Audience
                let recipients: string[] = [];
                if (audienceConfig) {
                    if (audienceConfig.type === 'tags') {
                        // Tag IDs are stored in value. Query contacts.
                        const tagIds = Array.isArray(audienceConfig.value) ? audienceConfig.value : [audienceConfig.value];
                        const contacts = await db.collection('contacts').find(
                            { userId, tags: { $in: tagIds } },
                            { projection: { phone: 1 } }
                        ).toArray();
                        recipients = contacts.map(c => c.phone).filter(p => p);
                    } else if (audienceConfig.type === 'csv') {
                        // Value is CSV Content or File URL. If URL, fetch it? For now assume it's processed/stored content
                        // In real app, we might stream. Here we trust the previous steps handled it or simple storage.
                        // Implementation Plan said: "parse CSV". Let's assume value is simple list or check if fileUrl
                        const val = audienceConfig.value as string;
                        if (val) {
                            recipients = val.split(/[\r\n,]+/).map(s => s.trim()).filter(s => /^\+?\d+$/.test(s));
                        }
                    } else if (audienceConfig.type === 'group') {
                        // Legacy support or if 'group' type is used
                        const groupId = audienceConfig.value;
                        const contacts = await db.collection('contacts').find(
                            { userId, groupIds: groupId },
                            { projection: { phone: 1 } }
                        ).toArray();
                        recipients = contacts.map(c => c.phone).filter(p => p);
                    } else if (audienceConfig.type === 'all') {
                        const contacts = await db.collection('contacts').find(
                            { userId },
                            { projection: { phone: 1 } }
                        ).toArray();
                        recipients = contacts.map(c => c.phone).filter(p => p);
                    }
                }

                if (recipients.length === 0) {
                    await db.collection('sms_campaigns').updateOne({ _id }, { $set: { status: 'FAILED', error: 'No valid recipients found' } });
                    return;
                }

                // 5. Process Recipients
                const queue = new PQueue({ interval: 1000, intervalCap: 30, concurrency: 30 });
                let sentCount = 0;
                let failedCount = 0;

                const processRecipient = async (number: string) => {
                    let content = template.content;
                    if (template.variableCount > 0 && variableMapping) {
                        let varIndex = 0;
                        content = content.replace(/{#var#}/g, () => {
                            const val = variableMapping[varIndex] || '';
                            varIndex++;
                            return val;
                        });
                    }

                    const dltParams = {
                        dltTemplateId: template.dltTemplateId,
                        dltPrincipalEntityId: config.dltPeId || (config.dlt && config.dlt.principalEntityId) || '',
                        dltHeaderId: template.headerId
                    };

                    const result = await provider.send(number, content, dltParams);

                    await db.collection('sms_logs').insertOne({
                        userId,
                        campaignId: _id,
                        to: number,
                        content,
                        provider: config.provider,
                        status: result.status,
                        messageId: result.messageId,
                        error: result.error,
                        sentAt: new Date()
                    });

                    if (result.status === 'SENT' || result.status === 'QUEUED') {
                        sentCount++;
                    } else {
                        failedCount++;
                    }
                };

                await Promise.all(recipients.map(num => queue.add(() => processRecipient(num))));

                await db.collection('sms_campaigns').updateOne(
                    { _id },
                    {
                        $set: {
                            status: 'COMPLETED',
                            completedAt: new Date(),
                            'stats.sent': sentCount,
                            'stats.failed': failedCount
                        }
                    }
                );
                await log(db, _id, 'INFO', `Finished campaign. Sent: ${sentCount}, Failed: ${failedCount}`);

            } catch (error: any) {
                console.error(`[SMS_WORKER] Failed job ${_id}:`, error);
                await db.collection('sms_campaigns').updateOne(
                    { _id },
                    { $set: { status: 'FAILED', error: error.message } }
                );
            }
        } catch (e: any) {
            console.error(LOG_PREFIX, e);
        } finally {
            busy = false;
        }
    }, 5000);
}

startSmsWorker('sms-worker-1');
