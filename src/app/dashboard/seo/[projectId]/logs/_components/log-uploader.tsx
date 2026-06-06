'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { uploadLogFile, saveLogReport } from '../actions';
import { useRouter } from 'next/navigation';

export function LogUploader({ projectId }: { projectId: string }) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, []);

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
                console.error("Worker error:", e);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex h-[300px] flex-col items-center justify-center p-4">
            {status === 'idle' && !file && (
                <div 
                    className={`flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-[var(--zoru-radius)] border-2 border-dashed transition-colors ${isDragging ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]/80' : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50'}`}
                    onDragOver={onDragOver}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className={`mb-4 h-10 w-10 ${isDragging ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`} />
                    <h3 className="text-[var(--st-text)] mb-1">Drag .log files here</h3>
                    <p className="text-xs text-[var(--st-text-secondary)]">Or click to select (Supports Apache/Nginx formats)</p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".log,.txt" 
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleFileSelect(e.target.files[0]);
                            }
                        }} 
                    />
                </div>
            )}

            {(file && (status === 'idle' || status === 'uploading' || status === 'parsing')) && (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-6">
                    <FileText className="mb-4 h-12 w-12 text-[var(--st-text)]" />
                    <div className="mb-2 text-center text-[var(--st-text)] font-medium">{file.name}</div>
                    <div className="mb-6 text-sm text-[var(--st-text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    
                    {status === 'uploading' ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text)]" />
                            <span className="text-sm text-[var(--st-text-secondary)]">Streaming to S3...</span>
                        </div>
                    ) : status === 'parsing' ? (
                        <div className="flex w-full max-w-xs flex-col items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text)]" />
                                <span className="text-sm text-[var(--st-text-secondary)]">Parsing via Web Worker... {progress}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                                <div 
                                    className="h-full bg-[var(--st-text)] transition-all duration-300" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={reset}>Cancel</Button>
                            <Button onClick={handleUpload}>Start Upload</Button>
                        </div>
                    )}
                </div>
            )}

            {status === 'success' && (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-[var(--zoru-radius)] border border-[var(--st-status-ok)] bg-[var(--st-status-ok)]/20 p-6 text-center">
                    <CheckCircle className="mb-4 h-12 w-12 text-[var(--st-status-ok)]" />
                    <h3 className="mb-2 text-lg text-[var(--st-status-ok)] font-medium">Upload Complete!</h3>
                    <p className="mb-6 text-sm text-[var(--st-status-ok)]/80">Log file has been streamed and parsed successfully.</p>
                    <Button variant="outline" onClick={reset}>Upload Another</Button>
                </div>
            )}

            {status === 'error' && (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-[var(--zoru-radius)] border border-[var(--st-danger)] bg-[var(--st-danger-soft)]/20 p-6 text-center">
                    <AlertCircle className="mb-4 h-12 w-12 text-[var(--st-danger)]" />
                    <h3 className="mb-2 text-lg text-[var(--st-danger)] font-medium">Upload Failed</h3>
                    <p className="mb-6 text-sm text-[var(--st-danger)]/80">{errorMessage}</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={reset}>Try Again</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
