'use client';

import { useState } from 'react';
import { FileText, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { Button, Card, CardBody, EmptyState, Progress } from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { uploadLogFile, saveLogReport } from '../actions';
import { useRouter } from 'next/navigation';

export function LogUploader({ projectId }: { projectId: string }) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const router = useRouter();

    const handleFileSelect = (selectedFile: File) => {
        // Optionally validate extension (e.g. .log, .txt)
        if (!selectedFile.name.endsWith('.log') && !selectedFile.name.endsWith('.txt')) {
            setStatus('error');
            setErrorMessage('Only .log or .txt files are supported.');
            return;
        }
        setFile(selectedFile);
        setStatus('idle');
        setErrorMessage('');
        setProgress(0);
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await uploadLogFile(projectId, formData);
            if (!result.success) {
                setStatus('error');
                setErrorMessage(result.error || 'Upload failed');
                return;
            }

            setStatus('parsing');

            // Trigger background worker for parsing
            const worker = new Worker(new URL('./worker.ts', import.meta.url));
            worker.postMessage({ file });

            worker.onmessage = async (e) => {
                if (e.data.type === 'progress') {
                    setProgress(e.data.progress);
                } else if (e.data.type === 'done') {
                    await saveLogReport(projectId, e.data.result);
                    worker.terminate();
                    setStatus('success');
                    router.refresh(); // Refresh the page to show the new data
                }
            };

            worker.onerror = (e) => {
                console.error('Worker error:', e);
                setStatus('error');
                setErrorMessage('Error during background parsing.');
                worker.terminate();
            };
        } catch (error) {
            setStatus('error');
            setErrorMessage('An unexpected error occurred during upload.');
        }
    };

    const reset = () => {
        setFile(null);
        setStatus('idle');
        setErrorMessage('');
        setProgress(0);
    };

    return (
        <div className="flex h-[300px] flex-col items-center justify-center p-4">
            {status === 'idle' && !file && (
                <Card variant="ghost" padding="lg" className="flex h-full w-full items-center justify-center">
                    <EmptyState
                        icon={Upload}
                        title="Add a log file"
                        description="Pick an access log from your SabFiles library. Supports Apache and Nginx formats (.log or .txt)."
                        action={
                            <SabFileToFileButton
                                accept="document"
                                title="Pick a log file"
                                onPickFile={(picked) => handleFileSelect(picked)}
                                onError={() => {
                                    setStatus('error');
                                    setErrorMessage('Could not load the selected file.');
                                }}
                            >
                                <Upload aria-hidden="true" /> Choose log file
                            </SabFileToFileButton>
                        }
                    />
                </Card>
            )}

            {file && (status === 'idle' || status === 'uploading' || status === 'parsing') && (
                <Card padding="lg" className="flex h-full w-full items-center justify-center">
                    <CardBody className="flex flex-col items-center justify-center">
                        <FileText className="mb-4 h-12 w-12 text-[var(--st-text)]" aria-hidden="true" />
                        <div className="mb-2 text-center font-medium text-[var(--st-text)]">{file.name}</div>
                        <div className="mb-6 text-sm text-[var(--st-text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} MB</div>

                        {status === 'uploading' ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text)]" aria-hidden="true" />
                                <span className="text-sm text-[var(--st-text-secondary)]">Streaming to storage...</span>
                            </div>
                        ) : status === 'parsing' ? (
                            <div className="flex w-full max-w-xs flex-col items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text)]" aria-hidden="true" />
                                    <span className="text-sm text-[var(--st-text-secondary)]">Parsing via Web Worker... {progress}%</span>
                                </div>
                                <Progress value={progress} aria-label="Parsing progress" className="w-full" />
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={reset}>Cancel</Button>
                                <Button variant="primary" onClick={handleUpload}>Start Upload</Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {status === 'success' && (
                <Card padding="lg" className="flex h-full w-full items-center justify-center">
                    <EmptyState
                        icon={CheckCircle}
                        tone="success"
                        title="Upload complete"
                        description="Log file has been streamed and parsed successfully."
                        action={<Button variant="outline" onClick={reset}>Upload another</Button>}
                    />
                </Card>
            )}

            {status === 'error' && (
                <Card padding="lg" className="flex h-full w-full items-center justify-center">
                    <EmptyState
                        icon={AlertCircle}
                        tone="danger"
                        title="Upload failed"
                        description={errorMessage}
                        action={<Button variant="outline" onClick={reset}>Try again</Button>}
                    />
                </Card>
            )}
        </div>
    );
}
