
import { Edge, Node } from '@xyflow/react';
import { sabnodeAppData } from './data';

export interface ValidationError {
    nodeId: string;
    field?: string;
    message: string;
    type: 'error' | 'warning';
}

export interface FlowValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

/**
 * Validates a single node based on its type and configuration.
 */
export const validateNode = (node: Node | any, connectedEdges: Edge[] = []): ValidationError[] => {
    const errors: ValidationError[] = [];
    const data = node.data;

    // Resolve the effective block type (Typebot-style nodes carry blockType in data)
    const blockType: string = data?.blockType ?? node.type ?? '';

    // 1. Basic Node Validation
    if (!data.name || data.name.trim() === '') {
        // Warning only for name, auto-generated names usually exist
        // errors.push({ nodeId: node.id, field: 'name', message: 'Step name is empty', type: 'warning' });
    }

    // 2. Trigger Validation
    if (node.type === 'trigger') {
        if (!data.triggerType) {
            errors.push({ nodeId: node.id, message: 'Trigger type not selected', type: 'error' });
        } else if (data.triggerType === 'app') {
            if (!data.appId) errors.push({ nodeId: node.id, message: 'Trigger app not selected', type: 'error' });
            if (!data.actionName) errors.push({ nodeId: node.id, message: 'Trigger event not selected', type: 'error' });
        }
        // Triggers don't need incoming edges
    }

    // 3. Action Validation
    if (node.type === 'action') {
        // Check if it has incoming connection
        const hasIncoming = connectedEdges.some(edge => edge.target === node.id);
        if (!hasIncoming) {
            errors.push({ nodeId: node.id, message: 'This step is disconnected from the flow', type: 'error' });
        }

        if (!data.appId) {
            errors.push({ nodeId: node.id, message: 'App not selected', type: 'error' });
            return errors; // Cannot validate further
        }

        if (!data.actionName) {
            errors.push({ nodeId: node.id, message: 'Action not selected', type: 'error' });
            return errors;
        }

        // Find the app and action definition to check required fields
        const app = sabnodeAppData.find(a => a.appId === data.appId);
        if (app) {
            let action = app.actions?.find(a => a.name === data.actionName);

            // Legacy/Special case handling
            if (data.actionName === 'apiRequest' && !action) {
                action = { name: 'apiRequest', label: 'API Request', description: '', inputs: [] }; // Inputs handled dynamically likely
            }

            if (action) {
                // Check required inputs
                (action as any).inputs?.forEach((input: any) => {
                    if (input.required) {
                        const val = data.inputs?.[input.name];
                        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                            errors.push({
                                nodeId: node.id,
                                field: input.name,
                                message: `${input.label} is required`,
                                type: 'error'
                            });
                        }
                    }
                });
            }
        }
    }

    // 4. Condition Validation
    if (node.type === 'condition' || blockType === 'condition') {
        const hasIncoming = connectedEdges.some(edge => edge.target === node.id);
        if (!hasIncoming) {
            errors.push({ nodeId: node.id, message: 'Condition is disconnected', type: 'error' });
        }

        if (!data.rules || data.rules.length === 0) {
            errors.push({ nodeId: node.id, message: 'No condition rules defined', type: 'error' });
        } else {
            data.rules.forEach((rule: any, index: number) => {
                if (!rule.field) errors.push({ nodeId: node.id, message: `Rule #${index + 1}: Variable missing`, type: 'error' });
                if (!rule.operator) errors.push({ nodeId: node.id, message: `Rule #${index + 1}: Operator missing`, type: 'error' });
                // Value might be optional depending on operator (e.g. "is empty") but assuming required for now
                // if (!rule.value) errors.push({ nodeId: node.id, message: `Rule #${index + 1}: Value missing`, type: 'error' });
            });
        }

        // Check if branches are connected
        const hasYesPath = connectedEdges.some(edge => edge.source === node.id && (edge.sourceHandle === 'output-yes' || edge.data?.handleId === 'output-yes'));
        const hasNoPath = connectedEdges.some(edge => edge.source === node.id && (edge.sourceHandle === 'output-no' || edge.data?.handleId === 'output-no'));

        if (!hasYesPath && !hasNoPath) {
            errors.push({ nodeId: node.id, message: 'Condition must have at least one path (Yes or No) connected', type: 'warning' });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Typebot-style block validations (keyed by blockType)
    // ─────────────────────────────────────────────────────────────────────────

    // ── Bubble blocks ────────────────────────────────────────────────────────

    if (blockType === 'text_bubble') {
        if (!data.content || (typeof data.content === 'string' && data.content.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'content', message: 'Text bubble has no message content', type: 'warning' });
        }
    }

    if (blockType === 'image_bubble') {
        if (!data.url || (typeof data.url === 'string' && data.url.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'url', message: 'Image URL is required', type: 'error' });
        }
    }

    if (blockType === 'video_bubble') {
        if (!data.url || (typeof data.url === 'string' && data.url.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'url', message: 'Video URL is required', type: 'error' });
        }
    }

    if (blockType === 'audio_bubble') {
        if (!data.url || (typeof data.url === 'string' && data.url.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'url', message: 'Audio URL is required', type: 'error' });
        }
    }

    if (blockType === 'embed_bubble') {
        const hasUrl  = data.url  && typeof data.url  === 'string' && data.url.trim()  !== '';
        const hasCode = data.code && typeof data.code === 'string' && data.code.trim() !== '';
        if (!hasUrl && !hasCode) {
            errors.push({ nodeId: node.id, field: 'url', message: 'Embed requires a URL or embed code', type: 'error' });
        }
    }

    // ── Input blocks ─────────────────────────────────────────────────────────

    if (blockType === 'text_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the response', type: 'error' });
        }
    }

    if (blockType === 'number_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the number', type: 'error' });
        }
    }

    if (blockType === 'email_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the email', type: 'error' });
        }
    }

    if (blockType === 'phone_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the phone number', type: 'error' });
        }
    }

    if (blockType === 'date_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the date', type: 'error' });
        }
    }

    if (blockType === 'url_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the URL', type: 'error' });
        }
    }

    if (blockType === 'file_input') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the uploaded file', type: 'error' });
        }
    }

    if (blockType === 'buttons') {
        if (!data.buttons || !Array.isArray(data.buttons) || data.buttons.length === 0) {
            errors.push({ nodeId: node.id, field: 'buttons', message: 'At least one button must be defined', type: 'error' });
        } else {
            data.buttons.forEach((btn: any, index: number) => {
                if (!btn.label || (typeof btn.label === 'string' && btn.label.trim() === '')) {
                    errors.push({ nodeId: node.id, field: `buttons[${index}].label`, message: `Button #${index + 1} has an empty label`, type: 'warning' });
                }
            });
        }
    }

    if (blockType === 'rating') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the rating', type: 'error' });
        }
    }

    if (blockType === 'payment') {
        if (!data.amount || (typeof data.amount === 'string' && data.amount.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'amount', message: 'Payment amount is required', type: 'error' });
        }
        if (!data.provider || (typeof data.provider === 'string' && data.provider.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'provider', message: 'Payment provider is required', type: 'error' });
        }
    }

    // ── Logic blocks ─────────────────────────────────────────────────────────

    if (blockType === 'set_variable') {
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required', type: 'error' });
        }
        if (data.value === undefined || data.value === null || (typeof data.value === 'string' && data.value.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'value', message: 'Variable value is required', type: 'error' });
        }
    }

    if (blockType === 'redirect') {
        if (!data.url || (typeof data.url === 'string' && data.url.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'url', message: 'Redirect URL is required', type: 'error' });
        }
    }

    if (blockType === 'script') {
        if (!data.code || (typeof data.code === 'string' && data.code.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'code', message: 'Script block has no code', type: 'warning' });
        }
    }

    if (blockType === 'wait') {
        const duration = data.duration;
        if (duration === undefined || duration === null || duration === '') {
            errors.push({ nodeId: node.id, field: 'duration', message: 'Wait duration must be set', type: 'error' });
        } else if (typeof duration === 'number' && duration <= 0) {
            errors.push({ nodeId: node.id, field: 'duration', message: 'Wait duration must be greater than 0', type: 'error' });
        } else if (typeof duration === 'string' && (isNaN(parseFloat(duration)) || parseFloat(duration) <= 0)) {
            errors.push({ nodeId: node.id, field: 'duration', message: 'Wait duration must be a positive number', type: 'error' });
        }
    }

    if (blockType === 'ab_test') {
        const splits: any[] = data.splits ?? [];
        if (splits.length < 2) {
            errors.push({ nodeId: node.id, field: 'splits', message: 'A/B test requires at least 2 splits', type: 'error' });
        } else {
            const total = splits.reduce((sum: number, s: any) => sum + (parseFloat(s.percentage ?? s.weight ?? 0) || 0), 0);
            // Allow a tiny floating-point tolerance
            if (Math.abs(total - 100) > 0.5) {
                errors.push({ nodeId: node.id, field: 'splits', message: `A/B test splits must total 100% (currently ${total.toFixed(1)}%)`, type: 'error' });
            }
        }
    }

    // ── AI blocks ────────────────────────────────────────────────────────────

    if (blockType === 'ai_message') {
        if (!data.userPrompt || (typeof data.userPrompt === 'string' && data.userPrompt.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'userPrompt', message: 'AI message requires a prompt', type: 'error' });
        }
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the AI response', type: 'error' });
        }
    }

    if (blockType === 'ai_agent') {
        if (!data.instructions || (typeof data.instructions === 'string' && data.instructions.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'instructions', message: 'AI agent requires instructions', type: 'error' });
        }
        if (!data.variableName || (typeof data.variableName === 'string' && data.variableName.trim() === '')) {
            errors.push({ nodeId: node.id, field: 'variableName', message: 'Variable name is required to save the agent output', type: 'error' });
        }
    }

    return errors;
};

