'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
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
  FileText,
  Send,
  FileSignature,
  CheckCircle2,
  Eraser,
  LoaderCircle,
  ReceiptText,
  Calendar,
  DollarSign,
  User as UserIcon,
  FileCheck2,
  } from 'lucide-react';

import { SharePublicLinkButton } from '@/components/worksuite/share-public-link-button';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getProposalById,
  signProposal,
  updateProposalStatus,
  convertProposalToInvoice,
} from '@/app/actions/worksuite/proposals.actions';
import { convertProposalToContract } from '@/app/actions/worksuite/conversions.actions';
import type {
  WsProposal,
  WsProposalItem,
  WsProposalSign,
  WsProposalStatus,
} from '@/lib/worksuite/proposals-types';

type Loaded = {
  proposal: WsProposal & { _id: string };
  items: (WsProposalItem & { _id: string })[];
  signs: (WsProposalSign & { _id: string })[];
};

type BadgeVariant = 'ghost' | 'warning' | 'success' | 'danger';

const STATUS_VARIANT: Record<WsProposalStatus, BadgeVariant> = {
  draft: 'ghost',
  sent: 'warning',
  accepted: 'success',
  declined: 'danger',
  expired: 'danger',
};

function fmtCurrency(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(value || 0);
  } catch {
    return `${currency || ''} ${(value || 0).toFixed(2)}`;
  }
}

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

