'use client';

import { PlusCircle } from 'lucide-react';
import {
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import type { WithId, EmailSettings } from '@/lib/definitions';

interface EmailAccountSwitcherProps {
  accounts: WithId<EmailSettings>[];
  activeAccount: WithId<EmailSettings>;
  onChange: (next: string) => void;
}

export function EmailAccountSwitcher({
  accounts,
  activeAccount,
  onChange,
}: EmailAccountSwitcherProps) {
  return (
    <div className="px-2">
      <Select value={activeAccount._id.toString()} onValueChange={onChange}>
        <ZoruSelectTrigger className="w-full">
          <ZoruSelectValue placeholder="Select account" />
        </ZoruSelectTrigger>
        <ZoruSelectContent className="max-w-[300px]">
          <ZoruSelectItem value="back_to_list" className="font-medium text-[var(--st-text-secondary)] mb-1">
            ← All accounts
          </ZoruSelectItem>

          <div className="max-h-[220px] overflow-y-auto">
            {accounts.map((acc) => (
              <ZoruSelectItem key={acc._id.toString()} value={acc._id.toString()}>
                <div className="flex flex-col items-start text-left overflow-hidden">
                  <span className="font-semibold text-sm truncate w-full">
                    {acc.fromName || 'Account'}
                  </span>
                  <span className="text-xs text-[var(--st-text-secondary)] truncate w-full">
                    {acc.fromEmail}
                  </span>
                </div>
              </ZoruSelectItem>
            ))}
          </div>

          <div className="h-px bg-[var(--st-border)] my-1" />
          <ZoruSelectItem value="connect_new" className="text-[var(--st-text)] focus:text-[var(--st-text)] font-medium py-3">
            <div className="flex items-center gap-2 font-semibold">
              <PlusCircle className="h-4 w-4" /> Connect a new account
            </div>
          </ZoruSelectItem>
        </ZoruSelectContent>
      </Select>
    </div>
  );
}
