const fs = require('fs');

const file = 'src/app/dashboard/crm/reports/tax/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /function labelTaxType\(row: TaxMonthlyRow\): TaxType {\n  \/\/ Heuristic: rows from the invoices collection represent GST\/VAT \(output\).\n  \/\/ Without a dedicated crm_tax_filings collection we classify all rows as GST.\n  return 'GST';\n}/,
  'function labelTaxType(row: TaxMonthlyRow): TaxType {\n  return (row.taxType as TaxType) || \'GST\';\n}'
);

content = content.replace(
  "    if (sp.taxType && sp.taxType !== 'GST') return false;",
  "    if (sp.taxType && labelTaxType(r) !== sp.taxType) return false;"
);

fs.writeFileSync(file, content);
