
'use server';

function parseSource(raw: any): any {
    if (raw === undefined || raw === null) throw new Error('source is required.');
    if (typeof raw === 'object') return raw;
    const trimmed = String(raw).trim();
    if (!trimmed) throw new Error('source is empty.');
    try {
        return JSON.parse(trimmed);
    } catch {
        throw new Error('source is not valid JSON.');
    }
}

function parseFieldList(raw: any): string[] {
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'string') {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function getAtPath(obj: any, path: string): any {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else return undefined;
    }
    return cur;
}

function setAtPath(obj: any, path: string, value: any) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in cur) || typeof cur[p] !== 'object' || cur[p] === null) {
            cur[p] = {};
        }
        cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
}

function flattenObject(obj: any, prefix = '', out: Record<string, any> = {}): Record<string, any> {
    if (obj === null || obj === undefined) return out;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        if (prefix) out[prefix] = obj;
        return out;
    }
    for (const [k, v] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            flattenObject(v, newKey, out);
        } else {
            out[newKey] = v;
        }
    }
    return out;
}

export async function executeSelectTransformJsonAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const source = parseSource(inputs.source);

        switch (actionName) {
            case 'pickFields': {
                const fields = parseFieldList(inputs.fields);
                if (fields.length === 0) throw new Error('fields list is empty.');
                if (source === null || typeof source !== 'object') {
                    throw new Error('source must be an object for pickFields.');
                }
                const result: Record<string, any> = {};
                for (const f of fields) {
                    const v = getAtPath(source, f);
                    if (v !== undefined) setAtPath(result, f, v);
                }
                return { output: { result } };
            }

            case 'omitFields': {
                const fields = parseFieldList(inputs.fields);
                if (source === null || typeof source !== 'object') {
                    throw new Error('source must be an object for omitFields.');
                }
                const clone = JSON.parse(JSON.stringify(source));
                for (const f of fields) {
                    const parts = f.split('.');
                    let cur = clone;
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!cur || typeof cur !== 'object') break;
                        cur = cur[parts[i]];
                    }
                    if (cur && typeof cur === 'object') {
                        delete cur[parts[parts.length - 1]];
                    }
                }
                return { output: { result: clone } };
            }

            case 'renameField': {
                const fromKey = String(inputs.fromKey ?? '').trim();
                const toKey = String(inputs.toKey ?? '').trim();
                if (!fromKey || !toKey) throw new Error('fromKey and toKey are required.');
                if (source === null || typeof source !== 'object' || Array.isArray(source)) {
                    throw new Error('source must be an object for renameField.');
                }
                const clone: Record<string, any> = { ...source };
                if (fromKey in clone) {
                    clone[toKey] = clone[fromKey];
                    delete clone[fromKey];
                }
                return { output: { result: clone } };
            }

            case 'flatten': {
                if (source === null || typeof source !== 'object') {
                    throw new Error('source must be an object for flatten.');
                }
                const result = flattenObject(source);
                return { output: { result } };
            }

            default:
                return { error: `Select Transform JSON action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Select Transform JSON action failed.' };
    }
}
