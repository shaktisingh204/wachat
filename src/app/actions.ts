'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Papa from 'papaparse';

export async function handleSuggestContent(topic: string): Promise<{ suggestions?: string[]; error?: string }> {
  if (!topic) {
    return { error: 'Topic cannot be empty.' };
  }

  try {
    const result = await suggestTemplateContent({ topic });
    return { suggestions: result.suggestions };
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate suggestions. Please try again.' };
  }
}

type BroadcastState = {
  message?: string | null;
  error?: string | null;
};

export async function handleStartBroadcast(
  prevState: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  const { db } = await connectToDatabase();

  const templateId = formData.get('templateId') as string;
  const csvFile = formData.get('csvFile') as File;

  if (!templateId) return { error: 'Please select a message template.' };
  if (!csvFile || csvFile.size === 0) return { error: 'Please upload a CSV file.' };

  try {
    const template = await db.collection('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Selected template not found.' };

    const csvText = await csvFile.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    const contacts = parsed.data as { phone?: string; name?: string }[];

    if (contacts.length === 0) {
      return { error: 'CSV file is empty or invalid.' };
    }

    const firstRow = contacts[0];
    if (!firstRow || !('phone' in firstRow)) {
      return { error: 'CSV must contain a "phone" column header.' };
    }

    const validContacts = contacts.filter((c) => c.phone && c.phone.trim() !== '');

    if (validContacts.length === 0) {
      return { error: 'No valid contacts with phone numbers found in the CSV.' };
    }

    await db.collection('broadcasts').insertOne({
      templateId: new ObjectId(templateId),
      templateName: template.name,
      fileName: csvFile.name,
      contactCount: validContacts.length,
      status: 'Processing',
      createdAt: new Date(),
    });

    console.log(`Simulating broadcast of template "${template.name}" to ${validContacts.length} contacts.`);

    return { message: `Broadcast successfully started for ${validContacts.length} contacts.` };
  } catch (e) {
    console.error('Broadcast failed:', e);
    return { error: 'An unexpected error occurred while processing the broadcast.' };
  }
}
