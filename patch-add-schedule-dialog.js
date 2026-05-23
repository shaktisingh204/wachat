const fs = require('fs');
const file = 'src/components/crm/analytics/analytics-dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
    "import { jsPDF } from 'jspdf';",
    "import { jsPDF } from 'jspdf';\nimport { ScheduleReportDialog } from './schedule-report-dialog';"
);

// Add component to toolbar
content = content.replace(
    "<div className=\"flex items-center bg-muted rounded-md p-1\">",
    "<ScheduleReportDialog />\n                <div className=\"flex items-center bg-muted rounded-md p-1\">"
);

fs.writeFileSync(file, content);
