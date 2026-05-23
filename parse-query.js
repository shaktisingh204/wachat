function parseAdvancedQuery(search) {
    const conditions = [];
    const textParts = [];

    // Split by " AND " 
    const parts = search.split(/\s+AND\s+/i);

    for (const p of parts) {
        const part = p.trim();
        if (!part) continue;

        const match = part.match(/^(\w+):(.+)$/);
        if (match) {
            const key = match[1].toLowerCase();
            const val = match[2].trim();
            const escapedVal = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
                // Generic fallback for diff fields
                conditions.push({ [`diff.${key}.after`]: rx });
            }
        } else {
            textParts.push(part);
        }
    }
    return { conditions, textQuery: textParts.join(' ') };
}
console.log(parseAdvancedQuery("user:john AND action:delete AND something else"));
