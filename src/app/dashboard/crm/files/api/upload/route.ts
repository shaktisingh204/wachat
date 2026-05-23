import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as Blob;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
    const filename = formData.get('filename') as string;
    const fileId = formData.get('fileId') as string;

    if (!chunk || !filename || !fileId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tempDir = path.join(os.tmpdir(), 'sabnode_uploads', fileId);
    await fs.mkdir(tempDir, { recursive: true });

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(chunkPath, buffer);

    // If it's the last chunk, combine them
    if (chunkIndex === totalChunks - 1) {
      const finalFilePath = path.join(os.tmpdir(), 'sabnode_uploads', `${fileId}_${filename}`);
      
      for (let i = 0; i < totalChunks; i++) {
        const cp = path.join(tempDir, `chunk_${i}`);
        const chunkData = await fs.readFile(cp);
        await fs.appendFile(finalFilePath, chunkData);
        await fs.unlink(cp);
      }
      
      await fs.rmdir(tempDir);
      
      // In a real app we'd move this to a permanent storage. 
      // For now, return a mock URL
      const mockUrl = `/api/sabnode_uploads/${fileId}_${filename}`;
      
      return NextResponse.json({ 
        success: true, 
        message: 'File uploaded successfully',
        url: mockUrl 
      });
    }

    return NextResponse.json({ success: true, message: `Chunk ${chunkIndex} uploaded` });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
