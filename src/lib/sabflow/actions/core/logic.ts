
export async function executeFilterAction(actionName: string, inputs: any) {
    const { field, operator, value } = inputs;

    // Helper to compare values
    const compare = (a: any, b: any, op: string) => {
        const stringA = String(a).toLowerCase();
        const stringB = String(b).toLowerCase();

        switch (op) {
            case 'equals': return stringA === stringB;
            case 'not_equals': return stringA !== stringB;
            case 'contains': return stringA.includes(stringB);
            case 'not_contains': return !stringA.includes(stringB);
            case 'greater_than': return Number(a) > Number(b);
            case 'less_than': return Number(a) < Number(b);
            case 'start_with': return stringA.startsWith(stringB);
            case 'end_with': return stringA.endsWith(stringB);
            default: return false;
        }
    };

    const isMatch = compare(field, value, operator);

    if (actionName === 'continueIf') {
        if (!isMatch) {
            return { control: { stop: true, reason: 'Condition not met (Continue If)' }, output: { result: false } };
        }
    } else if (actionName === 'stopIf') {
        if (isMatch) {
            return { control: { stop: true, reason: 'Condition met (Stop If)' }, output: { result: true } };
        }
    }

    return { output: { result: true } };
}

export async function executeDelayAction(actionName: string, inputs: any) {
    if (actionName === 'waitFor') {
        let duration = Number(inputs.value);
        const unit = inputs.unit;

        if (isNaN(duration) || duration <= 0) return { output: { status: 'skipped' } };

        // Convert to milliseconds
        switch (unit) {
            case 'seconds': duration *= 1000; break;
            case 'minutes': duration *= 60000; break;
            case 'hours': duration *= 3600000; break;
            default: duration *= 1000; // default to seconds
        }

        // Cap delay at 5 minutes for synchronous execution to avoid server timeouts
        // Real production systems should use a queue for longer delays.
        if (duration > 300000) {
            console.warn('Delay duration capped at 5 minutes for synchronous execution.');
            duration = 300000;
        }

        await new Promise(resolve => setTimeout(resolve, duration));
        return { output: { status: 'completed', durationMs: duration } };
    }
    return { error: 'Unknown delay action' };
}

/**
 * Router: evaluates a list of routes, each with an `id` and `rules` array,
 * and returns the ID of the first route whose rules match. Rule format:
 *   { field: 'left', operator: 'equals', value: 'right' }
 * Logic is AND across rules of a route (all must match). Optionally a route
 * can set `logicType: 'OR'` to require any rule to match. Routes missing
 * `rules` or with empty rules are treated as the default / fallback.
 */
export async function executeRouterAction(actionName: string, inputs: any) {
    if (actionName !== 'route') {
        return { error: 'Unknown router action' };
    }

    let routes: any[] = [];
    try {
        const raw = inputs.routes;
        if (Array.isArray(raw)) {
            routes = raw;
        } else if (typeof raw === 'string' && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) routes = parsed;
        }
    } catch {
        return { error: 'Router "routes" must be a JSON array.' };
    }

    if (routes.length === 0) {
        return { output: { routeId: 'default', matched: false } };
    }

    const compare = (a: any, b: any, op: string): boolean => {
        const strA = a === null || a === undefined ? '' : String(a);
        const strB = b === null || b === undefined ? '' : String(b);
        const lowA = strA.toLowerCase();
        const lowB = strB.toLowerCase();
        const numA = Number(strA);
        const numB = Number(strB);
        switch (op) {
            case 'equals': return lowA === lowB;
            case 'not_equals': return lowA !== lowB;
            case 'contains': return lowA.includes(lowB);
            case 'not_contains': return !lowA.includes(lowB);
            case 'starts_with': return lowA.startsWith(lowB);
            case 'ends_with': return lowA.endsWith(lowB);
            case 'gt':
            case 'greater_than':
                return Number.isFinite(numA) && Number.isFinite(numB) && numA > numB;
            case 'lt':
            case 'less_than':
                return Number.isFinite(numA) && Number.isFinite(numB) && numA < numB;
            case 'is_empty':
                return strA.trim() === '';
            case 'is_not_empty':
                return strA.trim() !== '';
            default:
                return false;
        }
    };

    for (const route of routes) {
        const rules: any[] = Array.isArray(route?.rules) ? route.rules : [];
        const routeId = route?.id || route?.label || null;

        // Default/fallback route (no rules) — only pick if no earlier route matched.
        if (rules.length === 0) continue;

        const logicType = (route?.logicType || 'AND').toUpperCase();
        let matched: boolean;
        if (logicType === 'OR') {
            matched = rules.some((r: any) => compare(r?.field, r?.value, String(r?.operator || 'equals')));
        } else {
            matched = rules.every((r: any) => compare(r?.field, r?.value, String(r?.operator || 'equals')));
        }

        if (matched) {
            return { output: { routeId: routeId || 'unnamed', matched: true } };
        }
    }

    // No rule-route matched → pick first ruleless default route if any
    const defaultRoute = routes.find((r: any) => !r?.rules || (Array.isArray(r.rules) && r.rules.length === 0));
    if (defaultRoute) {
        return { output: { routeId: defaultRoute.id || defaultRoute.label || 'default', matched: false } };
    }

    return { output: { routeId: 'default', matched: false } };
}

