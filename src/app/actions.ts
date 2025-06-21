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
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return { error: 'WhatsApp API credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured in the .env file.' };
  }

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

    const contacts = parsed.data as Record<string, string>[];

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

    const variableMatches = template.body.match(/{{(\d+)}}/g);
    const requiredVarNumbers = variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
    
    for (const varNum of requiredVarNumbers) {
        if (!(`variable${varNum}` in firstRow)) {
            return { error: `Template requires variable {{${varNum}}}, but CSV is missing a "variable${varNum}" column header.` };
        }
    }
    
    let successCount = 0;
    let failedSends: { phone: string; reason: string }[] = [];

    const sendPromises = validContacts.map(async (contact) => {
        const components = [];
        if (requiredVarNumbers.length > 0) {
            const parameters = requiredVarNumbers.sort((a,b) => a - b).map(varNum => ({
                type: 'text',
                text: contact[`variable${varNum}`] || '',
            }));
            components.push({
                type: 'body',
                parameters: parameters,
            });
        }

        const messageData = {
            messaging_product: 'whatsapp',
            to: contact.phone,
            type: 'template',
            template: {
                name: template.name,
                language: { code: 'en_US' },
                ...(components.length > 0 && { components }),
            },
        };
        
        try {
            const response = await fetch(
              `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(messageData),
              }
            );

            if (response.ok) {
                successCount++;
            } else {
                const errorData = await response.json();
                const reason = errorData?.error?.message || 'Unknown API error';
                failedSends.push({ phone: contact.phone, reason });
                console.error(`Failed to send message to ${contact.phone}:`, reason);
            }
        } catch(e: any) {
            const reason = e.message || 'Exception during fetch';
            failedSends.push({ phone: contact.phone, reason });
            console.error(`Exception sending message to ${contact.phone}:`, e);
        }
    });

    await Promise.all(sendPromises);

    const errorCount = failedSends.length;
    let status: 'Completed' | 'Partial Failure' | 'Failed' | 'Processing';
    if (errorCount > 0) {
      status = successCount > 0 ? 'Partial Failure' : 'Failed';
    } else {
      status = 'Completed';
    }

    await db.collection('broadcasts').insertOne({
      templateId: new ObjectId(templateId),
      templateName: template.name,
      fileName: csvFile.name,
      contactCount: validContacts.length,
      successCount: successCount,
      errorCount: errorCount,
      status: status,
      createdAt: new Date(),
    });

    if (errorCount > 0) {
        const errorMessage = `Broadcast finished with ${errorCount} failure(s). ${successCount} messages sent successfully. Check server logs for details.`;
        return { error: errorMessage };
    }

    return { message: `Broadcast successfully sent to ${successCount} contacts.` };

  } catch (e: any) {
    console.error('Broadcast failed:', e);
    return { error: e.message || 'An unexpected error occurred while processing the broadcast.' };
  }
}
