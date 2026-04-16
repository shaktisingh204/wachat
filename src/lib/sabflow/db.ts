import { connectToDatabase } from '@/lib/mongodb';
import type { Collection } from 'mongodb';
import type { SabFlowDoc } from './types';

export async function getSabFlowCollection(): Promise<Collection<SabFlowDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<SabFlowDoc>('sabflows');
}
