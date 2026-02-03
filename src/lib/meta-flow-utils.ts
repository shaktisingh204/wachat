
export function cleanMetaFlowData(flowData: any): any {
    if (!flowData) return flowData;

    // Deep clone to avoid mutating state directly in some contexts
    const cleanData = JSON.parse(JSON.stringify(flowData));

    // Clean Screens
    if (cleanData.screens && Array.isArray(cleanData.screens)) {
        cleanData.screens = cleanData.screens.map((screen: any) => cleanScreen(screen));
    }

    return cleanData;
}

function cleanScreen(screen: any): any {
    const cleanFn = (node: any): any => {
        if (!node) return node;

        // Remove internal fields
        const { _id, ...rest } = node;
        let cleanedNode = { ...rest };

        // Normalize properties (remove empty strings if optional, or strict types)
        // Meta doesn't like empty strings for some props, but strict validation is complex.
        // We focus on structure.

        // Remove 'children' if empty for non-containers?
        // Containers like Form, Box, Column, Row MUST have children.

        if (cleanedNode.children && Array.isArray(cleanedNode.children)) {
            cleanedNode.children = cleanedNode.children.map(cleanFn);
        }

        return cleanedNode;
    };

    if (screen.layout) {
        screen.layout = cleanFn(screen.layout);
    }

    return screen;
}
