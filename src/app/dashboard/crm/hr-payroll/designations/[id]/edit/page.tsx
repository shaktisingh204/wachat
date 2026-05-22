import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<Record<string, string | string[]>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyHrPayrollRedirect({ params, searchParams }: PageProps) {
  const p = await params;
  const sp = await searchParams;

  let target = '/dashboard/hrm/payroll/designations/[id]/edit';
  for (const [key, value] of Object.entries(p)) {
    const v = Array.isArray(value) ? value[0] : value;
    const targetKey = key;
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