export default function ProposalDetailPage(props: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = use(props.params);
  const router = useRouter();
  const { toast } = useZoruToast();

  const [data, setData] = useState<Loaded | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isConvertingContract, setIsConvertingContract] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = await getProposalById(proposalId);
      setData(d);
    });
  }, [proposalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const proposal = data?.proposal;
  const isAccepted = proposal?.status === 'accepted';
  const showSignaturePad =
    proposal?.signature_required && !isAccepted && proposal?.status !== 'draft'
      ? true
      : proposal?.signature_required && !isAccepted;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showSignaturePad) return;
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
  }, [showSignaturePad]);

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
    const res = await signProposal(proposalId, {
      name: signerName.trim(),
      email: signerEmail.trim(),
      signatureDataUrl,
    });
    setIsSubmitting(false);
    if (res.success) {
      toast({
        title: 'Signed',
        description: 'Proposal has been accepted successfully.',
      });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const markSent = async () => {
    setIsUpdatingStatus(true);
    const res = await updateProposalStatus(proposalId, 'sent');
    setIsUpdatingStatus(false);
    if (res.success) {
      toast({ title: 'Marked as sent' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const convertToInvoice = async () => {
    setIsConverting(true);
    const res = await convertProposalToInvoice(proposalId);
    setIsConverting(false);
    if (res.success) {
      toast({ title: 'Invoice created' });
      router.push('/dashboard/crm/sales/invoices');
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const convertToContract = async () => {
    setIsConvertingContract(true);
    const res = await convertProposalToContract(proposalId);
    setIsConvertingContract(false);
    if (res.success) {
      toast({ title: 'Contract created' });
      router.push('/dashboard/crm/contracts');
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex w-full flex-col gap-6">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proposal || !data) {
    return (
      <ZoruCard className="p-6 border-dashed">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-zoru-ink-muted">Proposal not found.</p>
          <Link href="/dashboard/crm/sales/proposals">
            <ZoruButton variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to Proposals
            </ZoruButton>
          </Link>
        </div>
      </ZoruCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`${proposal.proposal_number} · ${proposal.title}`}
        subtitle="Proposal details, line items, and e-signature."
        icon={FileText}
        actions={
          <>
            <Link href="/dashboard/crm/sales/proposals">
              <ZoruButton variant="outline">
                <ArrowLeft className="h-4 w-4" />
                All Proposals
              </ZoruButton>
            </Link>
            <SharePublicLinkButton
              resourceType="proposal"
              resourceId={proposalId}
            />
            {proposal.status === 'draft' ? (
              <ZoruButton
                variant="outline"
                disabled={isUpdatingStatus}
                onClick={markSent}
              >
                {isUpdatingStatus ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Mark as Sent
              </ZoruButton>
            ) : null}
            {isAccepted ? (
              <ZoruButton
                disabled={isConverting}
                onClick={convertToInvoice}
              >
                {isConverting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ReceiptText className="h-4 w-4" />
                )}
                Convert to Invoice
              </ZoruButton>
            ) : null}
            {isAccepted ? (
              <ZoruButton
                variant="outline"
                disabled={isConvertingContract}
                onClick={convertToContract}
              >
                {isConvertingContract ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck2 className="h-4 w-4" />
                )}
                Create Contract
              </ZoruButton>
            ) : null}
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ZoruBadge variant={STATUS_VARIANT[proposal.status] || 'ghost'}>
            {proposal.status}
          </ZoruBadge>
          {proposal.signature_required ? (
            <ZoruBadge variant="ghost">
              Signature required
            </ZoruBadge>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <UserIcon className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Client</p>
              <p className="text-[13px] text-zoru-ink">
                {proposal.client_id ? String(proposal.client_id) : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Calendar className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Issued</p>
              <p className="text-[13px] text-zoru-ink">
                {fmtDate(proposal.issue_date)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Calendar className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Valid Until</p>
              <p className="text-[13px] text-zoru-ink">
                {fmtDate(proposal.valid_until)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <DollarSign
                className="h-4 w-4 text-zoru-ink"
                strokeWidth={1.75}
              />
            </div>
            <div>
              <p className="text-[11.5px] text-zoru-ink-muted">Total</p>
              <p className="text-[13px] text-zoru-ink">
                {fmtCurrency(proposal.total, proposal.currency)}
              </p>
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-3 text-[16px] text-zoru-ink">Line Items</h2>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full text-[13px]">
            <thead className="bg-zoru-surface-2">
              <tr className="border-b border-zoru-line">
                <th className="p-3 text-left text-zoru-ink">Item</th>
                <th className="p-3 text-right text-zoru-ink">Qty</th>
                <th className="p-3 text-right text-zoru-ink">Unit</th>
                <th className="p-3 text-right text-zoru-ink">Tax</th>
                <th className="p-3 text-right text-zoru-ink">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="border-b border-zoru-line">
                  <td
                    colSpan={5}
                    className="p-6 text-center text-[12.5px] text-zoru-ink-muted"
                  >
                    No line items.
                  </td>
                </tr>
              ) : (
                data.items.map((it) => (
                  <tr key={it._id} className="border-b border-zoru-line">
                    <td className="p-3 align-top text-zoru-ink">
                      <div>{it.name}</div>
                      {it.description ? (
                        <div className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                          {it.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right align-top text-zoru-ink">
                      {it.quantity}
                    </td>
                    <td className="p-3 text-right align-top text-zoru-ink">
                      {fmtCurrency(it.unit_price, proposal.currency)}
                    </td>
                    <td className="p-3 text-right align-top text-zoru-ink">
                      {it.tax}%
                    </td>
                    <td className="p-3 text-right align-top text-zoru-ink">
                      {fmtCurrency(it.total, proposal.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="p-3 text-right text-zoru-ink">
                  Subtotal
                </td>
                <td className="p-3 text-right text-zoru-ink">
                  {fmtCurrency(proposal.subtotal, proposal.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="p-3 text-right text-zoru-ink">
                  Tax
                </td>
                <td className="p-3 text-right text-zoru-ink">
                  {fmtCurrency(proposal.tax, proposal.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="p-3 text-right text-zoru-ink">
                  Discount
                </td>
                <td className="p-3 text-right text-zoru-ink">
                  −{fmtCurrency(proposal.discount, proposal.currency)}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={4}
                  className="border-t border-zoru-line p-3 text-right text-zoru-ink"
                >
                  Total
                </td>
                <td className="border-t border-zoru-line p-3 text-right text-zoru-ink">
                  {fmtCurrency(proposal.total, proposal.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {proposal.note || proposal.terms ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {proposal.note ? (
              <div>
                <p className="mb-1 text-[11.5px] uppercase text-zoru-ink-muted">
                  Notes
                </p>
                <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
                  <pre className="whitespace-pre-wrap font-sans">
                    {proposal.note}
                  </pre>
                </div>
              </div>
            ) : null}
            {proposal.terms ? (
              <div>
                <p className="mb-1 text-[11.5px] uppercase text-zoru-ink-muted">
                  Terms &amp; Conditions
                </p>
                <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3 text-[13px] text-zoru-ink">
                  <pre className="whitespace-pre-wrap font-sans">
                    {proposal.terms}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </ZoruCard>

      {isAccepted ? (
        <ZoruCard className="p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="text-[16px] text-zoru-ink">
              Accepted &amp; Signed
            </h2>
          </div>
          {data.signs.length === 0 ? (
            <p className="mt-2 text-[13px] text-zoru-ink-muted">
              No signature records on file.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {data.signs.map((s) => (
                <div
                  key={s._id}
                  className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-4"
                >
                  <p className="text-[11.5px] text-zoru-ink-muted">Signed by</p>
                  <p className="text-[13px] text-zoru-ink">
                    {s.signer_name}
                  </p>
                  <p className="text-[11.5px] text-zoru-ink-muted">
                    {s.signer_email}
                  </p>
                  <p className="mt-2 text-[11.5px] text-zoru-ink-muted">
                    Signed at
                  </p>
                  <p className="text-[13px] text-zoru-ink">
                    {fmtDateTime(s.signed_at)}
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
          )}
        </ZoruCard>
      ) : proposal.signature_required ? (
        <ZoruCard className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-zoru-ink" />
            <h2 className="text-[16px] text-zoru-ink">
              Sign this proposal
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel className="text-zoru-ink">Full Name</ZoruLabel>
              <ZoruInput
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Email</ZoruLabel>
              <ZoruInput
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jane@example.com"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4">
            <ZoruLabel className="text-zoru-ink">Signature</ZoruLabel>
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
            <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
              Use your mouse, stylus, or finger to draw your signature.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ZoruButton
              variant="outline"
              onClick={clearCanvas}
              disabled={isSubmitting}
            >
              <Eraser className="h-4 w-4" />
              Clear
            </ZoruButton>
            <ZoruButton
              onClick={handleSign}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Sign &amp; Accept
            </ZoruButton>
          </div>
        </ZoruCard>
      ) : null}
    </div>
  );
}
