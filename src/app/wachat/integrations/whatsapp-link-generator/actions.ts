'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export async function saveGeneratedLink(projectId: string, url: string) {
  try {
    const { db } = await connectToDatabase();
    
    await db.collection('wa_link_clicks').insertOne({
      projectId: new ObjectId(projectId),
      url,
      createdAt: new Date().toISOString(),
      clickedAt: new Date().toISOString(), // This ensures it shows up as a click in the tracking page
    });
    
    revalidatePath('/wachat/link-tracking');
    return { success: true };
  } catch (error) {
    console.error('Failed to save generated link:', error);
    return { success: false, error: 'Failed to save link' };
  }
}
