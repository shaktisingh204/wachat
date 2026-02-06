
export async function executeCodeAction(actionName: string, inputs: any, context: any) {
    if (actionName === 'runJavascript') {
        try {
            const code = inputs.code;
            if (!code) return { error: 'No code provided' };

            // Create a function with 'input' variable and 'console' access
            // We pass the full execution context as 'input'
            const func = new Function('input', code);
            const result = func(context);

            // If the code returns an object, we use it. If primitive, we wrap it.
            return typeof result === 'object' ? { output: result } : { output: { result } };
        } catch (e: any) {
            return { error: `Code Execution Error: ${e.message}` };
        }
    }
    return { error: 'Unknown code action' };
}
