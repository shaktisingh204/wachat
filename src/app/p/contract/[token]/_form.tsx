'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, ZoruCardContent, Button, Input, Label } from '@/components/zoruui';
import { CheckCircle2, Eraser, LoaderCircle, Terminal } from 'lucide-react';
import { signContractPublic } from '@/app/actions/worksuite/public.actions';
import { SignaturePad, type SignaturePadHandle } from '../../_components/signature-pad';

export function ContractSignForm({ token }: { token: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            multipart/form-data
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signer_name" className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
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
            <Label htmlFor="signer_email" className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
              signer_email <span className="text-muted-foreground font-normal">(optional)</span>
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
          <Label className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
            signature_pad <span className="text-danger">*</span>
          </Label>
          <div className="rounded-lg border border-border bg-background p-1.5 shadow-inner">
            <SignaturePad ref={padRef} />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground tracking-tight">
            // Draw inside the zone to verify cryptographically
          </p>
        </div>

        {error ? (
          <p className="text-[12px] font-mono text-danger font-medium bg-danger/5 border border-danger/25 p-2.5 rounded-lg">
            ERR_SIGN_FAILED: {error}
          </p>
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
        <div className="mt-2 border-t border-border pt-4">
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">// Curl representation</p>
            <pre className="text-[10.5px] font-mono text-foreground whitespace-pre-wrap leading-tight bg-secondary/80 p-2.5 rounded border border-border/50">
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
