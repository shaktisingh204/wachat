
'use server';

import type { Db, ObjectId, WithId } from 'mongodb';
import type { Project, CrmCallLog } from './definitions';

/**
 * Handles the 'calls' webhook from Meta.
 * Creates or updates a call log entry in the database.
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

  if (!phoneNumberId) {
    console.warn(`[CALL-WEBHOOK] No phone_number_id in call webhook for project ${project._id}`);
    return;
  }

  const callLog: Partial<CrmCallLog> = {
    callId: callData.id,
    projectId: project._id,
    phoneNumberId: phoneNumberId,
    from: callData.from,
    to: callData.to,
    direction: callData.direction,
    updatedAt: new Date(callData.timestamp * 1000),
  };

  if (callData.event === 'connect') {
    callLog.status = 'CONNECT';
    callLog.startedAt = new Date(callData.timestamp * 1000);
    
    await db.collection<CrmCallLog>('crm_call_logs').updateOne(
      { callId: callData.id },
      {
        $set: callLog,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    console.log(`[CALL-WEBHOOK] Created call log for ${callData.id}`);

  } else if (callData.event === 'terminate') {
    const existingLog = await db.collection<CrmCallLog>('crm_call_logs').findOne({ callId: callData.id });
    
    let duration = 0;
    if (existingLog?.startedAt) {
      duration = Math.round((new Date(callData.timestamp * 1000).getTime() - new Date(existingLog.startedAt).getTime()) / 1000);
    }
    
    callLog.status = callData.status; // e.g., 'COMPLETED', 'MISSED'
    callLog.endedAt = new Date(callData.timestamp * 1000);
    callLog.duration = duration;

    await db.collection<CrmCallLog>('crm_call_logs').updateOne(
      { callId: callData.id },
      { $set: callLog },
      { upsert: true } 
    );
     console.log(`[CALL-WEBHOOK] Terminated call log for ${callData.id}`);
  }
}

    