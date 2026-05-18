'use server';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import type { WithId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { Contact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { rustClient, RustApiError } from '@/lib/rust-client';
import * as Papa from 'papaparse';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

const CONTACTS_PER_PAGE = 20;

export async function handleAddNewContact(
    prevState: any,
    formData: FormData,
    sessionUser?: any // For API key authentication
): Promise<{ message?: string; error?: string, contactId?: string }> {
    const session = sessionUser ? { user: sessionUser } : await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const countryCode = formData.get('countryCode') as string;
    const phone = formData.get('phone') as string;
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];

    if (!countryCode || !phone) {
        return { error: 'Country code and phone number are required.' };
    }

    if (!projectId || !phoneNumberId || !name) {
        return { error: 'Project, Phone Number, and Name are required.' };
    }

    try {
        const result = await rustClient.wachatContacts.add({
            projectId,
            phoneNumberId,
            name,
            countryCode,
            phone,
            tagIds: tagIds.length > 0 ? tagIds : undefined,
        });

        revalidatePath('/wachat/contacts');

        return { message: result.message ?? `Contact "${name}" added successfully.`, contactId: result.contactId };

    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { error: e.message };
        }
        console.error("Failed to add contact:", e);
        return { error: getErrorMessage(e) };
    }
}

export async function handleImportContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }
    const file = formData.get('contactFile') as File;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    if (!file) {
        return { error: 'No file uploaded.' };
    }

    if (!projectId || !phoneNumberId) {
        return { error: 'Project and Phone Number ID are required.' };
    }

    try {
        // CSV/XLSX parsing stays TS-side; the Rust handler accepts pre-parsed JSON.
        const fileContent = await file.text();
        const parsed = Papa.parse(fileContent, { header: true });
        const contactsToImport = parsed.data as { phone: string; name: string;[key: string]: string }[];

        const cleaned = contactsToImport
            .filter(row => row && row.phone && row.name)
            .map(row => ({ ...row }));

        const result = await rustClient.wachatContacts.importContacts({
            projectId,
            phoneNumberId,
            contacts: cleaned,
        });

        revalidatePath('/wachat/contacts');

        const u = (session.user as { _id?: unknown; id?: unknown });
        const raw = u._id ?? u.id;
        const actorId = raw ? (typeof raw === 'string' ? raw : String(raw)) : null;
        if (actorId) {
            void recordFlowAction('wachat.contact.imported', {
                userId: actorId,
                target: projectId,
                metadata: {
                    phoneNumberId,
                    imported: result.imported,
                    skipped: result.skipped,
                },
            });
        }

        return {
            message:
                result.message ??
                `Import complete. ${result.imported} contacts imported/updated. ${result.skipped} rows skipped.`,
        };

    } catch (error) {
        if (error instanceof RustApiError) {
            return { error: error.message };
        }
        return { error: getErrorMessage(error) };
    }
}

export async function getContactsPageData(
    projectId: string,
    phoneNumberId?: string,
    page: number = 1,
    searchQuery: string = '',
    tagIds?: string[]
): Promise<{ contacts: WithId<Contact>[]; total: number }> {
    noStore(); // Opt out of static caching
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };

    try {
        const result = await rustClient.wachatContacts.list({
            projectId,
            phoneNumberId,
            page,
            search: searchQuery || undefined,
            tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
        });

        return {
            contacts: (result.contacts ?? []) as WithId<Contact>[],
            total: result.total ?? 0,
        };

    } catch (e: any) {
        return { contacts: [], total: 0 };
    }
}

export async function handleUpdateContactDetails(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }
    const contactId = formData.get('contactId') as string;
    const variablesJSON = formData.get('variables') as string;

    if (!contactId) {
        return { success: false, error: 'Invalid contact ID.' };
    }

    try {
        const variables = variablesJSON ? JSON.parse(variablesJSON) : null;
        const name = formData.get('name') as string;

        const body: { name?: string; variables?: Record<string, unknown> | null } = {};
        if (name) body.name = name;
        if (variables) body.variables = variables;

        await rustClient.wachatContacts.updateDetails(contactId, body);

        revalidatePath('/wachat/chat');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { success: false, error: e.message };
        }
        return { success: false, error: 'Failed to update contact details.' };
    }
}

export async function handleUpdateContactStatus(contactId: string, status: string, assignedAgentId?: string) {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!contactId || !status) {
        return { success: false, error: 'Invalid data provided.' };
    }

    try {
        await rustClient.wachatContacts.updateStatus(contactId, {
            status,
            assignedAgentId: assignedAgentId ?? null,
        });
        revalidatePath('/wachat/chat');
        revalidatePath('/wachat/chat/kanban');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { success: false, error: e.message };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateContactTags(contactId: string, tagIds: string[]) {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!contactId) {
        return { success: false, error: 'Invalid data provided.' };
    }

    try {
        await rustClient.wachatContacts.updateTags(contactId, { tagIds });
        revalidatePath('/wachat/chat');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { success: false, error: e.message };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteContact(contactId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    if (!contactId) return { success: false, error: 'Invalid contact ID.' };

    try {
        await rustClient.wachatContacts.delete(contactId);
        revalidatePath('/wachat/contacts');
        return { success: true };
    } catch (e: any) {
        if (e instanceof RustApiError) {
            return { success: false, error: e.message };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}