/**
 * Detects cycles in the flow graph using DFS.
 */
export function detectCycle(nodes: Node[], edges: Edge[]): { hasCycle: boolean; path?: string[] } {
    const adj = new Map<string, string[]>();

    // Build adjacency list
    for (const edge of edges) {
        if (!adj.has(edge.source)) {
            adj.set(edge.source, []);
        }
        adj.get(edge.source)?.push(edge.target);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let cyclePath: string[] = [];

    function dfs(nodeId: string, currentPath: string[]): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adj.get(nodeId);

        if (neighbors) {
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor, [...currentPath, neighbor])) {
                        return true;
                    }
                } else if (recursionStack.has(neighbor)) {
                    // Cycle detected
                    cyclePath = [...currentPath, neighbor];
                    return true;
                }
            }
        }

        recursionStack.delete(nodeId);
        return false;
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (dfs(node.id, [node.id])) {
                return { hasCycle: true, path: cyclePath };
            }
        }
    }

    return { hasCycle: false };
}

/**
 * Validates the entire flow
 */
export const validateFlow = (nodes: Node[], edges: Edge[]): FlowValidationResult => {
    let allErrors: ValidationError[] = [];

    // Check if flow is empty
    if (nodes.length === 0) {
        return { isValid: false, errors: [{ nodeId: 'root', message: 'Flow is empty', type: 'error' }] };
    }

    // Check if trigger exists
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
        allErrors.push({ nodeId: 'root', message: 'Flow must have a Trigger', type: 'error' });
    }

    // Validate each node
    nodes.forEach(node => {
        const nodeErrors = validateNode(node, edges);
        allErrors = [...allErrors, ...nodeErrors];
    });

    // Check for loops
    const cycleCheck = detectCycle(nodes, edges);
    if (cycleCheck.hasCycle) {
        // Map path IDs to names for better error message if possible
        const pathNames = cycleCheck.path?.map(id => {
            const n = nodes.find(node => node.id === id);
            return n?.data?.name || id;
        }).join(' → ');

        allErrors.push({
            nodeId: 'root',
            message: `Infinite loop detected in flow logic: ${pathNames}`,
            type: 'error'
        });
    }

    const hasErrors = allErrors.some(e => e.type === 'error');

    return {
        isValid: !hasErrors,
        errors: allErrors
    };
};
