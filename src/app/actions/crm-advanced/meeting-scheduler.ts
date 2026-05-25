'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  meeting_scheduler_schema,
  type MeetingSchedulerType,
} from './meeting-scheduler.schema';

export async function getMeetingSchedulers() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_meeting_scheduler').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as MeetingSchedulerType[],
  };
}

export async function createMeetingScheduler(data: any) {
  const parsed = meeting_scheduler_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_meeting_scheduler').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as MeetingSchedulerType,
  };
}

export async function updateMeetingScheduler(id: string, data: any) {
  const parsed = meeting_scheduler_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_meeting_scheduler').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteMeetingScheduler(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_meeting_scheduler').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
