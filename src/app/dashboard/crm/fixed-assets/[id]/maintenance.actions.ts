'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';

interface MaintenanceLog {
  _id: string;
  assetId: string;
  tenantId: string;
  date: string;
  type: string;
  description: string;
  cost: number;
  provider: string;
  createdAt: string;
}

export async function getMaintenanceLogs(assetId: string): Promise<{ logs: MaintenanceLog[]; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.tenantId) return { logs: [], error: 'Unauthorized' };

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_fixed_asset_maintenance_logs')
      .find({ assetId, tenantId: String(session.user.tenantId) })
      .sort({ date: -1 })
      .toArray();

    const logs = docs.map((d) => ({
      _id: d._id.toString(),
      assetId: d.assetId,
      tenantId: d.tenantId,
      date: d.date,
      type: d.type,
      description: d.description,
      cost: d.cost,
      provider: d.provider,
      createdAt: d.createdAt,
    })) as MaintenanceLog[];

    return { logs };
  } catch (e: any) {
    return { logs: [], error: e.message };
  }
}

export async function addMaintenanceLog(
  assetId: string,
  data: Omit<MaintenanceLog, '_id' | 'assetId' | 'tenantId' | 'createdAt'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.tenantId) return { success: false, error: 'Unauthorized' };

    const { db } = await connectToDatabase();
    await db.collection('crm_fixed_asset_maintenance_logs').insertOne({
      assetId,
      tenantId: String(session.user.tenantId),
      date: data.date,
      type: data.type,
      description: data.description,
      cost: data.cost,
      provider: data.provider,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
