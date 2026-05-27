'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, ZoruCardContent, Button, Input, Label, Checkbox } from '@/components/zoruui';
import { CheckCircle2, Eraser, LoaderCircle, Terminal, AlertCircle } from 'lucide-react';
import { signContractPublic } from '@/app/actions/worksuite/public.actions';
import { SignaturePad, type SignaturePadHandle } from '../../_components/signature-pad';

export function ContractSignForm({ token }: { token: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    const dataUrl = padRef.current?.toDataUrl();
    if (!dataUrl) {
      setError('Please draw your signature.');
      return;
    }
    if (!identityVerified) {
      setError('Please verify your identity to proceed.');
      return;
    }
    setBusy(true);
    const res = await signContractPublic(token, {
      name: name.trim(),
      email: email.trim(),
      signatureDataUrl: dataUrl,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=contract');
  };

  return (
    <Card className="shadow-md border-foreground/10">
      <ZoruCardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-zoru-ink flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-zoru-ink-muted" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-zoru-surface-2 px-1.5 py-0.5 rounded text-zoru-ink-muted">
            multipart/form-data
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signer_name" className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted">
              signer_name <span className="text-danger">*</span>
            </Label>
            <Input
              id="signer_name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signer_email" className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted">
              signer_email <span className="text-zoru-ink-muted font-normal">(optional)</span>
            </Label>
            <Input
              id="signer_email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-2">
          <Label className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted">
            signature_pad <span className="text-danger">*</span>
          </Label>
          <div className="rounded-lg border border-zoru-line bg-zoru-surface p-1.5 shadow-inner">
            <SignaturePad ref={padRef} />
          </div>
          <p className="text-[11px] font-mono text-zoru-ink-muted tracking-tight">
            // Draw inside the zone to verify cryptographically
          </p>
        </div>

        <div className="flex items-start gap-2 mt-2">
          <Checkbox 
            id="identity_verified" 
            checked={identityVerified}
            onCheckedChange={(checked) => setIdentityVerified(checked === true)}
            disabled={busy}
            className="mt-0.5"
          />
          <Label 
            htmlFor="identity_verified" 
            className="text-[11.5px] leading-tight font-medium text-zoru-ink-muted cursor-pointer"
          >
            I verify my identity and agree that this signature is legally binding. I authorize the storage of this signature along with my IP and request metadata for audit purposes.
          </Label>
        </div>

        {error ? (
          <div className="flex items-start gap-2 bg-danger/5 border border-danger/25 p-2.5 rounded-lg text-danger">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-[12px] font-mono font-medium">
              ERR_SIGN_FAILED: {error}
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2 justify-between">
          <Button
            variant="outline"
            onClick={() => padRef.current?.clear()}
            disabled={busy}
            className="font-mono text-[12px] h-9 px-3"
          >
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>

          <Button
            variant="default"
            className="font-mono text-[12px] h-9 px-4 min-w-32"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                EXEC...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                POST // SIGN
              </>
            )}
          </Button>
        </div>

        {/* CODE BLOCK PREVIEW */}
        <div className="mt-2 border-t border-zoru-line pt-4">
          <div className="rounded-lg bg-zoru-surface-2/40 border border-zoru-line p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zoru-ink-muted mb-1.5">// Curl representation</p>
            <pre className="text-[10.5px] font-mono text-zoru-ink whitespace-pre-wrap leading-tight bg-zoru-surface-2/80 p-2.5 rounded border border-zoru-line/50">
              {`curl -X POST https://api.sabnode.com/v1/contracts/${token.slice(0, 6)}/sign \\
  -H "Content-Type: application/json" \\
  -d '{"name": "${name || '...'}", "email": "${email || '...'}"}'`}
            </pre>
          </div>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
