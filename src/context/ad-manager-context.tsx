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
            const cleanAccountId = storedAccountId.replace(/^act_/, '');
            const actId = storedId.startsWith('act_') ? storedId : `act_${cleanAccountId}`;
            setActiveAccount({
                id: actId,
                name: storedName,
                account_id: cleanAccountId
            });
        }
        setIsLoading(false);
    }, []);

    const selectAccount = (account: AdAccount | null) => {
        if (account) {
            const cleanAccountId = account.account_id.replace(/^act_/, '');
            const actId = account.id.startsWith('act_') ? account.id : `act_${cleanAccountId}`;
            const stdAccount = { ...account, id: actId, account_id: cleanAccountId };
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
