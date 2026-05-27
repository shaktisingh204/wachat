'use server';

/**
 * Public lead form actions — back `/share/lead-form/[formId]`.
 *
 * Collections:
 *   crm_lead_custom_forms      — read by _id
 *   crm_leads                  — created on submit
 *   crm_purpose_consent_leads  — GDPR consent record if consentEnabled
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';

type LeadFormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date';

type LeadFormField = {
  name: string;
  label: string;
  type: LeadFormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

type PublicLeadForm = {
  _id: string;
  title: string;
  description?: string;
  fields: LeadFormField[];
  thankYouMessage: string;
  consentEnabled: boolean;
  consentText?: string;
} | null;

type PublicActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
    const userAgent = h.get('user-agent') || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

function normaliseFieldType(raw: unknown): LeadFormFieldType {
  const allowed: LeadFormFieldType[] = [
    'text',
    'email',
    'phone',
    'number',
    'textarea',
    'select',
    'checkbox',
    'date',
  ];
  return (allowed as string[]).includes(raw as string)
    ? (raw as LeadFormFieldType)
    : 'text';
}

export async function getPublicLeadForm(formId: string): Promise<PublicLeadForm> {
  if (!formId || !ObjectId.isValid(formId)) return null;
  try {
    const { db } = await connectToDatabase();
    const form = await db
      .collection('crm_lead_custom_forms')
      .findOne({ _id: new ObjectId(formId) });
    if (!form) return null;

    const rawFields: unknown = Array.isArray(form.fields) ? form.fields : [];
    const fields: LeadFormField[] = (rawFields as Array<Record<string, unknown>>).map((f) => ({
      name: String(f.name || '').slice(0, 100),
      label: String(f.label || f.name || ''),
      type: normaliseFieldType(f.type),
      required: Boolean(f.required),
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
      options: Array.isArray(f.options) ? (f.options as unknown[]).map(String) : undefined,
    }));

    return {
      _id: form._id.toString(),
      title: (form.title as string) || 'Contact us',
      description: form.description as string | undefined,
      fields,
      thankYouMessage:
        (form.thankYouMessage as string) || 'Thank you. We will be in touch shortly.',
      consentEnabled: Boolean(form.consentEnabled),
      consentText: form.consentText as string | undefined,
    };
  } catch (e) {
    console.error('[getPublicLeadForm] failed:', e);
    return null;
  }
}

export async function submitPublicLead(
  formId: string,
  data: Record<string, string | boolean>,
  recaptchaToken?: string
): Promise<PublicActionResult> {
  if (!formId || !ObjectId.isValid(formId)) {
    return { success: false, error: 'Invalid form.' };
  }
  
  if (process.env.RECAPTCHA_SECRET_KEY) {
    if (!recaptchaToken) {
      return { success: false, error: 'Please complete the reCAPTCHA.' };
    }
    try {
      const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
      const params = new URLSearchParams();
      params.append('secret', process.env.RECAPTCHA_SECRET_KEY);
      params.append('response', recaptchaToken);
      
      const recaptchaRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const recaptchaData = await recaptchaRes.json();
      if (!recaptchaData.success) {
        return { success: false, error: 'reCAPTCHA verification failed.' };
      }
    } catch (e) {
      console.error('[submitPublicLead] reCAPTCHA verification error:', e);
      return { success: false, error: 'Failed to verify reCAPTCHA.' };
    }
  }

  try {
    const { db } = await connectToDatabase();
    const form = await db
      .collection('crm_lead_custom_forms')
      .findOne({ _id: new ObjectId(formId) });
    if (!form) return { success: false, error: 'Form not found.' };

    const fields: Array<Record<string, unknown>> = Array.isArray(form.fields)
      ? (form.fields as Array<Record<string, unknown>>)
      : [];

    // Validate required fields.
    for (const field of fields) {
      if (!field.required) continue;
      const value = data[String(field.name)];
      if (value === undefined || value === null || value === '') {
        return {
          success: false,
          error: `${field.label || field.name} is required.`,
        };
      }
    }

    // GDPR consent gate.
    if (form.consentEnabled && !data.__consent) {
      return {
        success: false,
        error: 'You must accept the consent statement to submit this form.',
      };
    }

    const meta = await clientMeta();
    const now = new Date();

    // Map known field names to standard lead columns when possible.
    const fieldValues: Record<string, unknown> = {};
    for (const field of fields) {
      const key = String(field.name);
      if (key in data) fieldValues[key] = data[key];
    }
    const name =
      (fieldValues.name as string) ||
      (fieldValues.fullName as string) ||
      (fieldValues.first_name as string) ||
      '';
    const email =
      (fieldValues.email as string) || (fieldValues.email_address as string) || '';
    const phone =
      (fieldValues.phone as string) || (fieldValues.mobile as string) || '';

    const inserted = await db.collection('crm_leads').insertOne({
      userId: form.userId,
      source: 'public-form',
      formId: form._id,
      name,
      email,
      phone,
      fieldValues,
      status: 'new',
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdAt: now,
      updatedAt: now,
    });

    if (form.consentEnabled) {
      try {
        await db.collection('crm_purpose_consent_leads').insertOne({
          userId: form.userId,
          leadId: inserted.insertedId,
          formId: form._id,
          consentText: (form.consentText as string) || '',
          consentedAt: now,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch (e) {
        console.error('[submitPublicLead] consent record failed (non-fatal):', e);
      }
    }

    revalidatePath(`/share/lead-form/${formId}`);
    return { success: true, message: 'Submitted successfully.' };
  } catch (e) {
    console.error('[submitPublicLead] failed:', e);
    return { success: false, error: 'Could not submit form.' };
  }
}
