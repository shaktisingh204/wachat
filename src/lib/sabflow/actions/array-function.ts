
'use server';

import type { WithId, User } from '@/lib/definitions';

export async function executeArrayFunctionAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { array, index } = inputs;
        let targetArray: any[];

        // Ensure the input is an array
        if (Array.isArray(array)) {
            targetArray = array;
        } else if (typeof array === 'string') {
            try {
                targetArray = JSON.parse(array);
                if (!Array.isArray(targetArray)) {
                    throw new Error();
                }
            } catch {
                throw new Error("Input 'array' is not a valid JSON array string.");
            }
        } else {
             throw new Error("Input 'array' must be a valid array or a JSON array string.");
        }
        
        switch (actionName) {
            case 'getCount': {
                return { output: { count: targetArray.length } };
            }
            case 'arrayReverse': {
                const reversedArray = [...targetArray].reverse();
                return { output: { reversedArray } };
            }
            case 'getValueByIndex': {
                const idx = Number(index);
                if (isNaN(idx)) {
                    throw new Error("Index must be a valid number.");
                }
                if (idx < 0 || idx >= targetArray.length) {
                    throw new Error(`Index ${idx} is out of bounds for the array (length: ${targetArray.length}).`);
                }
                const value = targetArray[idx];
                return { output: { value } };
            }
            default:
                throw new Error(`Array Function action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        logger.log(`Array Function Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: e.message };
    }
}
