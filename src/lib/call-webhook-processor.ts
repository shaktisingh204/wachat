
'use server';

import type { Db, ObjectId, WithId } from 'mongodb';
import type { Project, CrmCallLog } from './definitions';

/**
 * Handles the 'calls' webhook from Meta.
 * Creates or updates a call log entry in the database idempotently
 * and handles out-of-order events.
 * @param db The database instance.
 * @param project The project associated with the webhook.
 * @param value The 'value' object from the webhook payload's 'changes' array.
 */
export async function handleCallWebhook(db: Db, project: WithId<Project>, value: any) {
  if (!value.calls || !value.calls.length) {
    console.warn(`[CALL-WEBHOOK] No call data found in payload for project ${project._id}`);
    return;
  }

  const callData = value.calls[0];
  const phoneNumberId = value.metadata?.phone_number_id;

  if (!phoneNumberId || !callData.call_id) {
    console.warn(`[CALL-WEBHOOK] Missing phone_number_id or call_id in call webhook for project ${project._id}`);
    return;
  }
  
  const callId = callData.call_id;
  const eventTime = new Date(callData.timestamp * 1000);

  if (callData.event === 'connect') {
    const initialCallLog: Omit<CrmCallLog, '_id' | 'updatedAt'> = {
      callId: callId,
      projectId: project._id,
      phoneNumberId: phoneNumberId,
      from: callData.from,
      to: callData.to,
      direction: callData.direction,
      status: 'CONNECT', // Initial status when call starts
      startedAt: eventTime,
      createdAt: new Date(),
    };

    // This operation is idempotent. If a call with this ID already exists, it does nothing.
    // If not, it inserts the new call record.
    await db.collection<CrmCallLog>('crm_call_logs').updateOne(
      { callId: callId },
      {
        $setOnInsert: initialCallLog,
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
    console.log(`[CALL-WEBHOOK] Upserted initial call log for ${callId}`);

  } else if (callData.event === 'terminate') {
    const existingLog = await db.collection<CrmCallLog>('crm_call_logs').findOne({ callId: callId });

    // If there's no existing record, we still create one to log the missed/terminated call.
    // This handles cases where the 'connect' event might have been missed.
    if (!existingLog) {
        const missedCallLog: Omit<CrmCallLog, '_id'> = {
            callId: callId,
            projectId: project._id,
            phoneNumberId: phoneNumberId,
            from: callData.from,
            to: callData.to,
            direction: callData.direction,
            status: callData.status === 'COMPLETED' ? 'MISSED' : callData.status, // If it "completed" without a connect event, it was missed.
            startedAt: eventTime, // Best guess for start time
            endedAt: eventTime,
            duration: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
         await db.collection<CrmCallLog>('crm_call_logs').insertOne(missedCallLog);
         console.log(`[CALL-WEBHOOK] Logged a terminated call without a prior connect event: ${callId}`);
         return;
    }
    
    // If the call is already marked as terminated, do nothing to ensure idempotency.
    if (existingLog.endedAt) {
      console.log(`[CALL-WEBHOOK] Received duplicate terminate event for call ${callId}. Ignoring.`);
      return;
    }

    let finalStatus = callData.status;
    // CRITICAL: Detect if the call was missed. If the status was just 'CONNECT', it means it was never answered.
    if (existingLog.status === 'CONNECT' && callData.status === 'COMPLETED') {
        finalStatus = 'MISSED';
    }

    let duration = 0;
    if (existingLog.startedAt) {
      duration = Math.round((eventTime.getTime() - new Date(existingLog.startedAt).getTime()) / 1000);
    }
    
    const updateData: Partial<CrmCallLog> = {
      status: finalStatus,
      endedAt: eventTime,
      duration: duration < 0 ? 0 : duration, // Ensure duration is not negative
      updatedAt: new Date()
    };

    await db.collection<CrmCallLog>('crm_call_logs').updateOne(
      { callId: callId },
      { $set: updateData }
    );
    console.log(`[CALL-WEBHOOK] Terminated call log for ${callId} with status: ${finalStatus}`);
  }
}
