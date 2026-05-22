import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<Record<string, string | string[]>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyHrPayrollRedirect({ params, searchParams }: PageProps) {
  const p = await params;
  const sp = await searchParams;

  const KEY_REMAP: Record<string, string> = { 'id': 'employeeId' };
  let target = '/dashboard/hrm/payroll/employees/[employeeId]/edit';
  for (const [key, value] of Object.entries(p)) {
    const v = Array.isArray(value) ? value[0] : value;
    const targetKey = KEY_REMAP[key] ?? key;
    if (v) target = target.replace(`[${targetKey}]`, encodeURIComponent(v));
  }

  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') usp.set(key, value);
    else if (Array.isArray(value) && value[0]) usp.set(key, value[0]);
  }
  const qs = usp.toString();
  permanentRedirect(target + (qs ? `?${qs}` : ''));
}
