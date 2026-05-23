import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AccountingStandard = 'GAAP' | 'IFRS';
type FiscalYear = 'current' | 'previous' | 'custom';

interface AccountingState {
    standard: AccountingStandard;
    fiscalYear: FiscalYear;
    customRange: { from?: string; to?: string };
    setStandard: (standard: AccountingStandard) => void;
    setFiscalYear: (fy: FiscalYear) => void;
    setCustomRange: (range: { from?: string; to?: string }) => void;
}

export const useAccountingStore = create<AccountingState>()(
    persist(
        (set) => ({
            standard: 'GAAP',
            fiscalYear: 'current',
            customRange: {},
            setStandard: (standard) => set({ standard }),
            setFiscalYear: (fiscalYear) => set({ fiscalYear }),
            setCustomRange: (customRange) => set({ customRange }),
        }),
        {
            name: 'accounting-settings',
        }
    )
);
