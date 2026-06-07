'use client';

import { useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Card,
  CardBody,
  Alert,
  SegmentedControl,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { FileText, File as FileIcon, Copy, UploadCloud, X } from 'lucide-react';
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
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [opMode, setOpMode] = useState<OpMode>('hash');
  const [hmacKey, setHmacKey] = useState('');

  const [algo, setAlgo] = useState<Algo>('SHA-256');

  const [hashResult, setHashResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handlePickFile = (picked: File) => {
    setFile(picked);
    setHashResult('');
  };

  const clearFile = () => {
    setFile(null);
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
      const message = err.message || 'An error occurred during hashing.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (hashResult) {
      navigator.clipboard.writeText(hashResult);
      toast.success('Hash copied to clipboard.');
    }
  };

  return (
    <ToolShell title="Hash Generator" description="Generate secure hashes and HMACs from text or files via Web Crypto. Includes MD5 support for legacy systems.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardBody className="p-6 space-y-4">
              <div className="border-b border-[var(--st-border)] pb-4">
                <SegmentedControl<InputMode>
                  aria-label="Input source"
                  value={inputMode}
                  onChange={setInputMode}
                  items={[
                    { value: 'text', label: 'Text Input', icon: FileText },
                    { value: 'file', label: 'File Input', icon: FileIcon },
                  ]}
                />
              </div>

              {inputMode === 'text' ? (
                <Field label="Input Text">
                  <Textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); setHashResult(''); }}
                    placeholder="Type or paste text to hash..."
                    className="min-h-[200px]"
                  />
                </Field>
              ) : (
                <Field label="Select File">
                  {!file ? (
                    <div className="border-2 border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-10 flex flex-col items-center justify-center text-center text-[var(--st-text-secondary)]">
                      <UploadCloud className="w-10 h-10 mb-4 opacity-50" aria-hidden="true" />
                      <p className="font-medium mb-1 text-[var(--st-text)]">Pick a file from SabFiles to hash</p>
                      <p className="text-sm text-[var(--st-text-tertiary)] mb-4">All hashing runs locally in your browser.</p>
                      <SabFileToFileButton
                        variant="outline"
                        onPickFile={handlePickFile}
                        onError={(err) => toast.error(err.message)}
                      >
                        Choose file
                      </SabFileToFileButton>
                    </div>
                  ) : (
                    <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] p-4 flex items-center justify-between bg-[var(--st-bg-secondary)]">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="w-8 h-8 text-[var(--st-text)] flex-shrink-0" aria-hidden="true" />
                        <div className="overflow-hidden">
                          <p className="font-medium truncate text-[var(--st-text)]">{file.name}</p>
                          <p className="text-xs text-[var(--st-text-secondary)]">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <IconButton label="Remove file" icon={X} onClick={clearFile} />
                    </div>
                  )}
                </Field>
              )}
            </CardBody>
          </Card>

          {error && (
            <Alert tone="danger" title="Hashing failed">
              {error}
            </Alert>
          )}

          {hashResult && (
            <Card>
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-[var(--st-text)]">
                    Result ({algo}{opMode === 'hmac' ? ' HMAC' : ''})
                  </span>
                  <Button variant="secondary" size="sm" iconLeft={Copy} onClick={copyToClipboard}>
                    Copy
                  </Button>
                </div>
                <div className="bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] break-all font-mono text-sm border border-[var(--st-border)] text-[var(--st-text)]">
                  {hashResult}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="p-6 space-y-6">
              <Field label="Operation Mode">
                <SegmentedControl<OpMode>
                  aria-label="Operation mode"
                  fullWidth
                  value={opMode}
                  onChange={(v) => { setOpMode(v); setHashResult(''); }}
                  items={[
                    { value: 'hash', label: 'Standard Hash' },
                    { value: 'hmac', label: 'HMAC' },
                  ]}
                />
              </Field>

              {opMode === 'hmac' && (
                <Field label="HMAC Secret Key">
                  <Input
                    type="password"
                    value={hmacKey}
                    onChange={(e) => { setHmacKey(e.target.value); setHashResult(''); }}
                    placeholder="Enter secret key"
                  />
                </Field>
              )}

              <Field label="Algorithm">
                <div className="grid grid-cols-2 gap-2">
                  {ALGOS.map((a) => (
                    <Button
                      key={a}
                      variant={algo === a ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => { setAlgo(a); setHashResult(''); }}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </Field>

              <div className="pt-4 border-t border-[var(--st-border)]">
                <Button
                  variant="primary"
                  size="lg"
                  block
                  loading={isGenerating}
                  onClick={generate}
                  disabled={isGenerating || (inputMode === 'file' && !file)}
                >
                  {isGenerating ? 'Generating' : 'Generate Hash'}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
