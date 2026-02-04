'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdAccount {
    id: string;
    name: string;
    account_id: string;
}

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
        setActiveAccount(account);
        if (account) {
            localStorage.setItem('activeAdAccountId', account.id);
            localStorage.setItem('activeAdAccountName', account.name);
            localStorage.setItem('activeAdAccountAccountId', account.account_id);
        } else {
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
