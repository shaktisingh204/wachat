const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/hrm/payroll/reports/payroll-summary/page.tsx', 'utf8');

// 1. Add DeltaBadge and update StatCard
const replacement1 = `const fmt = (n: number) => \`₹\${n.toLocaleString('en-IN')}\`;

const DeltaBadge = ({ current, previous, invertColor }: { current: number, previous: number, invertColor?: boolean }) => {
    if (!previous || previous === 0) return null;
    if (current === previous) return <span className="text-[11px] text-zoru-ink-muted ml-2">No change</span>;
    
    const delta = ((current - previous) / previous) * 100;
    const isUp = delta > 0;
    const isGood = invertColor ? !isUp : isUp;

    return (
        <span className={\`text-[11px] font-medium ml-2 px-1.5 py-0.5 rounded-full \${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}\`}>
            {isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
        </span>
    );
};

const StatCard = ({ title, value, icon: Icon, sub, current, previous, invertColor }: { title: string; value: string; icon: React.ElementType; sub?: string; current?: number; previous?: number; invertColor?: boolean }) => (
    <Card className="flex flex-col gap-1 p-6">
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-zoru-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
        </div>
        <div className="mt-1 flex items-end">
            <p className="text-2xl text-zoru-ink">{value}</p>
            {current !== undefined && previous !== undefined && (
                <DeltaBadge current={current} previous={previous} invertColor={invertColor} />
            )}
        </div>
        {sub ? <p className="text-[11.5px] text-zoru-ink-muted">{sub}</p> : null}
    </Card>
);`;

// 2. Add previousTotals state and set it
const replacement2 = `    const [rows, setRows] = useState<PayrollRow[]>([]);
    const [totals, setTotals] = useState<Totals>({ grossSalary: 0, pf: 0, esi: 0, tds: 0, professionalTax: 0, totalDeductions: 0, netPay: 0 });
    const [previousTotals, setPreviousTotals] = useState<Totals | null>(null);
    const [totalEmployees, setTotalEmployees] = useState(0);`;

const replacement3 = `            if (result.error) {
                toast({ title: 'Error generating report', description: result.error, variant: 'destructive' });
            } else if (result.data) {
                setRows(result.data.rows);
                setTotals(result.data.totals);
                setPreviousTotals(result.data.previousTotals || null);
                setTotalEmployees(result.data.totalEmployees);
            }`;

// 3. Add Tally XML export button and function
const tallyExportCode = `    const handleTallyExport = () => {
        if (rows.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to export.' });
            return;
        }

        const dateStr = \`\${selectedYear}\${String(selectedMonth).padStart(2, '0')}01\`; // Or end of month
        const xml = \`<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>SabNode</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>\${dateStr}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>Payroll for \${MONTHS[selectedMonth - 1]} \${selectedYear}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Expense</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-\${totals.grossSalary}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>PF Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\${totals.pf}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>ESI Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\${totals.esi}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TDS Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\${totals.tds}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Professional Tax Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\${totals.professionalTax}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\${totals.netPay}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>\`;

        const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`tally_payroll_\${MONTHS[selectedMonth - 1]}_\${selectedYear}.xml\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };`;

const replacement4 = `        URL.revokeObjectURL(url);
    };

\${tallyExportCode}

    return (`;

// 4. Update the StatCards in JSX
const replacement5 = `            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={totalEmployees.toLocaleString()} icon={Users} />
                <StatCard 
                    title="Total Gross Payroll" 
                    value={fmt(totals.grossSalary)} 
                    icon={IndianRupee} 
                    sub={\`\${MONTHS[selectedMonth - 1]} \${selectedYear}\`}
                    current={totals.grossSalary}
                    previous={previousTotals?.grossSalary}
                />
                <StatCard 
                    title="Total Deductions" 
                    value={fmt(totals.totalDeductions)} 
                    icon={TrendingDown} 
                    current={totals.totalDeductions}
                    previous={previousTotals?.totalDeductions}
                    invertColor
                />
                <StatCard 
                    title="Total Net Pay" 
                    value={fmt(totals.netPay)} 
                    icon={Wallet} 
                    current={totals.netPay}
                    previous={previousTotals?.netPay}
                />
            </div>`;

// 5. Add Export Tally XML button next to Export CSV
const replacement6 = `                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isLoading || rows.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleTallyExport}
                            disabled={isLoading || rows.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Tally XML
                        </Button>
                    </>
                }`;

let newContent = content.replace(
    /const fmt = \(n: number\) => `₹\$\{n\.toLocaleString\('en-IN'\)\}`;[\s\S]*?<\/Card>\n\);/, 
    replacement1
);
newContent = newContent.replace(
    /    const \[rows, setRows\] = useState<PayrollRow\[\]>\(\[\]\);\n    const \[totals, setTotals\] = useState<Totals>\(\{ grossSalary: 0, pf: 0, esi: 0, tds: 0, professionalTax: 0, totalDeductions: 0, netPay: 0 \}\);\n    const \[totalEmployees, setTotalEmployees\] = useState\(0\);/,
    replacement2
);
newContent = newContent.replace(
    /            if \(result\.error\) \{\n                toast\(\{ title: 'Error generating report', description: result\.error, variant: 'destructive' \}\);\n            \} else if \(result\.data\) \{\n                setRows\(result\.data\.rows\);\n                setTotals\(result\.data\.totals\);\n                setTotalEmployees\(result\.data\.totalEmployees\);\n            \}/,
    replacement3
);
newContent = newContent.replace(
    /        URL\.revokeObjectURL\(url\);\n    \};\n\n    return \(/,
    replacement4
);
newContent = newContent.replace(
    /            \{\/\* Summary stat cards \*\/\}\n            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">\n                <StatCard title="Total Employees" value=\{totalEmployees\.toLocaleString\(\)\} icon=\{Users\} \/>\n                <StatCard title="Total Gross Payroll" value=\{fmt\(totals\.grossSalary\)\} icon=\{IndianRupee\} sub=\{\`\$\{MONTHS\[selectedMonth - 1\]\} \$\{selectedYear\}\`\} \/>\n                <StatCard title="Total Deductions" value=\{fmt\(totals\.totalDeductions\)\} icon=\{TrendingDown\} \/>\n                <StatCard title="Total Net Pay" value=\{fmt\(totals\.netPay\)\} icon=\{Wallet\} \/>\n            <\/div>/,
    replacement5
);
newContent = newContent.replace(
    /                        <Button\n                            variant="outline"\n                            onClick=\{handleDownload\}\n                            disabled=\{isLoading \|\| rows\.length === 0\}\n                        >\n                            <Download className="h-4 w-4" \/>\n                            Export CSV\n                        <\/Button>\n                    <\/>\n                \}/,
    replacement6
);

fs.writeFileSync('src/app/dashboard/hrm/payroll/reports/payroll-summary/page.tsx', newContent);
