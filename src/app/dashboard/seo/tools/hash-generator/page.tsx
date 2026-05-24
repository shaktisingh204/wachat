'use client';

import { useState, useRef, useCallback } from 'react';
import { Button, Input, Textarea, Label, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { FileText, File as FileIcon, Copy, Loader2, UploadCloud, X } from 'lucide-react';
import md5 from 'md5';

const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
type Algo = (typeof ALGOS)[number];
type InputMode = 'text' | 'file';
type OpMode = 'hash' | 'hmac';

// Helper for HMAC-MD5
function hexToBytes(hex: string) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return new Uint8Array(bytes);
}

function hmacMd5(keyStr: string, messageData: Uint8Array) {
  const key = new TextEncoder().encode(keyStr);
  
  const blockSize = 64;
  let keyArr = Array.from(key);
  if (keyArr.length > blockSize) {
    const keyHashStr = md5(key); 
    keyArr = Array.from(hexToBytes(keyHashStr));
  }
  while (keyArr.length < blockSize) {
    keyArr.push(0);
  }
  const oPad = new Uint8Array(blockSize);
  const iPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oPad[i] = keyArr[i] ^ 0x5c;
    iPad[i] = keyArr[i] ^ 0x36;
  }
  
  const inner = new Uint8Array(iPad.length + messageData.length);
  inner.set(iPad, 0);
  inner.set(messageData, iPad.length);
  
  const innerHashHex = md5(inner);
  const innerHash = hexToBytes(innerHashHex);
  
  const outer = new Uint8Array(oPad.length + innerHash.length);
  outer.set(oPad, 0);
  outer.set(innerHash, oPad.length);
  
  return md5(outer); 
}

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export default function HashGeneratorPage() {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [opMode, setOpMode] = useState<OpMode>('hash');
  const [hmacKey, setHmacKey] = useState('');
  
  const [algo, setAlgo] = useState<Algo>('SHA-256');
  
  const [hashResult, setHashResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setHashResult('');
    }
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setHashResult('');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setHashResult('');
  };

  const generate = async () => {
    try {
      setError('');
      setHashResult('');
      setIsGenerating(true);
      
      let data: Uint8Array;
      
      if (inputMode === 'text') {
        data = new TextEncoder().encode(text);
      } else {
        if (!file) {
          throw new Error('Please select a file to hash.');
        }
        const arrayBuffer = await readFileAsArrayBuffer(file);
        data = new Uint8Array(arrayBuffer);
      }
      
      let finalHash = '';
      
      if (algo === 'MD5') {
        if (opMode === 'hmac') {
          if (!hmacKey) throw new Error('HMAC Secret is required.');
          finalHash = hmacMd5(hmacKey, data);
        } else {
          finalHash = md5(data);
        }
      } else {
        if (opMode === 'hmac') {
          if (!hmacKey) throw new Error('HMAC Secret is required.');
          const keyData = new TextEncoder().encode(hmacKey);
          const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: algo },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', cryptoKey, data as any);
          finalHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
          const buf = await crypto.subtle.digest(algo, data as any);
          finalHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
      }
      
      setHashResult(finalHash);
    } catch (err: any) {
      setError(err.message || 'An error occurred during hashing.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (hashResult) {
      navigator.clipboard.writeText(hashResult);
    }
  };

  return (
    <ToolShell title="Hash Generator" description="Generate secure hashes and HMACs from text or files via Web Crypto. Includes MD5 support for legacy systems.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <ZoruCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <Button 
                  variant={inputMode === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('text')}
                  className="w-32"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Text Input
                </Button>
                <Button 
                  variant={inputMode === 'file' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('file')}
                  className="w-32"
                >
                  <FileIcon className="w-4 h-4 mr-2" />
                  File Input
                </Button>
              </div>
              
              {inputMode === 'text' ? (
                <div className="space-y-2">
                  <Label>Input Text</Label>
                  <Textarea 
                    value={text} 
                    onChange={(e) => { setText(e.target.value); setHashResult(''); }} 
                    placeholder="Type or paste text to hash…" 
                    className="min-h-[200px]"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select File</Label>
                  {!file ? (
                    <div 
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <UploadCloud className="w-10 h-10 mb-4 opacity-50" />
                      <p className="font-medium mb-1">Click or drag file to this area to upload</p>
                      <p className="text-sm opacity-75">All file processing is done locally in your browser.</p>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 flex items-center justify-between bg-muted/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="w-8 h-8 text-primary flex-shrink-0" />
                        <div className="overflow-hidden">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={clearFile} title="Remove file">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ZoruCardContent>
          </Card>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          {hashResult && (
            <Card className="border-primary/50 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ZoruCardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-lg font-semibold text-primary">Result ({algo}{opMode === 'hmac' ? ' HMAC' : ''})</Label>
                  <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-md break-all font-mono text-sm border">
                  {hashResult}
                </div>
              </ZoruCardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <ZoruCardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Operation Mode</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={opMode === 'hash' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => { setOpMode('hash'); setHashResult(''); }}
                  >
                    Standard Hash
                  </Button>
                  <Button 
                    variant={opMode === 'hmac' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => { setOpMode('hmac'); setHashResult(''); }}
                  >
                    HMAC
                  </Button>
                </div>
              </div>

              {opMode === 'hmac' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label>HMAC Secret Key</Label>
                  <Input 
                    type="password"
                    value={hmacKey}
                    onChange={(e) => { setHmacKey(e.target.value); setHashResult(''); }}
                    placeholder="Enter secret key..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Algorithm</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALGOS.map((a) => (
                    <Button
                      key={a}
                      variant={algo === a ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setAlgo(a); setHashResult(''); }}
                      className={algo === a ? '' : 'text-muted-foreground'}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  className="w-full h-12 text-lg" 
                  onClick={generate}
                  disabled={isGenerating || (inputMode === 'file' && !file)}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Hash'
                  )}
                </Button>
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
