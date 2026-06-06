/**
 * Types extracted from crm-tasks.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type TaskLinkedKind =
    | 'lead' | 'deal' | 'client' | 'contact' | 'ticket' | 'invoice' | 'none';
