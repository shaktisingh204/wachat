/**
 * Adapter registry for §5.9 bulk import.
 *
 * Keyed by `entityKind`. Adding a new adapter:
 *   1. Drop a new file under `bulk-import/adapters/<name>.ts`.
 *   2. Add a `case` here that returns the adapter.
 *   3. Add a matching tile on the import-export landing page.
 *
 * Lives behind a function (not a top-level `Map`) so we can keep all
 * adapters tree-shake-friendly — the wizard pulls in only the schema it
 * needs at render time, while the server action picks the adapter at
 * execute time.
 */

import 'server-only';

import { accountsAdapter } from './adapters/accounts';
import { contactsAdapter } from './adapters/contacts';
import { itemsAdapter } from './adapters/items';
import { leadsAdapter } from './adapters/leads';
import type { BulkImportAdapterSpec } from './adapters/types';

export type SupportedEntityKind = 'contact' | 'lead' | 'account' | 'item';

export const SUPPORTED_ENTITY_KINDS: SupportedEntityKind[] = [
    'contact',
    'lead',
    'account',
    'item',
];

export function getAdapter(entityKind: string): BulkImportAdapterSpec<unknown> | null {
    switch (entityKind) {
        case 'contact':
            return contactsAdapter as unknown as BulkImportAdapterSpec<unknown>;
        case 'lead':
            return leadsAdapter as unknown as BulkImportAdapterSpec<unknown>;
        case 'account':
            return accountsAdapter as unknown as BulkImportAdapterSpec<unknown>;
        case 'item':
            return itemsAdapter as unknown as BulkImportAdapterSpec<unknown>;
        default:
            return null;
    }
}
