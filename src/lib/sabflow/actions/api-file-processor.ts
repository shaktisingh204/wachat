
'use server';

import { getErrorMessage } from '@/lib/utils';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import axios from 'axios';

async function processAndSaveFile(buffer: Buffer, originalFilename: string, logger: any) {
    const extension = path.extname(originalFilename) || '.tmp';
    const uniqueFilename = `${nanoid(12)}${extension}`;
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, uniqueFilename);
    
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    logger.log(`File saved locally to: ${filePath}`);
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const publicUrl = new URL(`/uploads/${uniqueFilename}`, appUrl).toString();
    logger.log(`Generated public URL: ${publicUrl}`);

    return { fileUrl: publicUrl };
}


export async function executeApiFileProcessorAction(actionName: string, inputs: any, context: any, logger: any) {
    try {
        switch (actionName) {
            case 'grabFileFromApiStep': {
                const { sourceApiStepName, filename } = inputs;

                if (!sourceApiStepName) {
                    throw new Error("You must select a source API step from the dropdown.");
                }

                // Check if the previous step's output is directly available
                let apiStepOutput = context[sourceApiStepName]?.output;
                
                // If not, check if the full response was saved to a variable
                if (!apiStepOutput) {
                    const stepNames = Object.keys(context);
                    for (const name of stepNames) {
                        const step = context[name];
                        if (step?.output?.response?.data) { // Check for full response structure
                           apiStepOutput = step.output;
                           break;
                        }
                    }
                }
                
                if (!apiStepOutput) {
                    throw new Error(`Could not find output for the selected API step "${sourceApiStepName}" in the flow context. Check if the previous step ran successfully and if its output variable is correct.`);
                }
                
                let fileDataUri: string | undefined;

                if (apiStepOutput.fileDataUri) {
                    fileDataUri = apiStepOutput.fileDataUri;
                } else if (apiStepOutput.response && apiStepOutput.response.data.startsWith('data:')) {
                    // Handle case where full response is saved and data is the URI
                    fileDataUri = apiStepOutput.response.data;
                }
                
                if (!fileDataUri) {
                    throw new Error(`The selected API step "${sourceApiStepName}" did not output a 'fileDataUri'. Ensure the 'Response is a direct file' toggle is enabled on the API step.`);
                }

                const finalFilename = filename || 'downloaded-file';
                
                const base64Data = fileDataUri.split(',')[1];
                if (!base64Data) {
                    throw new Error("Invalid data URI format from the source API step.");
                }

                const buffer = Buffer.from(base64Data, 'base64');
                
                const output = await processAndSaveFile(buffer, finalFilename, logger);
                return { output };
            }
            default:
                throw new Error(`API File Processor action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        const errorMsg = `Error executing API File Processor action: ${getErrorMessage(e)}`;
        logger.log(errorMsg, { actionName, inputs, error: e.stack });
        return { error: errorMsg };
    }
}
