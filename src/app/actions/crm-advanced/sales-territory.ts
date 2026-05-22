'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const sales_territory_schema = z.object({
  region: z.string().min(1, "region is required"),
  assignedRep: z.string().min(1, "assignedRep is required"),
  status: z.enum(['active', 'inactive'])
});

export type SalesTerritoryType = z.infer<typeof sales_territory_schema> & { _id: string; createdAt: Date; updatedAt: Date };

export async function getSalesTerritorys() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_sales_territory').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as SalesTerritoryType[],
  };
}

export async function createSalesTerritory(data: any) {
  const parsed = sales_territory_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_sales_territory').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as SalesTerritoryType,
  };
}

export async function updateSalesTerritory(id: string, data: any) {
  const parsed = sales_territory_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_sales_territory').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteSalesTerritory(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_sales_territory').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
