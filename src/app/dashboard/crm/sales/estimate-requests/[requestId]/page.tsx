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
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileQuestion,
  LoaderCircle,
  CheckCircle2,
  Eraser,
  ArrowRightCircle,
  Calendar,
  User as UserIcon,
  Trash2,
} from 'lucide-react';
import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { SharePublicLinkButton } from '@/components/worksuite/share-public-link-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  acceptEstimate,
  convertEstimateRequestToQuote,
  deleteEstimateRequest,
  getEstimateRequestById,
  updateEstimateRequestStatus,
} from '@/app/actions/worksuite/proposals.actions';
import type {
  WsAcceptEstimate,
  WsEstimateRequest,
  WsEstimateRequestStatus,
} from '@/lib/worksuite/proposals-types';
import { WS_ESTIMATE_REQUEST_STATUSES } from '@/lib/worksuite/proposals-types';

type Loaded = {
  request: WsEstimateRequest & { _id: string };
  accepts: (WsAcceptEstimate & { _id: string })[];
};

type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'blue';

const STATUS_TONE: Record<WsEstimateRequestStatus, Tone> = {
  pending: 'amber',
  'in-review': 'blue',
  quoted: 'blue',
  declined: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function EstimateRequestDetailPage(props: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(props.params);
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<Loaded | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isConverting, setIsConverting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = await getEstimateRequestById(requestId);
      setData(d);
    });
  }, [requestId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = data?.request;
  const isQuoted = request?.status === 'quoted';
  const canAccept = request && !isQuoted && request.status !== 'declined';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canAccept) return;
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
  }, [canAccept]);

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

  const handleAccept = async () => {
    if (!signerName.trim() || !signerEmail.trim()) {
      toast({
        title: 'Missing info',
        description: 'Enter full name and email.',
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
    setIsSigning(true);
    const res = await acceptEstimate(requestId, {
      name: signerName.trim(),
      email: signerEmail.trim(),
      signatureDataUrl,
    });
    setIsSigning(false);
    if (res.success) {
      toast({ title: 'Estimate accepted' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleConvert = async () => {
    setIsConverting(true);
    const res = await convertEstimateRequestToQuote(requestId);
    setIsConverting(false);
    if (res.success) {
      toast({
        title: 'Converted to quote',
        description: `Created in ${res.collection}.`,
      });
      if (res.collection === 'crm_quotations') {
        router.push('/dashboard/crm/sales/quotations');
      } else {
        refresh();
      }
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (s: WsEstimateRequestStatus) => {
    const res = await updateEstimateRequestStatus(requestId, s);
    if (res.success) {
      toast({ title: 'Status updated' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this request?')) return;
    const res = await deleteEstimateRequest(requestId);
    if (res.success) {
      toast({ title: 'Deleted' });
      router.push('/dashboard/crm/sales/estimate-requests');
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!request || !data) {
    return (
      <ClayCard variant="outline" className="border-dashed">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-clay-ink-muted">
            Estimate request not found.
          </p>
          <Link href="/dashboard/crm/sales/estimate-requests">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Back
            </ClayButton>
          </Link>
        </div>
      </ClayCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Estimate Request"
        subtitle="Review details, set status, and convert to a quote."
        icon={FileQuestion}
        actions={
          <>
            <Link href="/dashboard/crm/sales/estimate-requests">
              <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
                Back
              </ClayButton>
            </Link>
            <SharePublicLinkButton
              resourceType="estimate"
              resourceId={request._id}
            />
            <ClayButton
              variant="obsidian"
              disabled={isConverting || isQuoted}
              onClick={handleConvert}
              leading={
                isConverting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightCircle className="h-4 w-4" />
                )
              }
            >
              {isQuoted ? 'Already Quoted' : 'Convert to Quote'}
            </ClayButton>
          </>
        }
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ClayBadge tone={STATUS_TONE[request.status] || 'neutral'} dot>
            {request.status}
          </ClayBadge>
          <Select
            value={request.status}
            onValueChange={(v) => handleStatusChange(v as WsEstimateRequestStatus)}
          >
            <SelectTrigger className="h-9 w-40 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WS_ESTIMATE_REQUEST_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-clay-md p-2 text-clay-ink-muted hover:bg-clay-red-soft hover:text-clay-red"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <UserIcon className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Requester</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {request.requester_name || '—'}
              </p>
              {request.requester_email ? (
                <p className="text-[11.5px] text-clay-ink-muted">
                  {request.requester_email}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Calendar className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Desired Date</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDate(request.desired_date)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Calendar className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Created</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDate(request.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
            Description
          </p>
          <div className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-3 text-[13px] text-clay-ink">
            <pre className="whitespace-pre-wrap font-sans">
              {request.description}
            </pre>
          </div>
        </div>

        {request.notes ? (
          <div className="mt-4">
            <p className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
              Internal Notes
            </p>
            <div className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-3 text-[13px] text-clay-ink">
              <pre className="whitespace-pre-wrap font-sans">
                {request.notes}
              </pre>
            </div>
          </div>
        ) : null}
      </ClayCard>

      {data.accepts.length > 0 ? (
        <ClayCard>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-clay-green" />
            <h2 className="text-[16px] font-semibold text-clay-ink">
              Accepted by customer
            </h2>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {data.accepts.map((s) => (
              <div
                key={s._id}
                className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-4"
              >
                <p className="text-[11.5px] text-clay-ink-muted">Accepted by</p>
                <p className="text-[13px] font-medium text-clay-ink">
                  {s.accepted_by_name}
                </p>
                <p className="text-[11.5px] text-clay-ink-muted">
                  {s.accepted_by_email}
                </p>
                <p className="mt-2 text-[11.5px] text-clay-ink-muted">
                  Accepted at
                </p>
                <p className="text-[13px] text-clay-ink">
                  {fmtDateTime(s.accepted_at)}
                </p>
                {s.signature_data_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.signature_data_url}
                    alt="Signature"
                    className="mt-2 max-h-24 rounded-clay-md border border-clay-border bg-white p-2"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </ClayCard>
      ) : null}

      {canAccept ? (
        <ClayCard>
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-clay-ink">
              Accept estimate
            </h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              Record customer acceptance with signature. This will move the
              request into <span className="font-medium">quoted</span>.
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
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ClayButton
              variant="pill"
              leading={<Eraser className="h-4 w-4" />}
              onClick={clearCanvas}
              disabled={isSigning}
            >
              Clear
            </ClayButton>
            <ClayButton
              variant="obsidian"
              onClick={handleAccept}
              disabled={isSigning}
              leading={
                isSigning ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )
              }
            >
              Accept &amp; Sign
            </ClayButton>
          </div>
        </ClayCard>
      ) : null}
    </div>
  );
}
