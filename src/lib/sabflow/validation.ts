
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
    if (node.type === 'condition') {
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

