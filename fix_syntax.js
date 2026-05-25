const fs = require('fs');
const path = require('path');

const filesToFix = {
    // 1. remove duplicate Download
    "src/app/dashboard/finance/taxes/_components/taxes-list-client.tsx": (content) => {
        return content.replace(/Download,\s*Download,/g, 'Download,');
    },
    // 2. SEVERITY_TONE
    "src/app/dashboard/hrm/hr/notices/page.tsx": (content) => {
        // keep only the first const SEVERITY_TONE = ... block?
        let m = content.match(/const SEVERITY_TONE[\s\S]*?};/g);
        if (m && m.length > 1) {
            content = content.replace(m[1], ''); // remove second
        }
        return content;
    },
    // 3. Search, SlidersHorizontal in sets-grid
    "src/app/dashboard/telegram/stickers/_components/sets-grid.tsx": (content) => {
        return content.replace(/import\s*\{\s*Search,\s*SlidersHorizontal,\s*SabFilePickerButton/g, 'import { SabFilePickerButton')
                      .replace(/import\s*\{\s*Search,\s*SlidersHorizontal,\s*useProject\s*\}\s*from/g, 'import { useProject } from')
                      .replace(/import\s*\{\s*Search,\s*SlidersHorizontal,\s*TelegramProjectGate/g, 'import { TelegramProjectGate');
    },
    // 4. canLaunch in quick-send
    "src/app/sabsms/quick-send/quick-send-client.tsx": (content) => {
        // remove duplicate const canLaunch
        let count = 0;
        return content.replace(/const canLaunch =/g, (match) => {
            count++;
            return count === 2 ? '// const canLaunch =' : match;
        });
    },
    // 5. dynamic in products page
    "src/app/dashboard/crm/products/[productId]/page.tsx": (content) => {
        return content.replace(/export const dynamic = 'force-dynamic';\s*export const dynamic = 'force-dynamic';/g, "export const dynamic = 'force-dynamic';");
    },
    "src/app/dashboard/n8n/[workflowId]/page.tsx": (content) => {
        let count = 0;
        return content.replace(/export const dynamic = 'force-dynamic';/g, (m) => {
            count++;
            return count > 1 ? '' : m;
        });
    },
    "src/app/dashboard/portfolio/manage/[portfolioId]/builder/page.tsx": (content) => {
        let count = 0;
        return content.replace(/export const dynamic = 'force-dynamic';/g, (m) => {
            count++;
            return count > 1 ? '' : m;
        });
    },
    // 6. getDisciplinaryCases duplicate in hr.actions.ts
    "src/app/actions/hr.actions.ts": (content) => {
        // Just comment out the second export async function getDisciplinaryCases
        let idx1 = content.indexOf('export async function getDisciplinaryCases');
        let idx2 = content.indexOf('export async function getDisciplinaryCases', idx1 + 1);
        if (idx2 !== -1) {
            // Find end of block for idx2
            let endIdx = content.indexOf('}', idx2);
            let p1 = content.substring(0, idx2);
            let p2 = content.substring(idx2, endIdx + 1);
            let p3 = content.substring(endIdx + 1);
            content = p1 + "/* " + p2 + " */" + p3;
        }
        return content;
    },
    // 7. useRef duplicate
    "src/app/dashboard/instagram/connections/ConnectionsClient.tsx": (content) => {
        let count = 0;
        return content.replace(/import \{ useRef \} from 'react';/g, (m) => {
            count++;
            return count > 1 ? '' : m;
        });
    },
    // 8. warehouse duplicate
    "src/app/dashboard/crm/inventory/warehouses/[id]/page.tsx": (content) => {
        return content.replace(/const warehouse = await getCrmWarehouseById\(id\);\s*if \(!warehouse\) notFound\(\);/g, (m, offset, str) => {
            if (offset === str.indexOf(m)) return m;
            return '';
        });
    },
    // 9. fmtINR duplicate
    "src/app/dashboard/hrm/hr/awards/[programId]/page.tsx": (content) => {
        let c = 0;
        return content.replace(/function fmtINR\(/g, (m) => {
            c++;
            return c > 1 ? 'function fmtINR2(' : m; // Just rename the second one to fix syntax
        });
    },
    // 10. auth.ts service account
    "src/lib/auth.ts": (content) => {
        return content.replace(/import \{ serviceAccount \} from '.\/firebase\/service-account';/, "const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : {};");
    },
    // 11. use-toast
    "src/app/dashboard/hrm/portal/reports/page.tsx": (content) => {
        return content.replace(/@\/components\/zoruui\/hooks\/use-toast/, "@/hooks/use-toast");
    }
};

for (const [filepath, fixFn] of Object.entries(filesToFix)) {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf8');
        let newContent = fixFn(content);
        if (content !== newContent) {
            fs.writeFileSync(filepath, newContent);
            console.log(`Fixed ${filepath}`);
        }
    }
}
