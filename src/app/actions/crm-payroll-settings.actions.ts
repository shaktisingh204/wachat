'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export type PayrollSettings = {
  payFrequency: string;
  currency: string;
  taxRegime: string;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  pfEnabled: boolean;
  esiEnabled: boolean;
  ptEnabled: boolean;
  tdsEnabled: boolean;
  payslipTemplate: string;
  workingDaysPerWeek: number;
  overtimeEnabled: boolean;
  lateMarkingGraceMins: number;
  approvalRequired: boolean;
  approverUserId: string;
  notifyOnPayslip: boolean;
};

const DEFAULTS: PayrollSettings = {
  payFrequency: 'monthly',
  currency: 'INR',
  taxRegime: 'new',
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  pfWageCeiling: 15000,
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  esiWageCeiling: 21000,
  pfEnabled: true,
  esiEnabled: true,
  ptEnabled: true,
  tdsEnabled: true,
  payslipTemplate: 'standard',
  workingDaysPerWeek: 5,
  overtimeEnabled: false,
  lateMarkingGraceMins: 15,
  approvalRequired: false,
  approverUserId: '',
  notifyOnPayslip: true,
};

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const session = await getSession();
  if (!session?.user) return DEFAULTS;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_payroll_settings').findOne({
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return DEFAULTS;
    const { _id, userId, ...rest } = doc;
    return { ...DEFAULTS, ...rest } as PayrollSettings;
  } catch {
    return DEFAULTS;
  }
}

export async function savePayrollSettings(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const bool = (k: string) => formData.get(k) === 'true' || formData.get(k) === 'on';
  const num = (k: string, def: number) => {
    const v = formData.get(k);
    if (!v) return def;
    const n = parseFloat(v as string);
    return isNaN(n) ? def : n;
  };
  const str = (k: string, def = '') =>
    ((formData.get(k) as string | null)?.trim()) || def;

  const settings: PayrollSettings = {
    payFrequency: str('payFrequency', 'monthly'),
    currency: str('currency', 'INR'),
    taxRegime: str('taxRegime', 'new'),
    pfEmployeeRate: num('pfEmployeeRate', 12),
    pfEmployerRate: num('pfEmployerRate', 12),
    pfWageCeiling: num('pfWageCeiling', 15000),
    esiEmployeeRate: num('esiEmployeeRate', 0.75),
    esiEmployerRate: num('esiEmployerRate', 3.25),
    esiWageCeiling: num('esiWageCeiling', 21000),
    pfEnabled: bool('pfEnabled'),
    esiEnabled: bool('esiEnabled'),
    ptEnabled: bool('ptEnabled'),
    tdsEnabled: bool('tdsEnabled'),
    payslipTemplate: str('payslipTemplate', 'standard'),
    workingDaysPerWeek: num('workingDaysPerWeek', 5),
    overtimeEnabled: bool('overtimeEnabled'),
    lateMarkingGraceMins: num('lateMarkingGraceMins', 15),
    approvalRequired: bool('approvalRequired'),
    approverUserId: str('approverUserId'),
    notifyOnPayslip: bool('notifyOnPayslip'),
  };

  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_payroll_settings').updateOne(
      { userId: new ObjectId(session.user._id as string) },
      { $set: { ...settings, userId: new ObjectId(session.user._id as string), updatedAt: new Date() } },
      { upsert: true },
    );
    revalidatePath('/dashboard/hrm/payroll/settings');
    return { message: 'Payroll settings saved.' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to save settings: ${msg}` };
  }
}
