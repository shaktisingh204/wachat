
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

export async function executeRouterAction(actionName: string, inputs: any) {
    if (actionName === 'route') {
        const routes = typeof inputs.routes === 'string' ? JSON.parse(inputs.routes) : inputs.routes;
        // routes structure: [{ label: 'Route 1', rules: [...], id: 'route1' }] or similar.
        // Assuming simple structure for now or just returning matched route output.
        // If the router app just outputs a value "routeId", the condition node in the flow can treat it?
        // Actually, Router usually acts like a switch.
        // For simplicity: We evaluate rules and return { output: { routeId: '...' } }
        // The engine then needs to know which edge to follow.

        // This is a placeholder. Real router needs complex rule evaluation similar to 'condition' nodes.
        return { output: { result: 'default' } };
    }
    return { error: 'Unknown router action' };
}

