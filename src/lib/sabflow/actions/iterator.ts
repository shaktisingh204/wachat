
'use server';

function parseArray(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (raw === undefined || raw === null || raw === '') {
        throw new Error('array is required.');
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            throw new Error('not array');
        } catch {
            throw new Error('array must be a valid JSON array.');
        }
    }
    throw new Error('array must be an array or JSON string.');
}

function coerceCount(raw: any): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error('Count must be a non-negative number.');
    return Math.floor(n);
}

export async function executeIteratorAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const arr = parseArray(inputs.array);

        switch (actionName) {
            case 'spread': {
                return {
                    output: {
                        items: arr,
                        count: arr.length,
                        first: arr[0] ?? null,
                        last: arr[arr.length - 1] ?? null,
                    },
                };
            }

            case 'getFirst': {
                const n = coerceCount(inputs.n);
                const items = arr.slice(0, n);
                return { output: { items, count: items.length } };
            }

            case 'getLast': {
                const n = coerceCount(inputs.n);
                const items = n === 0 ? [] : arr.slice(-n);
                return { output: { items, count: items.length } };
            }

            case 'chunk': {
                const size = coerceCount(inputs.size);
                if (size === 0) throw new Error('Chunk size must be > 0.');
                const chunks: any[][] = [];
                for (let i = 0; i < arr.length; i += size) {
                    chunks.push(arr.slice(i, i + size));
                }
                return { output: { chunks, count: chunks.length } };
            }

            case 'mapField': {
                const field = String(inputs.field ?? '').trim();
                if (!field) throw new Error('field is required.');
                const values = arr
                    .map((item: any) =>
                        item && typeof item === 'object' ? item[field] : undefined
                    )
                    .filter((v: any) => v !== undefined);
                return { output: { values, count: values.length } };
            }

            case 'filterByField': {
                const field = String(inputs.field ?? '').trim();
                if (!field) throw new Error('field is required.');
                const target = String(inputs.value ?? '');
                const items = arr.filter(
                    (item: any) => item && typeof item === 'object' && String(item[field]) === target
                );
                return { output: { items, count: items.length } };
            }

            default:
                return { error: `Iterator action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Iterator action failed.' };
    }
}
