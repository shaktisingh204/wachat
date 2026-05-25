const fs = require('fs');

const file = 'src/app/dashboard/hrm/permission-groups/_components/assign-group-sheet.tsx';
let content = fs.readFileSync(file, 'utf8');

// add import
content = content.replace(
  "import { UserCheck } from 'lucide-react';",
  "import { UserCheck } from 'lucide-react';\nimport { AssignmentForm } from './assignment-form';"
);

// replace form
content = content.replace(
  /<div className="space-y-2">\s*<Label htmlFor="emp-select">Employee<\/Label>[\s\S]*?Leave blank to remove the employee&apos;s current group\.\s*<\/p>\s*<\/div>/m,
  `<AssignmentForm
            employees={employees}
            groups={groups}
            employeeId={employeeId}
            groupId={groupId}
            onEmployeeChange={setEmployeeId}
            onGroupChange={setGroupId}
          />`
);

fs.writeFileSync(file, content);
