'use client';

import * as React from 'react';
import type { CrmLead, WithId } from '@/lib/definitions';

interface LeadsContextValue {
    leads: WithId<CrmLead>[];
    updateLeadOptimistically: (id: string, partial: Partial<CrmLead>) => void;
}

const LeadsContext = React.createContext<LeadsContextValue | null>(null);

export function LeadsProvider({
    leads: initialLeads,
    children,
}: {
    leads: WithId<CrmLead>[];
    children: React.ReactNode;
}) {
    const [leads, setLeads] = React.useState(initialLeads);

    React.useEffect(() => {
        setLeads(initialLeads);
    }, [initialLeads]);

    const updateLeadOptimistically = React.useCallback(
        (id: string, partial: Partial<CrmLead>) => {
            setLeads((prev) =>
                prev.map((l) => (String(l._id) === id ? ({ ...l, ...partial } as WithId<CrmLead>) : l))
            );
        },
        []
    );

    return (
        <LeadsContext.Provider value={{ leads, updateLeadOptimistically }}>
            {children}
        </LeadsContext.Provider>
    );
}

export function useLeadsContext() {
    const ctx = React.useContext(LeadsContext);
    if (!ctx) throw new Error('useLeadsContext must be used within LeadsProvider');
    return ctx;
}
