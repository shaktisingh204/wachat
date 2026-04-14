'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard, ClayInput } from '@/components/clay';
import { CheckCircle2, Eraser, LoaderCircle, FileSignature } from 'lucide-react';
import { signProposalPublic } from '@/app/actions/worksuite/public.actions';
import { SignaturePad, type SignaturePadHandle } from '../../_components/signature-pad';

export function ProposalSignForm({ token }: { token: string }) {
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
    const res = await signProposalPublic(token, {
      name: name.trim(),
      email: email.trim(),
      signatureDataUrl: dataUrl,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=proposal');
  };

  return (
    <ClayCard>
      <div className="mb-3 flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-clay-rose-ink" />
        <h2 className="text-[15px] font-semibold text-clay-ink">
          Sign this proposal
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
          Full name
          <ClayInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
          Email
          <ClayInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            disabled={busy}
          />
        </label>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[12.5px] text-clay-ink">Signature</p>
        <SignaturePad ref={padRef} />
        <p className="mt-1 text-[11.5px] text-clay-ink-muted">
          Use your mouse, stylus, or finger to draw your signature.
        </p>
      </div>
      {error ? (
        <p className="mt-3 text-[12.5px] text-clay-rose-ink">{error}</p>
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
          Sign &amp; accept
        </ClayButton>
      </div>
    </ClayCard>
  );
}
