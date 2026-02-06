
export async function executeTextAction(actionName: string, inputs: any) {
    const text = String(inputs.text || '');

    switch (actionName) {
        case 'capitalize':
            return { output: { text: text.charAt(0).toUpperCase() + text.slice(1) } };
        case 'lowercase':
            return { output: { text: text.toLowerCase() } };
        case 'uppercase':
            return { output: { text: text.toUpperCase() } };
        case 'trim':
            return { output: { text: text.trim() } };
        case 'split':
            return { output: { array: text.split(inputs.separator || ',') } };
        default:
            return { error: `Unknown text action: ${actionName}` };
    }
}

export async function executeNumberAction(actionName: string, inputs: any) {
    switch (actionName) {
        case 'formatCurrency':
            const amount = Number(inputs.amount);
            const currency = inputs.currency || 'USD';
            if (isNaN(amount)) return { error: 'Invalid amount' };
            const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
            return { output: { formatted } };

        case 'calculateMath':
            try {
                // VERY BASIC safe eval for math only. 
                // In production, use a math parser library like mathjs to avoid eval() risks.
                // For this localized scope, we'll strip non-math chars.
                const expression = String(inputs.expression).replace(/[^0-9+\-*/(). ]/g, '');
                const result = eval(expression);
                return { output: { result } };
            } catch (e: any) {
                return { error: `Math Error: ${e.message}` };
            }
        default:
            return { error: `Unknown number action: ${actionName}` };
    }
}

export async function executeDateAction(actionName: string, inputs: any) {
    const dateStr = inputs.date;
    const date = dateStr ? new Date(dateStr) : new Date();

    if (isNaN(date.getTime())) return { error: 'Invalid Date' };

    switch (actionName) {
        case 'formatDate':
            // Simple format implementation or use date-fns if available. 
            // Using ISO as default or simple locale string
            return { output: { formatted: date.toISOString() } };

        case 'addToDate':
        case 'subtractFromDate':
            const amount = Number(inputs.amount || 0);
            const unit = inputs.unit || 'days';
            const multiplier = actionName === 'subtractFromDate' ? -1 : 1;

            if (unit === 'days') date.setDate(date.getDate() + (amount * multiplier));
            if (unit === 'hours') date.setHours(date.getHours() + (amount * multiplier));
            if (unit === 'minutes') date.setMinutes(date.getMinutes() + (amount * multiplier));

            return { output: { date: date.toISOString() } };

        default:
            return { error: `Unknown date action: ${actionName}` };
    }
}

export async function executeJsonAction(actionName: string, inputs: any) {
    if (actionName === 'parseJson') {
        try {
            const result = JSON.parse(inputs.jsonString);
            return { output: { object: result } };
        } catch (e) {
            return { error: 'Invalid JSON String' };
        }
    }
    return { error: `Unknown JSON action: ${actionName}` };
}

export async function executeDataTransformerAction(actionName: string, inputs: any) {
    if (actionName === 'transformData') {
        try {
            // The inputs.schema is likely a JSON string that has already been interpolated by the engine.
            // So we just need to parse it.
            const schema = typeof inputs.schema === 'string' ? JSON.parse(inputs.schema) : inputs.schema;
            return { output: schema };
        } catch (e) {
            return { error: 'Invalid JSON Schema' };
        }
    }
    return { error: `Unknown Data Transformer action: ${actionName}` };
}

export async function executeDataForwarderAction(actionName: string, inputs: any) {
    if (actionName === 'forwardData') {
        // Just return all inputs as output
        return { output: inputs };
    }
    return { error: `Unknown Data Forwarder action: ${actionName}` };
}

