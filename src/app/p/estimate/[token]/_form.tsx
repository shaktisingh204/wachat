'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard, ClayInput } from '@/components/clay';
import { CheckCircle2, Eraser, LoaderCircle } from 'lucide-react';
import { acceptEstimatePublic } from '@/app/actions/worksuite/public.actions';
import { SignaturePad, type SignaturePadHandle } from '../../_components/signature-pad';

export function EstimateAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Please enter your full name and email.');
      return;
    }
    const dataUrl = padRef.current?.toDataUrl();
    if (!dataUrl) {
      setError('Please draw your signature.');
      return;
    }
    setBusy(true);
    const res = await acceptEstimatePublic(token, {
      name: name.trim(),
      email: email.trim(),
      signatureDataUrl: dataUrl,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=estimate');
  };

  return (
    <ClayCard>
      <h2 className="mb-3 text-[15px] font-semibold text-foreground">
        Accept this estimate
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12.5px] text-foreground">
          Full name
          <ClayInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-foreground">
          Email
          <ClayInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[12.5px] text-foreground">Signature</p>
        <SignaturePad ref={padRef} />
      </div>
      {error ? (
        <p className="mt-3 text-[12.5px] text-accent-foreground">{error}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <ClayButton
          variant="pill"
          leading={<Eraser className="h-4 w-4" />}
          onClick={() => padRef.current?.clear()}
          disabled={busy}
        >
          Clear
        </ClayButton>
        <ClayButton
          variant="obsidian"
          onClick={submit}
          disabled={busy}
          leading={
            busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )
          }
        >
          Accept estimate
        </ClayButton>
      </div>
    </ClayCard>
  );
}
