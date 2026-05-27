'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
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
  LoaderCircle,
  CheckCircle2,
  Eraser,
  ArrowRightCircle,
  Calendar,
  User as UserIcon,
  Trash2,
  } from 'lucide-react';

import { SharePublicLinkButton } from '@/components/worksuite/share-public-link-button';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
  acceptEstimate,
  convertEstimateRequestToQuote,
  deleteEstimateRequest,
  getEstimateTemplates,
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

type Variant = 'ghost' | 'warning' | 'success' | 'danger';

const STATUS_VARIANT: Record<WsEstimateRequestStatus, Variant> = {
  pending: 'warning',
  'in-review': 'ghost',
  quoted: 'ghost',
  declined: 'danger',
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
  const { toast } = useZoruToast();

  const [data, setData] = useState<Loaded | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isConverting, setIsConverting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__none__');

  useEffect(() => {
    getEstimateTemplates().then((res) => setTemplates(res));
  }, []);
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
    const res = await convertEstimateRequestToQuote(requestId, selectedTemplateId === '__none__' ? undefined : selectedTemplateId);
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
      <Card className="p-6 border-dashed">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-zoru-ink-muted">
            Estimate request not found.
          </p>
          <Link href="/dashboard/crm/sales/estimate-requests">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <EntityDetailShell
      eyebrow="ESTIMATE REQUEST"
      title="Estimate Request"
      back={{ href: '/dashboard/crm/sales/estimate-requests', label: 'Estimate Requests' }}
      actions={
        <>
          <SharePublicLinkButton
            resourceType="estimate"
            resourceId={request._id}
          />
          <div className="flex items-center gap-2">
            {!isQuoted ? (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <ZoruSelectTrigger className="w-48 bg-white h-9">
                  <ZoruSelectValue placeholder="Select template..." />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">None (Empty Quote)</ZoruSelectItem>
                  {templates.map((t) => (
                    <ZoruSelectItem key={t._id} value={t._id}>{t.name}</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            ) : null}
            <Button
              disabled={isConverting || isQuoted}
              onClick={handleConvert}
            >
              {isConverting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightCircle className="h-4 w-4" />
              )}
              {isQuoted ? 'Already Quoted' : 'Convert to Quote'}
            </Button>
          </div>
        </>
      }
    >

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_VARIANT[request.status] || 'ghost'}>
            {request.status}
          </Badge>
          <Select
            value={request.status}
            onValueChange={(v) => handleStatusChange(v as WsEstimateRequestStatus)}
          >
            <ZoruSelectTrigger className="w-40">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {WS_ESTIMATE_REQUEST_STATUSES.map((s) => (
                <ZoruSelectItem key={s} value={s}>
                  {s}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg p-2 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-danger-ink"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <UserIcon className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Requester</p>
              <p className="text-[13px] text-zoru-ink">
                {request.requester_name || '—'}
              </p>
              {request.requester_email ? (
                <p className="text-[11.5px] text-zoru-ink-muted">
                  {request.requester_email}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Calendar className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Desired Date</p>
              <p className="text-[13px] text-zoru-ink">
                {fmtDate(request.desired_date)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Calendar className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Created</p>
              <p className="text-[13px] text-zoru-ink">
                {fmtDate(request.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-1 text-[11.5px] uppercase text-zoru-ink-muted">
            Description
          </p>
          <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
            <pre className="whitespace-pre-wrap font-sans">
              {request.description}
            </pre>
          </div>
        </div>

        {request.notes ? (
          <div className="mt-4">
            <p className="mb-1 text-[11.5px] uppercase text-zoru-ink-muted">
              Internal Notes
            </p>
            <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
              <pre className="whitespace-pre-wrap font-sans">
                {request.notes}
              </pre>
            </div>
          </div>
        ) : null}
      </Card>

      {data.accepts.length > 0 ? (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-zoru-ink" />
            <h2 className="text-[16px] text-zoru-ink">
              Accepted by customer
            </h2>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {data.accepts.map((s) => (
              <div
                key={s._id}
                className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-4"
              >
                <p className="text-[11.5px] text-zoru-ink-muted">Accepted by</p>
                <p className="text-[13px] text-zoru-ink">
                  {s.accepted_by_name}
                </p>
                <p className="text-[11.5px] text-zoru-ink-muted">
                  {s.accepted_by_email}
                </p>
                <p className="mt-2 text-[11.5px] text-zoru-ink-muted">
                  Accepted at
                </p>
                <p className="text-[13px] text-zoru-ink">
                  {fmtDateTime(s.accepted_at)}
                </p>
                {s.signature_data_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.signature_data_url}
                    alt="Signature"
                    className="mt-2 max-h-24 rounded-lg border border-zoru-line bg-white p-2"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {canAccept ? (
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-[16px] text-zoru-ink">
              Accept estimate
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Record customer acceptance with signature. This will move the
              request into <span>quoted</span>.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-zoru-ink">Full Name</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-zoru-ink">Email</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-zoru-ink">Signature</Label>
            <div className="mt-1.5 rounded-lg border border-zoru-line bg-white p-2">
              <canvas
                ref={canvasRef}
                className="block w-full touch-none rounded-lg bg-white"
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
            <Button
              variant="outline"
              onClick={clearCanvas}
              disabled={isSigning}
            >
              <Eraser className="h-4 w-4" />
              Clear
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isSigning}
            >
              {isSigning ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Accept &amp; Sign
            </Button>
          </div>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
