'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import type { AdAccount } from '@/lib/definitions';

interface AdManagerContextType {
    activeAccount: AdAccount | null;
    selectAccount: (account: AdAccount | null) => void;
    isLoading: boolean;
}

const AdManagerContext = createContext<AdManagerContextType | undefined>(undefined);

export function AdManagerProvider({ children }: { children: ReactNode }) {
    const [activeAccount, setActiveAccount] = useState<AdAccount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedId = localStorage.getItem('activeAdAccountId');
        const storedName = localStorage.getItem('activeAdAccountName');
        const storedAccountId = localStorage.getItem('activeAdAccountAccountId');

        if (storedId && storedName && storedAccountId) {
            setActiveAccount({
                id: storedId,
                name: storedName,
                account_id: storedAccountId
            });
        }
        setIsLoading(false);
    }, []);

    const selectAccount = (account: AdAccount | null) => {
        if (account) {
            const standardizedAccountId = account.account_id.startsWith('act_') ? account.account_id : `act_${account.account_id}`;
            const stdAccount = { ...account, account_id: standardizedAccountId };
            setActiveAccount(stdAccount);
            localStorage.setItem('activeAdAccountId', stdAccount.id);
            localStorage.setItem('activeAdAccountName', stdAccount.name);
            localStorage.setItem('activeAdAccountAccountId', stdAccount.account_id);
        } else {
            setActiveAccount(null);
            localStorage.removeItem('activeAdAccountId');
            localStorage.removeItem('activeAdAccountName');
            localStorage.removeItem('activeAdAccountAccountId');
        }
    };

    return (
        <AdManagerContext.Provider value={{ activeAccount, selectAccount, isLoading }}>
            {children}
        </AdManagerContext.Provider>
    );
}

export function useAdManager() {
    const context = useContext(AdManagerContext);
    if (context === undefined) {
        throw new Error('useAdManager must be used within an AdManagerProvider');
    }
    return context;
}
