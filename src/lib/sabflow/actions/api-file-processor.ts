
'use server';

import { getErrorMessage } from '@/lib/utils';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export async function executeApiFileProcessorAction(actionName: string, inputs: any, logger: any) {
    try {
        switch (actionName) {
            case 'saveFile': {
                const { fileData, filename } = inputs;
                if (!fileData) {
                    throw new Error("Input 'fileData' (Base64 string) is required.");
                }
                if (!filename) {
                    throw new Error("Input 'filename' is required to determine the file type.");
                }
                
                // Decode the Base64 string into a buffer
                const base64Data = fileData.startsWith('data:') 
                    ? fileData.split(',')[1] 
                    : fileData;
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Generate a unique filename while preserving the extension
                const extension = path.extname(filename);
                const uniqueFilename = `${nanoid(12)}${extension}`;
                
                // Define the path to save the file
                const uploadDir = path.join(process.cwd(), 'public', 'uploads');
                const filePath = path.join(uploadDir, uniqueFilename);
                
                // Ensure the directory exists
                await fs.mkdir(uploadDir, { recursive: true });
                
                // Write the file
                await fs.writeFile(filePath, buffer);
                logger.log(`File saved locally to: ${filePath}`);
                
                // Construct the public URL
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const publicUrl = new URL(`/uploads/${uniqueFilename}`, appUrl).toString();
                logger.log(`Generated public URL: ${publicUrl}`);

                return { output: { fileUrl: publicUrl } };
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
