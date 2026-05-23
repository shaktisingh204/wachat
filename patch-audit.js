const fs = require('fs');

const file = 'src/app/actions/crm-audit-log.actions.ts';
let content = fs.readFileSync(file, 'utf8');

const helper = `async function applySearchToQuery(
    q: Record<string, unknown>,
    search: string,
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
): Promise<void> {
    if (!search) return;

    const conditions: Record<string, unknown>[] = [];
    const textParts: string[] = [];

    const parts = search.split(/\\s+AND\\s+/i);

    for (const p of parts) {
        const part = p.trim();
        if (!part) continue;

        const match = part.match(/^(\\w+):(.+)$/);
        if (match) {
            const key = match[1].toLowerCase();
            const val = match[2].trim();
            const escapedVal = val.replace(/[.*+?^\\$\\{\\}()\\[\\]\\\\]/g, '\\\\$&');
            const rx = { $regex: escapedVal, $options: 'i' };

            if (key === 'user' || key === 'actor') {
                conditions.push({ $or: [{ actorName: rx }, { actorId: val }] });
            } else if (key === 'action') {
                conditions.push({ action: rx });
            } else if (key === 'entity') {
                conditions.push({ entityKind: rx });
            } else if (key === 'id') {
                conditions.push({ entityId: val });
            } else {
                conditions.push({ [\`diff.\${key}.after\`]: rx });
            }
        } else {
            textParts.push(part);
        }
    }

    if (textParts.length > 0) {
        const textQuery = textParts.join(' ');
        const useText = await hasTextIndex(db);
        if (useText) {
            conditions.push({ $text: { $search: textQuery } });
        } else {
            const escaped = textQuery.replace(/[.*+?^\\$\\{\\}()\\[\\]\\\\]/g, '\\\\$&');
            const rx = { $regex: escaped, $options: 'i' };
            conditions.push({
                $or: [
                    { reason: rx },
                    { entityId: rx },
                    { entityKind: rx },
                    { actorName: rx },
                    { 'diff.$**': rx } as Record<string, unknown>,
                ],
            });
        }
    }

    if (conditions.length > 0) {
        if (q.$and) {
            (q.$and as Record<string, unknown>[]).push(...conditions);
        } else {
            q.$and = conditions;
        }
    }
}
`;

content = content.replace('function buildAuditQuery(', helper + '\nfunction buildAuditQuery(');

const originalSearchBlock = `        const search = (query.search ?? '').trim();
        if (search) {
            const useText = await hasTextIndex(db);
            if (useText) {
                q.$text = { $search: search };
            } else {
                const escaped = search.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
                const rx = { $regex: escaped, $options: 'i' };
                q.$or = [
                    { reason: rx },
                    { entityId: rx },
                    { entityKind: rx },
                    { actorName: rx },
                    { 'diff.$**': rx } as Record<string, unknown>,
                ];
            }
        }`;

content = content.replaceAll(originalSearchBlock, `        const search = (query.search ?? '').trim();
        if (search) {
            await applySearchToQuery(q, search, db);
        }`);

fs.writeFileSync(file, content);
