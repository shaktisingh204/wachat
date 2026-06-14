import { getVaultKey, listVaultNodes } from '@/app/actions/sabfiles-vault.actions';
import { VaultClient } from './_components/vault-client';

/**
 * Sab Vault — the zero-knowledge encrypted space inside SabFiles.
 *
 * This server component only hydrates the NON-SECRET bootstrap: whether a vault
 * key exists, and the per-user salt + encrypted canary (both safe to send to the
 * client — they are useless without the master password, which never leaves the
 * browser). The master key is derived and held entirely client-side; see
 * `vault-client.tsx`.
 */
export default async function SabVaultPage() {
    const [key, list] = await Promise.all([getVaultKey(), listVaultNodes()]);

    const initialKey = 'exists' in key ? key : { exists: false as const };
    const initialNodes = 'nodes' in list ? list.nodes : [];

    return (
        <VaultClient
            initialKeyExists={initialKey.exists}
            initialSalt={'salt_b64' in initialKey ? initialKey.salt_b64 ?? null : null}
            initialCanary={'canary_b64' in initialKey ? initialKey.canary_b64 ?? null : null}
            initialNodes={initialNodes}
        />
    );
}
