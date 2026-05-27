import * as React from 'react';
import { VaultKeyProvider } from './_components/vault-key-context';

/**
 * SabVault module layout. Wraps every page in the in-memory vault-key
 * provider so the unlock flow + secret-detail pages share a single
 * derived key.
 */
export default function SabvaultLayout({ children }: { children: React.ReactNode }) {
    return <VaultKeyProvider>{children}</VaultKeyProvider>;
}
