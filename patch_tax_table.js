const fs = require('fs');

const file = 'src/app/dashboard/crm/reports/tax/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('TaxSettlementButton')) {
    content = content.replace(
        "import { getTaxReportDeep } from '@/app/actions/worksuite/reports.actions';",
        "import { getTaxReportDeep } from '@/app/actions/worksuite/reports.actions';\nimport { TaxSettlementButton } from './_components/tax-settlement-button';"
    );
}

const oldHeaders = `
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Tax type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Collected</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Paid</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
              </ZoruTableRow>
`;
const newHeaders = `
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Tax type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Collected</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Paid</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Action</ZoruTableHead>
              </ZoruTableRow>
`;
content = content.replace(oldHeaders.trim(), newHeaders.trim());

const oldCells = `
                      <ZoruTableCell
                        className={\`text-right text-[13px] font-medium \${
                          r.net >= 0 ? 'text-zoru-warning-ink' : 'text-zoru-success-ink'
                        }\`}
                      >
                        {fmtMoney(r.net)}
                      </ZoruTableCell>
                    </ZoruTableRow>
`;
const newCells = `
                      <ZoruTableCell
                        className={\`text-right text-[13px] font-medium \${
                          r.net >= 0 ? 'text-zoru-warning-ink' : 'text-zoru-success-ink'
                        }\`}
                      >
                        {fmtMoney(r.net)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <TaxSettlementButton period={r.period} taxType={taxType} amount={r.net} />
                      </ZoruTableCell>
                    </ZoruTableRow>
`;
content = content.replace(oldCells.trim(), newCells.trim());

const oldColSpan = "colSpan={6}";
const newColSpan = "colSpan={7}";
content = content.replace(oldColSpan, newColSpan);

fs.writeFileSync(file, content);
