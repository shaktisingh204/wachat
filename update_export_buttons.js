const fs = require('fs');
const file = 'src/app/dashboard/hrm/permission-groups/_components/permission-groups-client.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<Button variant="outline" size="sm" onClick=\{handleExport\}>\s*<FileDown className="h-3.5 w-3.5" \/>\s*Export\s*<\/Button>/,
  `<Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              PDF
            </Button>`
);

fs.writeFileSync(file, content);
