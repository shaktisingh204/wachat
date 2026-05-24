import { readFile, writeFile } from 'fs/promises';

async function run() {
    const filePath = 'src/lib/rust-client/crm-payslips.ts';
    let code = await readFile(filePath, 'utf-8');

    if (!code.includes('generate:')) {
        const replacement = `  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      \`/v1/crm/payslips/\${encodeURIComponent(id)}\`,
      { method: 'DELETE' },
    ),
  generate: (month: number, year: number) =>
    rustFetch<{ payrollData: any[] }>(
      '/v1/crm/payslips/generate',
      { method: 'POST', body: JSON.stringify({ month, year }) }
    ),`;
        code = code.replace(`  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      \`/v1/crm/payslips/\${encodeURIComponent(id)}\`,
      { method: 'DELETE' },
    ),`, replacement);
        await writeFile(filePath, code);
        console.log('Patched rust-client');
    }
}
run().catch(console.error);
