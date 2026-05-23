const fs = require('fs');
const file = 'src/app/dashboard/crm/reports/gstr-1/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { getSession } from '@/app/actions/user.actions';",
  "import { getAccountNamesByIds } from '@/app/actions/crm-accounts.actions';\nimport { getSession } from '@/app/actions/user.actions';"
);

const oldLogic = `
    const nameByAccount = new Map<string, string>();
    if (accountIds.length > 0) {
        const session = await getSession();
        if (session?.user) {
            try {
                const { db } = await connectToDatabase();
                const docs = (await db
                    .collection('crm_accounts')
                    .find({
                        userId: new ObjectId(String(session.user._id)),
                        _id: {
                            $in: accountIds
                                .filter((s) => ObjectId.isValid(s))
                                .map((s) => new ObjectId(s)),
                        },
                    })
                    .project({ name: 1 })
                    .toArray()) as Array<{ _id: ObjectId; name?: string }>;
                for (const a of docs) {
                    nameByAccount.set(String(a._id), a.name ?? 'Client');
                }
            } catch {
                // best-effort — falls back to "Client" label
            }
        }
    }
`;

const newLogic = `
    const nameByAccountMap = await getAccountNamesByIds(accountIds);
    const nameByAccount = new Map<string, string>(Object.entries(nameByAccountMap));
`;

content = content.replace(oldLogic.trim(), newLogic.trim());
fs.writeFileSync(file, content);
