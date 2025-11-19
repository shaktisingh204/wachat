
'use server';

import { getErrorMessage } from '@/lib/utils';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import axios from 'axios';

async function processAndSaveFile(buffer: Buffer, originalFilename: string, logger: any) {
    const extension = path.extname(originalFilename);
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
                const { sourceApiStepId, filename } = inputs;

                if (!sourceApiStepId) {
                    throw new Error("You must select a source API step from the dropdown.");
                }

                // Find the output of the selected API step in the context
                const apiStepOutput = context[sourceApiStepId]?.output;
                if (!apiStepOutput) {
                    throw new Error(`Could not find output for the selected API step "${sourceApiStepId}" in the flow context.`);
                }
                
                const fileDataUri = apiStepOutput.fileDataUri;
                if (!fileDataUri) {
                    throw new Error(`The selected API step "${sourceApiStepId}" did not output a 'fileDataUri'. Ensure the 'Response is a direct file' toggle is enabled on the API step.`);
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
