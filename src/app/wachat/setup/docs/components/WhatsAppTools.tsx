'use client';

import React, { useState, useEffect } from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, Button, Input } from '@/components/zoruui';
import { WABaStatus } from '../lib/types';
import { fetchStatus } from '../lib/mockApi';
import { Activity, CheckCircle2, XCircle, Clock, Smartphone, MessageSquare } from 'lucide-react';

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

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> 
            Connection Status
          </ZoruCardTitle>
          <ZoruCardDescription>Real-time monitor of your WABA connection</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center p-3 border rounded-lg bg-zoru-surface-2/20">
              <span className="font-medium">Status</span>
              {isRefreshing && !status ? (
                <span className="text-sm text-zoru-ink-muted animate-pulse">Checking...</span>
              ) : (
                <div className="flex items-center gap-2">
                  {status?.status === 'connected' && <CheckCircle2 className="w-4 h-4 text-zoru-ink" />}
                  {status?.status === 'disconnected' && <XCircle className="w-4 h-4 text-zoru-ink" />}
                  {status?.status === 'pending' && <Clock className="w-4 h-4 text-zoru-ink" />}
                  <span className="capitalize font-semibold">{status?.status || 'Unknown'}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg bg-zoru-surface-2/20">
              <span className="font-medium">Quality Rating</span>
              <span className="capitalize">{status?.qualityRating || 'N/A'}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadStatus} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Quick Test
          </ZoruCardTitle>
          <ZoruCardDescription>Send a test message to verify your setup</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Phone Number</label>
              <Input 
                placeholder="+1234567890" 
                value={testPhone} 
                onChange={(e) => setTestPhone(e.target.value)} 
              />
            </div>
            <Button className="w-full" onClick={() => alert(`Test message simulation sent to ${testPhone}`)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Hello World
            </Button>
            <p className="text-xs text-zoru-ink-muted text-center">
              Requires a verified template or an active 24-hour window.
            </p>
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
