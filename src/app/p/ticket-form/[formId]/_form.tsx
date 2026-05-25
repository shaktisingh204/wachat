'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';
import { LoaderCircle, Send, UploadCloud, X, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
import { submitPublicTicket } from '@/app/actions/worksuite/public.actions';

interface Field {
  _id: string;
  field_name: string;
  field_type: string;
  field_values?: string;
  is_required?: boolean;
}

const BASE_FIELDS: Field[] = [
  { _id: 'name', field_name: 'name', field_type: 'text', is_required: true },
  { _id: 'email', field_name: 'email', field_type: 'email', is_required: true },
  { _id: 'subject', field_name: 'subject', field_type: 'text', is_required: true },
  {
    _id: 'description',
    field_name: 'description',
    field_type: 'textarea',
    is_required: true,
  },
];

export function TicketFormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: Field[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Optimistic UI state
  const [isSubmittedOptimistically, setIsSubmittedOptimistically] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);

  // Spam protection
  const [spamVerified, setSpamVerified] = useState(false);
  const [mathA] = useState(Math.floor(Math.random() * 10) + 1);
  const [mathB] = useState(Math.floor(Math.random() * 10) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Hidden fields / Tracking
  const [trackingData, setTrackingData] = useState<Record<string, string>>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setTrackingData({
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      referrer: document.referrer || '',
    });
  }, []);

  const allFields = [
    ...BASE_FIELDS,
    ...fields.filter(
      (f) => !BASE_FIELDS.some((b) => b.field_name === f.field_name),
    ),
  ];

  const setValue = (k: string, v: any) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setError(null);
    for (const f of allFields) {
      if (f.is_required && !String(values[f.field_name] || '').trim()) {
        setError(`${labelize(f.field_name)} is required`);
        return;
      }
    }
    
    if (parseInt(captchaAnswer) !== mathA + mathB) {
      setError('Spam protection verification failed. Please try again.');
      return;
    }

    // Optimistic UI update
    setBusy(true);
    setIsSubmittedOptimistically(true);
    
    // Merge hidden tracking data
    const finalData = {
      ...values,
      ...trackingData
    };

    const res = await submitPublicTicket(formId, finalData);
    setBusy(false);
    
    if (!res.success) {
      setSubmissionSuccess(false);
      setError(res.error);
      setIsSubmittedOptimistically(false);
      return;
    }
    
    setSubmissionSuccess(true);
    // Optional: wait a bit and redirect, or just keep the success message
    setTimeout(() => {
      router.push('/p/thanks?type=ticket');
    }, 2000);
  };

  if (isSubmittedOptimistically) {
    return (
      <ClayCard className="flex flex-col items-center justify-center py-12 text-center">
        {submissionSuccess === null ? (
          <>
            <LoaderCircle className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium text-foreground">Submitting ticket...</h3>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we process your request.</p>
          </>
        ) : submissionSuccess === true ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ticket submitted!</h3>
            <p className="text-sm text-muted-foreground mt-2">Redirecting you shortly...</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Submission Failed</h3>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <ClayButton 
              className="mt-6" 
              onClick={() => { setIsSubmittedOptimistically(false); setError(null); }}
            >
              Try Again
            </ClayButton>
          </>
        )}
      </ClayCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ClayCard>
        <div className="grid gap-4">
          {allFields.map((f) => (
            <FieldInput
              key={f._id}
              field={f}
              value={values[f.field_name] || ''}
              onChange={(v) => setValue(f.field_name, v)}
              disabled={busy}
            />
          ))}
          
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] text-foreground">Attachments</span>
            <FileDropzone 
              files={values.attachments || []} 
              onFilesChange={(files) => setValue('attachments', files)} 
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border p-3 bg-secondary/20">
            <span className="text-[12.5px] text-foreground font-medium mb-2 flex items-center gap-2">
              Spam Protection <span className="text-accent-foreground">*</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm">What is {mathA} + {mathB}?</span>
              <ClayInput 
                type="number" 
                value={captchaAnswer} 
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                disabled={busy}
                className="w-20"
                placeholder="="
              />
            </div>
          </div>
        </div>
        
        {error ? (
          <p className="mt-4 text-[13px] text-red-500 font-medium">{error}</p>
        ) : null}
        
        <div className="mt-6 flex justify-end">
          <ClayButton
            variant="obsidian"
            onClick={submit}
            disabled={busy}
            leading={
              busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )
            }
          >
            Submit ticket
          </ClayButton>
        </div>
      </ClayCard>
      
      {/* Live Chat Fallback */}
      <ClayCard className="bg-secondary/30 border-dashed">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Need faster help?
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Our support agents are available for live chat.
            </p>
          </div>
          <ClayButton 
            variant="outline" 
            onClick={() => alert('Live chat initiated. (Demo fallback)')}
          >
            Start Live Chat
          </ClayButton>
        </div>
      </ClayCard>
    </div>
  );
}

function FileDropzone({ 
  files, 
  onFilesChange,
  disabled
}: { 
  files: {name: string, url: string, type: string}[]; 
  onFilesChange: (files: {name: string, url: string, type: string}[]) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const processFiles = (newFiles) => {
    const filePromises = Array.from(newFiles).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({ name: file.name, url: e.target?.result, type: file.type });
        };
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(filePromises).then(processed => {
      onFilesChange([...files, ...processed]);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  return (
    <div className="flex flex-col gap-2">
      <div 
        className={`relative border-2 border-dashed rounded-md p-6 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-secondary/10'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-secondary/20'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          multiple 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onChange={handleFileInput}
          disabled={disabled}
        />
        <UploadCloud className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Click to upload</span> or drag and drop
        </p>
      </div>
      
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between bg-secondary/30 p-2 rounded text-xs border border-border">
              <span className="truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
              <button 
                type="button" 
                onClick={() => removeFile(i)}
                disabled={disabled}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const labelText = labelize(field.field_name);
  const label = (
    <span className="text-[12.5px] text-foreground">
      {labelText}
      {field.is_required ? (
        <span className="text-accent-foreground"> *</span>
      ) : null}
    </span>
  );
  if (field.field_type === 'textarea') {
    return (
      <label className="flex flex-col gap-1">
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="clay-input min-h-[120px] py-2"
          rows={5}
        />
      </label>
    );
  }
  if (field.field_type === 'select' && field.field_values) {
    const opts = field.field_values
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    return (
      <label className="flex flex-col gap-1">
        {label}
        <ClaySelect
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          options={[
            { value: '', label: 'Select…' },
            ...opts.map((v) => ({ value: v, label: v })),
          ]}
        />
      </label>
    );
  }
  const inputType =
    field.field_type === 'date'
      ? 'date'
      : field.field_type === 'number'
        ? 'number'
        : field.field_type === 'email'
          ? 'email'
          : field.field_type === 'url'
            ? 'url'
            : 'text';
  return (
    <label className="flex flex-col gap-1">
      {label}
      <ClayInput
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function labelize(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
