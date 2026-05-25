'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message must be at least 10 characters")
});

export type ContactFormState = {
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
  message?: string;
};

export async function submitContact(prevState: ContactFormState, data: FormData): Promise<ContactFormState> {
  const result = contactSchema.safeParse({
    name: data.get('name'),
    email: data.get('email'),
    message: data.get('message'),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
      error: 'Validation failed. Please check the input fields.',
    };
  }

  const { db } = await connectToDatabase();
  await db.collection('contacts').insertOne({
    ...result.data,
    createdAt: new Date(),
    status: 'new'
  });

  const { sendEmail } = await import('@/lib/email/send');
  await sendEmail(
    'info@sabnode.in',
    `New Contact Inquiry from ${result.data.name}`,
    `<p><strong>Name:</strong> ${result.data.name}</p>
     <p><strong>Email:</strong> ${result.data.email}</p>
     <p><strong>Message:</strong></p>
     <p>${result.data.message}</p>`
  );

  return { success: true, message: 'Your message has been received.' };
}
