import { readFile, writeFile } from 'fs/promises';

async function run() {
    const filePath = 'src/app/actions/crm-payroll.actions.ts';
    let code = await readFile(filePath, 'utf-8');

    const searchStr = `export async function generatePayrollData(month: number, year: number): Promise<{ payrollData?: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();`;
        
    const replacement = `export async function generatePayrollData(month: number, year: number): Promise<{ payrollData?: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    if (useRustCrm()) {
        try {
            const result = await crmPayslipsApi.generate(month, year);
            return { payrollData: result.payrollData };
        } catch (e) {
            console.error('[generatePayrollData] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payroll',
                op: 'generate',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();`;

    if (code.includes(searchStr)) {
        code = code.replace(searchStr, replacement);
        await writeFile(filePath, code);
        console.log('Successfully patched generatePayrollData');
    } else {
        console.log('Could not find generatePayrollData block.');
    }
}
run().catch(console.error);
