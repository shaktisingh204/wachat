'use client';

import * as React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Field,
  Badge,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { Terminal, CheckCircle, AlertTriangle } from 'lucide-react';
import { InquiryRecord, EnterpriseResponse } from '../types';

interface SimulatorProps {
  onNewRequest: (req: InquiryRecord) => void;
}

export function Simulator({ onNewRequest }: SimulatorProps) {
  const [formData, setFormData] = React.useState({
    organization: '',
    email: '',
    volume: '100k-500k',
    useCase: '',
  });

  const [responseState, setResponseState] = React.useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [responsePayload, setResponsePayload] = React.useState<EnterpriseResponse | null>(null);

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organization || !formData.email) {
      setResponseState('error');
      setResponsePayload({
        status: 400,
        status_text: 'Bad Request',
        transaction_id: 'tx_err_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        error: 'Missing required fields: organization, email',
      });
      return;
    }

    // Simulate API error if email doesn't look corporate (simple check)
    const isPersonalEmail = /@(gmail\\.com|yahoo\\.com|hotmail\\.com)$/i.test(formData.email);
    if (isPersonalEmail) {
      setResponseState('error');
      setResponsePayload({
        status: 403,
        status_text: 'Forbidden',
        transaction_id: 'tx_err_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        error: 'Personal emails are rejected by policy. Please use a corporate email.',
      });

      onNewRequest({
        id: 'tx_err_' + Math.random().toString(36).substr(2, 9),
        organization: formData.organization,
        email: formData.email,
        volume: formData.volume,
        useCase: formData.useCase,
        status: 'error',
        createdAt: new Date().toISOString(),
      });

      return;
    }

    setResponseState('executing');
    setTimeout(() => {
      setResponseState('success');
      const txId = 'tx_ent_' + Math.random().toString(36).substr(2, 9);
      const createdAt = new Date().toISOString();

      setResponsePayload({
        status: 201,
        status_text: 'Created',
        transaction_id: txId,
        timestamp: createdAt,
        payload: {
          organization: formData.organization,
          email: formData.email,
          volume: formData.volume,
          message: 'Handshake initiated. A SabNode solutions engineer will contact you in < 2 hours.',
        },
      });

      onNewRequest({
        id: txId,
        organization: formData.organization,
        email: formData.email,
        volume: formData.volume,
        useCase: formData.useCase,
        status: 'pending',
        createdAt: createdAt,
      });
    }, 1200);
  };

  return (
    <div className="20ui w-full lg:w-[450px] xl:w-[550px] bg-[var(--st-bg-secondary)] border-l border-[var(--st-border)] p-6 flex flex-col md:h-screen md:overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--st-text-tertiary)] mb-3">Example Request</h3>
        <div className="bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-4 text-xs font-mono text-[var(--st-text-secondary)] overflow-x-auto">
          <pre>{`curl -X POST https://api.sabnode.in/v1/enterprise/inquire \\
  -H "Content-Type: application/json" \\
  -d '{
    "organization": "${formData.organization || 'Acme Corp'}",
    "email": "${formData.email || 'cto@acme.com'}",
    "volume": "${formData.volume}",
    "use_case": "${formData.useCase || 'Private cluster'}"
  }'`}</pre>
        </div>
      </div>

      <div className="flex-grow">
        <Card variant="outlined" padding="none" className="mb-6">
          <CardHeader>
            <CardTitle>Try it out</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <Field label="organization" required>
              <Input
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder="string"
              />
            </Field>
            <Field label="email">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="string ($email)"
              />
            </Field>
            <Field label="volume">
              <Select
                value={formData.volume}
                onValueChange={(value) => setFormData({ ...formData, volume: value })}
              >
                <SelectTrigger aria-label="volume">
                  <SelectValue placeholder="Select volume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<100k">&lt; 100k</SelectItem>
                  <SelectItem value="100k-500k">100k - 500k</SelectItem>
                  <SelectItem value="500k-2m">500k - 2m</SelectItem>
                  <SelectItem value="2m+">2m+</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="use_case">
              <Textarea
                value={formData.useCase}
                onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                placeholder="string"
                rows={4}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              block
              onClick={handleExecute}
              loading={responseState === 'executing'}
              className="uppercase tracking-widest font-bold mt-4"
            >
              {responseState === 'executing' ? 'Executing...' : 'Execute'}
            </Button>
          </CardBody>
        </Card>

        {/* Response Box */}
        {responseState !== 'idle' && (
          <Card
            variant="outlined"
            padding="md"
            className={responseState === 'error' ? 'border-[var(--st-danger)]' : undefined}
          >
            <h4
              className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
                responseState === 'error' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-tertiary)]'
              }`}
            >
              {responseState === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                  Response Received
                </>
              ) : responseState === 'error' ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-[var(--st-danger)]" aria-hidden="true" />
                  Request Failed
                </>
              ) : (
                <>
                  <Terminal className="h-4 w-4 animate-pulse" aria-hidden="true" />
                  Waiting for Server Response...
                </>
              )}
            </h4>

            {(responseState === 'success' || responseState === 'error') && responsePayload ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs font-bold">
                  <Badge tone={responseState === 'error' ? 'danger' : 'neutral'} kind="soft">
                    HTTP {responsePayload.status}
                  </Badge>
                  <span className={responseState === 'error' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}>
                    {responsePayload.status_text}
                  </span>
                </div>
                <pre
                  className={`text-xs font-mono p-3 rounded-[var(--st-radius)] overflow-x-auto max-h-[220px] ${
                    responseState === 'error'
                      ? 'bg-[var(--st-danger)]/5 text-[var(--st-danger)]'
                      : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]'
                  }`}
                >
                  <code>{JSON.stringify(responsePayload, null, 2)}</code>
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton height={16} width="100%" />
                <Skeleton height={16} width="75%" />
                <Skeleton height={16} width="50%" />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
