const fs = require('fs');
const file = 'src/components/crm/analytics/schedule-report-dialog.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "import { toast } from 'react-hot-toast';",
    "import { toast } from 'react-hot-toast';\nimport { scheduleAnalyticsReport } from '@/app/actions/crm-analytics-reports.actions';"
);

content = content.replace(
    "        // Simulate API call to schedule report\n        await new Promise(resolve => setTimeout(resolve, 1000));",
    `        const formData = new FormData(e.currentTarget);
        const emails = formData.get('emails') as string;
        const frequency = formData.get('frequency') as any;
        const format = formData.get('format') as any;

        try {
            await scheduleAnalyticsReport({
                emails: emails.split(',').map(e => e.trim()),
                frequency,
                format
            });
        } catch (err) {
            toast.error('Failed to schedule report');
            setLoading(false);
            return;
        }`
);

content = content.replace(
    "<Input \n                            type=\"email\" \n                            required \n                            placeholder=\"comma separated emails...\" \n                        />",
    "<Input \n                            name=\"emails\"\n                            type=\"text\" \n                            required \n                            placeholder=\"comma separated emails...\" \n                        />"
);

content = content.replace(
    "<Select required defaultValue=\"weekly\">",
    "<Select required defaultValue=\"weekly\" name=\"frequency\">"
);

content = content.replace(
    "<Select required defaultValue=\"pdf\">",
    "<Select required defaultValue=\"pdf\" name=\"format\">"
);

fs.writeFileSync(file, content);
