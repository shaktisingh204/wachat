'use client';

/**
 * Vault-key context — holds the derived AES-GCM `CryptoKey` in memory only.
 *
 * The key is never persisted to localStorage / IndexedDB / cookies. It
 * lives in React state and is dropped on tab close, page navigation that
 * unmounts the provider, or explicit lock. Auto-lock fires after
 * `AUTO_LOCK_MS` of inactivity.
 */

import * as React from 'react';

const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

interface VaultKeyState {
    key: CryptoKey | null;
    saltB64: string | null;
    isUnlocked: boolean;
    unlock: (key: CryptoKey, saltB64: string) => void;
    lock: () => void;
    /** Bump the activity timer — call from copy/reveal/edit handlers. */
    touch: () => void;
}

const VaultKeyContext = React.createContext<VaultKeyState | null>(null);

export function VaultKeyProvider({ children }: { children: React.ReactNode }) {
    const [key, setKey] = React.useState<CryptoKey | null>(null);
    const [saltB64, setSaltB64] = React.useState<string | null>(null);
    const lastActivityRef = React.useRef<number>(Date.now());

    const lock = React.useCallback(() => {
        setKey(null);
        setSaltB64(null);
    }, []);

    const touch = React.useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    const unlock = React.useCallback((k: CryptoKey, s: string) => {
        setKey(k);
        setSaltB64(s);
        lastActivityRef.current = Date.now();
    }, []);

    // Auto-lock timer.
    React.useEffect(() => {
        if (!key) return;
        const id = window.setInterval(() => {
            if (Date.now() - lastActivityRef.current > AUTO_LOCK_MS) {
                lock();
            }
        }, 30_000);
        return () => window.clearInterval(id);
    }, [key, lock]);

    // Lock on visibility change for an extra layer of paranoia.
    React.useEffect(() => {
        function onVis() {
            if (document.visibilityState === 'hidden') {
                lastActivityRef.current = Date.now() - AUTO_LOCK_MS + 60_000;
            }
        }
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

    const value = React.useMemo<VaultKeyState>(
        () => ({
            key,
            saltB64,
            isUnlocked: key !== null,
            unlock,
            lock,
            touch,
        }),
        [key, saltB64, unlock, lock, touch],
    );

    return <VaultKeyContext.Provider value={value}>{children}</VaultKeyContext.Provider>;
}

export function useVaultKey(): VaultKeyState {
    const ctx = React.useContext(VaultKeyContext);
    if (!ctx) {
        throw new Error('useVaultKey must be used inside <VaultKeyProvider>');
    }
    return ctx;
}
