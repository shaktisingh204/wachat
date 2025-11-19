
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
                
                const base64Data = fileData.startsWith('data:') 
                    ? fileData.split(',')[1] 
                    : fileData;
                const buffer = Buffer.from(base64Data, 'base64');
                
                const output = await processAndSaveFile(buffer, filename, logger);
                return { output };
            }
             case 'processDirectUrl': {
                const { fileUrl } = inputs;
                if (!fileUrl) {
                    throw new Error("Input 'fileUrl' is required.");
                }

                logger.log(`Fetching file from URL: ${fileUrl}`);
                const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');

                const urlPath = new URL(fileUrl).pathname;
                const filename = path.basename(urlPath);
                
                const output = await processAndSaveFile(buffer, filename, logger);
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
