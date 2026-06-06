'use client';

import * as React from 'react';
import { Card, Badge, Tooltip, ZoruTooltipTrigger, ZoruTooltipContent, ZoruTooltipProvider } from '@/components/sabcrm/20ui/compat';
import { Check, ArrowRight, FileText, ArrowRightCircle } from 'lucide-react';

export interface LineageNode {
  id: string;
  label: string;
  type: 'Lead' | 'Quotation' | 'SalesOrder' | 'Delivery' | 'Invoice' | 'Receipt';
  status: 'completed' | 'active' | 'pending';
  docNumber?: string;
  dateString?: string;
  valueString?: string;
}

interface CrmLineageChartProps {
  nodes: LineageNode[];
  onNodeClick?: (node: LineageNode) => void;
}

export function CrmLineageChart({ nodes, onNodeClick }: CrmLineageChartProps) {
  // Variant configurations
  const nodeStyles = {
    completed: {
      card: 'border-zoru-success bg-zoru-success/5 hover:bg-zoru-success/10',
      badge: 'success',
      iconBg: 'bg-zoru-success text-white',
    },
    active: {
      card: 'border-primary bg-zoru-ink/5 hover:bg-zoru-ink/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/40',
      badge: 'info',
      iconBg: 'bg-zoru-ink text-white animate-pulse',
    },
    pending: {
      card: 'border-zoru-line bg-zoru-surface-2/20 hover:bg-zoru-surface-2/40 opacity-70',
      badge: 'ghost',
      iconBg: 'bg-zoru-surface text-zoru-ink-subtle',
    },
  };

  return (
    <ZoruTooltipProvider>
      <Card className="p-5 border border-zoru-line bg-zoru-surface">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-zoru-ink-muted mb-4 flex items-center gap-2">
          <ArrowRightCircle className="h-4 w-4 text-zoru-ink" /> Document Conversion Lineage Track
        </h4>

        {/* Scrollable node track */}
        <div className="flex items-center gap-3 overflow-x-auto py-4 px-2 no-scrollbar">
          {nodes.map((node, idx) => {
            const isLast = idx === nodes.length - 1;
            const style = nodeStyles[node.status];

            return (
              <React.Fragment key={node.id}>
                {/* Node Card */}
                <Tooltip>
                  <ZoruTooltipTrigger asChild>
                    <div
                      onClick={() => onNodeClick && onNodeClick(node)}
                      className={`flex flex-col gap-2 p-3.5 rounded-xl border w-[170px] shrink-0 cursor-pointer select-none transition-all duration-300 ${style.card}`}
                    >
                      {/* Badge / Status */}
                      <div className="flex items-center justify-between">
                        <Badge variant={style.badge as any} className="text-[10px] px-1.5 h-4.5 font-normal uppercase">
                          {node.type}
                        </Badge>
                        <div className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] ${style.iconBg}`}>
                          {node.status === 'completed' ? (
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          ) : (
                            <FileText className="h-2.5 w-2.5" />
                          )}
                        </div>
                      </div>

                      {/* Content block */}
                      <div className="mt-1">
                        <div className="text-[13px] font-semibold text-zoru-ink truncate">
                          {node.docNumber ?? 'N/A'}
                        </div>
                        {node.valueString && (
                          <div className="text-[11px] font-medium text-zoru-ink-muted mt-0.5">
                            {node.valueString}
                          </div>
                        )}
                        {node.dateString && (
                          <div className="text-[10px] text-zoru-ink-subtle mt-1 font-mono">
                            {node.dateString}
                          </div>
                        )}
                      </div>
                    </div>
                  </ZoruTooltipTrigger>
                  
                  {/* Detailed tooltip */}
                  <ZoruTooltipContent className="bg-zoru-surface border border-zoru-line text-zoru-ink p-3 rounded-lg shadow-lg w-[220px]">
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted font-bold">
                        {node.type} Record Details
                      </div>
                      <div className="text-[13px] font-semibold text-zoru-ink">
                        Num: {node.docNumber ?? 'Awaiting conversion'}
                      </div>
                      {node.valueString && (
                        <div className="text-[12px] text-zoru-ink-muted">
                          Amount: {node.valueString}
                        </div>
                      )}
                      <div className="text-[11px] text-zoru-ink-subtle flex items-center gap-1.5">
                        Status: <Badge variant={style.badge as any} className="text-[9px] px-1 py-0">{node.status}</Badge>
                      </div>
                      <div className="text-[10px] text-zoru-ink-muted pt-1.5 border-t border-zoru-line">
                        Click node card to preview record.
                      </div>
                    </div>
                  </ZoruTooltipContent>
                </Tooltip>

                {/* Arrow Connector */}
                {!isLast && (
                  <div className="flex items-center shrink-0 mx-1">
                    <ArrowRight className={`h-4.5 w-4.5 ${
                      node.status === 'completed' ? 'text-zoru-success opacity-80' : 'text-zoru-line'
                    }`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>
    </ZoruTooltipProvider>
  );
}
