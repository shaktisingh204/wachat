'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message must be at least 10 characters")
});

export async function submitContact(data: FormData) {
  const result = contactSchema.safeParse({
    name: data.get('name'),
    email: data.get('email'),
    message: data.get('message'),
  });

  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }

  const { db } = await connectToDatabase();
  await db.collection('contacts').insertOne({
    ...result.data,
    createdAt: new Date(),
    status: 'new'
  });

  return { success: true };
}
