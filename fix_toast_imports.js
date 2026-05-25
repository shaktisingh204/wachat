const fs = require('fs');

const file1 = 'src/app/dashboard/hrm/payroll/leave/balance/client.tsx';
if (fs.existsSync(file1)) {
    let content = fs.readFileSync(file1, 'utf8');
    content = content.replace(/import\s*\{\s*useToast\s*\}\s*from\s*['"]@\/components\/zoruui\/use-zoru-toast['"];?/, "import { useZoruToast as useToast } from '@/components/zoruui/use-zoru-toast';");
    fs.writeFileSync(file1, content);
}

const file2 = 'src/app/dashboard/hrm/portal/reports/page.tsx';
if (fs.existsSync(file2)) {
    let content = fs.readFileSync(file2, 'utf8');
    content = content.replace(/import\s*\{\s*useZoruToast\s*\}\s*from\s*['"]@\/hooks\/use-toast['"];?/, "import { useZoruToast } from '@/components/zoruui/use-zoru-toast';");
    fs.writeFileSync(file2, content);
}

