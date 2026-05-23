const fs = require('fs');
const file = 'src/app/dashboard/crm/reports/gstr-2b/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { getSession } from '@/app/actions/user.actions';",
  "import { getVendorNamesByIds } from '@/app/actions/crm-vendors.actions';\nimport { getGstr2bTrend } from '@/app/actions/crm-india-gst.actions';\nimport { getSession } from '@/app/actions/user.actions';"
);

const oldLogic1 = `
    const vendorNameById = new Map<string, string>();
    const session = await getSession();
    const tenantId = session?.user
        ? new ObjectId(String(session.user._id))
        : null;

    if (tenantId && vendorIds.length > 0) {
        try {
            const { db } = await connectToDatabase();
            const docs = (await db
                .collection('crm_vendors')
                .find({
                    userId: tenantId,
                    _id: {
                        $in: vendorIds
                            .filter((s) => ObjectId.isValid(s))
                            .map((s) => new ObjectId(s)),
                    },
                })
                .project({ name: 1, displayName: 1 })
                .toArray()) as Array<{
                _id: ObjectId;
                name?: string;
                displayName?: string;
            }>;
            for (const v of docs) {
                vendorNameById.set(
                    String(v._id),
                    v.displayName || v.name || 'Vendor',
                );
            }
        } catch {
            // best-effort
        }
    }
`;

const newLogic1 = `
    const vendorNameMap = await getVendorNamesByIds(vendorIds);
    const vendorNameById = new Map<string, string>(Object.entries(vendorNameMap));
`;

content = content.replace(oldLogic1.trim(), newLogic1.trim());

const oldLogic2 = `
    // Build a 6-month trend by reading \`crm_gstr2b_imports\` directly so
    // the line chart works even when only some months have been imported.
    let trend: Gstr2bTrendDatum[] = [];
    if (tenantId) {
        try {
            const { db } = await connectToDatabase();
            const trendDocs = (await db
                .collection('crm_gstr2b_imports')
                .find({ userId: tenantId })
                .project({
                    period: 1,
                    periodMonth: 1,
                    periodYear: 1,
                    totalItcAvailable: 1,
                    totalItcIneligible: 1,
                })
                .sort({ periodYear: -1, periodMonth: -1 })
                .limit(6)
                .toArray()) as Array<{
                period?: string;
                periodMonth?: number;
                periodYear?: number;
                totalItcAvailable?: {
                    igst: number;
                    cgst: number;
                    sgst: number;
                    cess: number;
                };
                totalItcIneligible?: {
                    igst: number;
                    cgst: number;
                    sgst: number;
                    cess: number;
                };
            }>;
            trend = trendDocs
                .map((d) => ({
                    period: d.period ?? '',
                    itcAvailable: Math.round(sumItc(d.totalItcAvailable)),
                    itcReversed: Math.round(sumItc(d.totalItcIneligible)),
                }))
                .reverse(); // oldest first for the chart
        } catch {
            // best-effort
        }
    }
`;

const newLogic2 = `
    // Build a 6-month trend by reading \`crm_gstr2b_imports\` directly so
    // the line chart works even when only some months have been imported.
    let trend: Gstr2bTrendDatum[] = await getGstr2bTrend(6);
`;

content = content.replace(oldLogic2.trim(), newLogic2.trim());

fs.writeFileSync(file, content);
