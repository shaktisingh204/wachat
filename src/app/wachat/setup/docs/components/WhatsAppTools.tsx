'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Field,
  Input,
  Badge,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { WABaStatus } from '../lib/types';
import { fetchStatus } from '../lib/mockApi';
import { Activity, CheckCircle2, XCircle, Clock, Smartphone, MessageSquare } from 'lucide-react';

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

const STATUS_TONE: Record<string, BadgeTone> = {
  connected: 'success',
  disconnected: 'danger',
  pending: 'warning',
};

export function WhatsAppTools() {
  const [status, setStatus] = useState<WABaStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const loadStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load status', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusKey = status?.status;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" aria-hidden="true" />
            Connection Status
          </CardTitle>
          <CardDescription>Real-time monitor of your WABA connection</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <div
              className="flex justify-between items-center p-3 rounded-lg"
              style={{ background: 'var(--st-bg-secondary)', border: '1px solid var(--st-border)' }}
            >
              <span className="font-medium">Status</span>
              {isRefreshing && !status ? (
                <span className="text-sm animate-pulse" style={{ color: 'var(--st-text-muted)' }}>
                  Checking...
                </span>
              ) : (
                <Badge
                  tone={statusKey ? STATUS_TONE[statusKey] ?? 'neutral' : 'neutral'}
                  className="capitalize"
                >
                  {statusKey === 'connected' && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  {statusKey === 'disconnected' && <XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                  {statusKey === 'pending' && <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
                  {statusKey || 'Unknown'}
                </Badge>
              )}
            </div>
            <div
              className="flex justify-between items-center p-3 rounded-lg"
              style={{ background: 'var(--st-bg-secondary)', border: '1px solid var(--st-border)' }}
            >
              <span className="font-medium">Quality Rating</span>
              <span className="capitalize">{status?.qualityRating || 'N/A'}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadStatus} disabled={isRefreshing} loading={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" aria-hidden="true" />
            Quick Test
          </CardTitle>
          <CardDescription>Send a test message to verify your setup</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-4">
            <Field
              label="Test Phone Number"
              help="Requires a verified template or an active 24-hour window."
            >
              <Input
                placeholder="+1234567890"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              block
              iconLeft={MessageSquare}
              onClick={() => alert(`Test message simulation sent to ${testPhone}`)}
            >
              Send Hello World
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
