'use client';

import * as React from 'react';
import { Card, CardBody, CardHeader, CardTitle, Button, Input, Textarea, Label } from '@/components/sabcrm/20ui';
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
      const txId = "tx_ent_" + Math.random().toString(36).substr(2, 9);
      const createdAt = new Date().toISOString();
      
      setResponsePayload({
        status: 201,
        status_text: "Created",
        transaction_id: txId,
        timestamp: createdAt,
        payload: {
          organization: formData.organization,
          email: formData.email,
          volume: formData.volume,
          message: "Handshake initiated. A SabNode solutions engineer will contact you in < 2 hours."
        }
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
    <div className="w-full lg:w-[450px] xl:w-[550px] bg-zinc-950 border-l border-white/20 p-6 flex flex-col md:h-screen md:overflow-y-auto">
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-3">Example Request</h3>
        <div className="bg-black border border-white/20 p-4 text-xs font-mono text-white/80 overflow-x-auto">
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
        <Card className="bg-black border-white/20 text-white rounded-none shadow-none mb-6">
          <CardHeader className="border-b border-white/20 pb-4">
            <CardTitle className="text-lg font-bold">Try it out</CardTitle>
          </CardHeader>
          <CardBody className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="org" className="text-white">organization <span className="text-white/50">*</span></Label>
              <Input 
                id="org" 
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder="string" 
                className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">email <span className="text-white/50">*</span></Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="string ($email)" 
                className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume" className="text-white">volume</Label>
              <select 
                id="volume" 
                value={formData.volume}
                onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                className="w-full h-9 bg-zinc-900 border border-white/20 text-white px-3 text-sm rounded-none focus-visible:outline-none focus-visible:border-white"
              >
                <option value="<100k">&lt; 100k</option>
                <option value="100k-500k">100k - 500k</option>
                <option value="500k-2m">500k - 2m</option>
                <option value="2m+">2m+</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="use_case" className="text-white">use_case</Label>
              <Textarea 
                id="use_case" 
                value={formData.useCase}
                onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                placeholder="string" 
                className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none min-h-[100px] focus-visible:ring-1 focus-visible:ring-white" 
              />
            </div>
            <Button 
              onClick={handleExecute}
              className="w-full bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
              disabled={responseState === 'executing'}
            >
              {responseState === 'executing' ? (
                <>
                  <span className="h-4 w-4 animate-spin border-2 border-black border-t-transparent rounded-full" />
                  Executing...
                </>
              ) : 'Execute'}
            </Button>
          </CardBody>
        </Card>

        {/* Response Box */}
        {responseState !== 'idle' && (
          <div className={`border p-4 bg-black ${responseState === 'error' ? 'border-red-500/50' : 'border-white/20'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${responseState === 'error' ? 'text-red-400' : 'text-white/50'}`}>
              {responseState === 'success' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-white" />
                  Response Received
                </>
              ) : responseState === 'error' ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Request Failed
                </>
              ) : (
                <>
                  <Terminal className="h-4 w-4 animate-pulse" />
                  Waiting for Server Response...
                </>
              )}
            </h4>
            
            {(responseState === 'success' || responseState === 'error') && responsePayload ? (
              <div className="space-y-3">
                <div className="flex gap-4 text-xs font-bold">
                  <span className={`px-2 py-0.5 ${responseState === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
                    HTTP {responsePayload.status}
                  </span>
                  <span className={responseState === 'error' ? 'text-red-400/80' : 'text-white/60'}>
                    {responsePayload.status_text}
                  </span>
                </div>
                {responseState === 'executing' ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-full"></div>
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                  </div>
                ) : (
                  <pre className={`text-xs font-mono p-3 overflow-x-auto max-h-[220px] ${responseState === 'error' ? 'bg-red-500/5 text-red-300' : 'bg-white/5 text-white/80'}`}>
                    <code>{JSON.stringify(responsePayload, null, 2)}</code>
                  </pre>
                )}
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center border border-dashed border-white/20 text-xs text-white/40">
                Negotiating WebSocket connection...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
