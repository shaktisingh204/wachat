const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/hrm/payroll/reports/payroll-summary/page.tsx', 'utf8');

const tallyExportCode = `    const handleTallyExport = () => {
        if (rows.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to export.' });
            return;
        }

        const dateStr = \\\`\\\${selectedYear}\\\${String(selectedMonth).padStart(2, '0')}01\\\`; // Or end of month
        const xml = \\\`<ENVELOPE>
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
            <DATE>\\\${dateStr}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <NARRATION>Payroll for \\\${MONTHS[selectedMonth - 1]} \\\${selectedYear}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Expense</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-\\\${totals.grossSalary}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>PF Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\\\${totals.pf}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>ESI Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\\\${totals.esi}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TDS Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\\\${totals.tds}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Professional Tax Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\\\${totals.professionalTax}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Salary Payable</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>\\\${totals.netPay}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>\\\`;

        const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \\\`tally_payroll_\\\${MONTHS[selectedMonth - 1]}_\\\${selectedYear}.xml\\\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };`;

content = content.replace('${tallyExportCode}', tallyExportCode.replace(/\\\\`/g, '`').replace(/\\\\\\\$/g, '$'));
fs.writeFileSync('src/app/dashboard/hrm/payroll/reports/payroll-summary/page.tsx', content);
