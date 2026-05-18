import type { EmployeeListRow } from './types';

export interface EmployeeKpis {
  total: number;
  active: number;
  onLeave: number;
  exited: number;
}

export function computeEmployeeKpis(rows: EmployeeListRow[]): EmployeeKpis {
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    onLeave: rows.filter((r) => r.status === 'on_leave').length,
    exited: rows.filter((r) => r.status === 'exited').length,
  };
}
