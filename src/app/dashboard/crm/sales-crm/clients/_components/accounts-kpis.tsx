'use client';

export interface AccountKpis {
  total: number;
  active: number;
  strategic: number;
  key: number;
  archived: number;
}

export const EMPTY_ACCOUNT_KPIS: AccountKpis = {
  total: 0,
  active: 0,
  strategic: 0,
  key: 0,
  archived: 0,
};

export function AccountsKpiStrip(_props: any): null {
  return null;
}
