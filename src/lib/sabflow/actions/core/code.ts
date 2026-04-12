
/**
 * Executes user-authored JavaScript inside a lightweight sandbox.
 *
 * Guarantees:
 *  - `input` is the read-only flow context
 *  - Dangerous globals (process, require, global, globalThis, __dirname, __filename, eval, Function)
 *    are shadowed to undefined via Function parameters
 *  - Code may return a Promise; it is awaited
 *  - Execution time is capped via a soft timer (best-effort — JS is single-threaded so a while(true)
 *    still blocks the event loop; this only limits the wall-clock the executor waits)
 */
export async function executeCodeAction(actionName: string, inputs: any, context: any) {
    if (actionName !== 'runJavascript') {
        return { error: 'Unknown code action' };
    }

    const code = inputs?.code;
    if (!code || typeof code !== 'string') {
        return { error: 'No code provided' };
    }

    try {
        // Build a function that shadows dangerous globals by declaring them as parameters.
        // Any reference inside the user's code to these names resolves to `undefined`.
        const sandboxed = new Function(
            'input',
            'process',
            'require',
            'global',
            'globalThis',
            '__dirname',
            '__filename',
            'eval',
            'Function',
            `"use strict";\nreturn (async () => { ${code} })();`
        );

        // Deep-clone context so user code can't mutate it.
        let safeInput: any;
        try {
            safeInput = JSON.parse(JSON.stringify(context ?? {}));
        } catch {
            safeInput = {};
        }

        // Soft timeout — 5 seconds.
        const execPromise = Promise.resolve(
            sandboxed(safeInput, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)
        );
        const timeoutPromise = new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error('Code execution timed out after 5s')), 5000)
        );
        const rawResult = await Promise.race([execPromise, timeoutPromise]);

        // If the code returns an object, use it directly. If primitive, wrap it.
        if (rawResult === undefined) {
            return { output: { result: null } };
        }
        if (rawResult !== null && typeof rawResult === 'object') {
            return { output: rawResult };
        }
        return { output: { result: rawResult } };
    } catch (e: any) {
        return { error: `Code Execution Error: ${e.message || String(e)}` };
    }
}
