'use server';

import { document_e_signatures_schema, type DocumentESignaturesType } from './document-e-signatures.schema';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getDocumentESignaturess() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_document_e_signatures').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as DocumentESignaturesType[],
  };
}

export async function createDocumentESignatures(data: any) {
  const parsed = document_e_signatures_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_document_e_signatures').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as DocumentESignaturesType,
  };
}

export async function updateDocumentESignatures(id: string, data: any) {
  const parsed = document_e_signatures_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_document_e_signatures').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteDocumentESignatures(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_document_e_signatures').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
