'use client';

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  FileSignature,
  ArrowLeft,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  Eraser,
  LoaderCircle,
} from 'lucide-react';
import {
  getContractById,
  signContract,
} from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { SharePublicLinkButton } from '@/components/worksuite/share-public-link-button';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Contract = HrContract & { _id: string };

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'green' | 'red'> = {
  draft: 'neutral',
  sent: 'amber',
  signed: 'green',
  expired: 'red',
  terminated: 'red',
};

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ContractDetailPage(props: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = use(props.params);
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const c = await getContractById(contractId);
      setContract(c as Contract | null);
    });
  }, [contractId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Setup canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      hasDrawnRef.current = false;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [contract?.status]);

  const getPoint = (
    canvas: HTMLCanvasElement,
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = getPoint(canvas, e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getPoint(canvas, e);
    const last = lastPtRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    lastPtRef.current = pt;
    hasDrawnRef.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPtRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  };

  const handleSign = async () => {
    if (!signerName.trim() || !signerEmail.trim()) {
      toast({
        title: 'Missing info',
        description: 'Please enter your full name and email.',
        variant: 'destructive',
      });
      return;
    }
    if (!hasDrawnRef.current) {
      toast({
        title: 'Signature required',
        description: 'Please draw your signature before submitting.',
        variant: 'destructive',
      });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureDataUrl = canvas.toDataURL('image/png');

    setIsSubmitting(true);
    const res = await signContract(contractId, {
      signedByName: signerName.trim(),
      signedByEmail: signerEmail.trim(),
      signatureDataUrl,
    });
    setIsSubmitting(false);

    if (res.success) {
      toast({
        title: 'Signed',
        description: 'Contract has been signed successfully.',
      });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to sign contract',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && !contract) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contract) {
    return (
      <ClayCard variant="outline" className="border-dashed">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-clay-ink-muted">Contract not found.</p>
          <Link href="/dashboard/crm/contracts">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Back to Contracts
            </ClayButton>
          </Link>
        </div>
      </ClayCard>
    );
  }

  const isSigned = contract.status === 'signed';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={contract.title}
        subtitle="Contract details and e-signature."
        icon={FileSignature}
        actions={
          <>
            <Link href="/dashboard/crm/contracts">
              <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
                All Contracts
              </ClayButton>
            </Link>
            <SharePublicLinkButton
              resourceType="contract"
              resourceId={contractId}
            />
          </>
        }
      />

      <ClayCard>
        <div className="mb-4 flex items-center gap-2">
          <ClayBadge tone={STATUS_TONES[contract.status] || 'neutral'} dot>
            {contract.status}
          </ClayBadge>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <User className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Client</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {contract.clientName || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <DollarSign className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Value</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {contract.value != null
                  ? new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: contract.currency || 'INR',
                    }).format(contract.value)
                  : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Calendar className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Start</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDate(contract.startDate)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Calendar className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">End</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDate(contract.endDate)}
              </p>
            </div>
          </div>
        </div>

        {contract.body ? (
          <div className="mt-6">
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
              Contract Body
            </p>
            <div className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-4">
              <pre className="whitespace-pre-wrap font-sans text-[13px] text-clay-ink">
                {contract.body}
              </pre>
            </div>
          </div>
        ) : null}
      </ClayCard>

      {isSigned ? (
        <ClayCard>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-clay-green" />
            <h2 className="text-[16px] font-semibold text-clay-ink">
              Signed Contract
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Signed by</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {contract.signedByName || '—'}
              </p>
              <p className="text-[11.5px] text-clay-ink-muted">
                {contract.signedByEmail || ''}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Signed at</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDateTime(contract.signedAt)}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Signature</p>
              {contract.signatureDataUrl ? (
                // Signature is a user-drawn PNG data URL; next/image isn't practical here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.signatureDataUrl}
                  alt="Signature"
                  className="mt-1 max-h-24 rounded-clay-md border border-clay-border bg-white p-2"
                />
              ) : (
                <p className="text-[13px] text-clay-ink-muted">—</p>
              )}
            </div>
          </div>
        </ClayCard>
      ) : (
        <ClayCard>
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-clay-ink">
              Sign this contract
            </h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              Enter your details and draw your signature below.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-clay-ink">Full Name</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Email</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-clay-ink">Signature</Label>
            <div className="mt-1.5 rounded-clay-md border border-clay-border bg-white p-2">
              <canvas
                ref={canvasRef}
                className="block w-full touch-none rounded-clay-md bg-white"
                style={{ height: 180 }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
            <p className="mt-1 text-[11.5px] text-clay-ink-muted">
              Use your mouse, stylus, or finger to draw your signature.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ClayButton
              variant="pill"
              leading={<Eraser className="h-4 w-4" strokeWidth={1.75} />}
              onClick={clearCanvas}
              disabled={isSubmitting}
            >
              Clear
            </ClayButton>
            <ClayButton
              variant="obsidian"
              onClick={handleSign}
              disabled={isSubmitting}
              leading={
                isSubmitting ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Sign &amp; Submit
            </ClayButton>
          </div>
        </ClayCard>
      )}
    </div>
  );
}
