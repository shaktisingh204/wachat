'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Paperclip, X } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { formatSabpayAmount, type SabpayDispute } from '@/lib/sabpay/types';

import {
  acceptSabpayDispute,
  contestSabpayDispute,
} from '../../actions/disputes';
import { ConfirmAction } from '../../_components/confirm-action';

interface EvidenceFile {
  name: string;
  url: string;
}

/** Best-effort display name for an already-attached evidence URL. */
function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url, 'https://sabnode.local').pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url;
  } catch {
    return url;
  }
}

export function DisputeDetailClient({
  dispute,
}: {
  dispute: SabpayDispute;
}): React.JSX.Element {
  const router = useRouter();
  const [summary, setSummary] = React.useState(dispute.evidence?.summary ?? '');
  const [files, setFiles] = React.useState<EvidenceFile[]>(
    (dispute.evidence?.fileUrls ?? []).map((url) => ({
      name: fileNameFromUrl(url),
      url,
    })),
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [acceptOpen, setAcceptOpen] = React.useState(false);

  async function handleContest(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = summary.trim();
    if (!trimmed) {
      setFormError('Describe why the charge is legitimate.');
      return;
    }
    setSubmitting(true);
    const result = await contestSabpayDispute(dispute.id, {
      summary: trimmed,
      fileUrls: files.map((f) => f.url),
    });
    setSubmitting(false);
    if (result.error || !result.dispute) {
      setFormError(result.error || 'Could not submit the evidence.');
      return;
    }
    toast({
      title: 'Evidence submitted',
      description: 'The dispute is now under review.',
      tone: 'success',
    });
    router.refresh();
  }

  async function handleAccept() {
    const result = await acceptSabpayDispute(dispute.id);
    if (result.error || !result.dispute) {
      toast({
        title: 'Could not accept the dispute',
        description: result.error || 'Something went wrong.',
        tone: 'danger',
      });
      // Keep the confirmation dialog open so the toast is read in context.
      throw new Error(result.error || 'Accept failed');
    }
    toast({
      title: 'Dispute accepted',
      description: 'The dispute is marked lost and the disputed amount is forfeited.',
    });
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Respond with evidence</CardTitle>
          <CardDescription>
            {dispute.status === 'under_review'
              ? 'Your evidence is under review — you can update it until the dispute is resolved.'
              : 'Contest the chargeback with a written summary and supporting documents, or accept it to concede the funds.'}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form
            id="sabpay-contest-dispute"
            onSubmit={handleContest}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field
              label="Summary"
              required
              error={formError}
              help="Explain why the charge is legitimate — delivery proof, customer communication, refund policy."
            >
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="The customer received the order on 4 June (tracking AWB123) and did not request a refund…"
                rows={5}
                required
              />
            </Field>

            <Field
              label="Documents"
              help="Invoices, delivery proofs, screenshots — attached from your SabFiles library."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((file) => (
                  <div
                    key={file.url}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      border: '1px solid var(--st-border)',
                      borderRadius: 8,
                      minWidth: 0,
                    }}
                  >
                    <FileText
                      size={15}
                      style={{ color: 'var(--st-text-muted)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<X size={14} />}
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setFiles((prev) =>
                          prev.filter((f) => f.url !== file.url),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div>
                  <SabFilePickerButton
                    accept="all"
                    variant="outline"
                    onPick={(p) => {
                      setFiles((prev) =>
                        prev.some((f) => f.url === p.url)
                          ? prev
                          : [...prev, { name: p.name, url: p.url }],
                      );
                    }}
                  >
                    <Paperclip size={14} style={{ marginRight: 6 }} />
                    Add document
                  </SabFilePickerButton>
                </div>
              </div>
            </Field>
          </form>
        </CardBody>
        <CardFooter>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            <Button
              variant="danger"
              onClick={() => setAcceptOpen(true)}
              disabled={submitting}
            >
              Accept dispute
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-contest-dispute"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit evidence (Contest)'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <ConfirmAction
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        onConfirm={handleAccept}
        title="Accept this dispute?"
        description={`Accepting concedes the chargeback — the dispute is marked lost and ${formatSabpayAmount(dispute.amount, dispute.currency)} is forfeited to the customer. This cannot be undone.`}
        confirmLabel="Accept dispute"
        tone="danger"
      />
    </>
  );
}
