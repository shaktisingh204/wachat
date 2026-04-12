
'use server';

function parseTable(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            throw new Error('Lookup table is not valid JSON. Expected an array of objects.');
        }
    }
    throw new Error('Lookup table must be a JSON array.');
}

export async function executeLookupTableAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const table = parseTable(inputs.table);

        switch (actionName) {
            case 'findByKey': {
                const keyField = String(inputs.keyField ?? 'key').trim() || 'key';
                const lookupValue = inputs.lookupValue;
                if (lookupValue === undefined || lookupValue === null || String(lookupValue) === '') {
                    throw new Error('lookupValue is required.');
                }
                const target = String(lookupValue);
                const match = table.find((row: any) => row && String(row[keyField]) === target);
                logger.log(`[LookupTable] findByKey ${keyField}=${target} → ${match ? 'found' : 'not found'}`);
                return {
                    output: {
                        match: match ?? null,
                        found: String(Boolean(match)),
                    },
                };
            }

            case 'findByField': {
                const field = String(inputs.field ?? '').trim();
                const value = inputs.value;
                if (!field) throw new Error('field is required.');
                const target = String(value);
                const match = table.find((row: any) => row && String(row[field]) === target);
                logger.log(`[LookupTable] findByField ${field}=${target} → ${match ? 'found' : 'not found'}`);
                return {
                    output: {
                        match: match ?? null,
                        found: String(Boolean(match)),
                    },
                };
            }

            case 'filterRows': {
                const field = String(inputs.field ?? '').trim();
                const value = inputs.value;
                if (!field) throw new Error('field is required.');
                const target = String(value);
                const matches = table.filter((row: any) => row && String(row[field]) === target);
                return {
                    output: {
                        matches,
                        count: matches.length,
                    },
                };
            }

            default:
                return { error: `Lookup Table action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Lookup Table action failed.' };
    }
}
