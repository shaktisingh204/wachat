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
      card: 'border-[var(--st-status-ok)] bg-[var(--st-status-ok)]/5 hover:bg-[var(--st-status-ok)]/10',
      badge: 'success',
      iconBg: 'bg-[var(--st-status-ok)] text-white',
    },
    active: {
      card: 'border-primary bg-[var(--st-text)]/5 hover:bg-[var(--st-text)]/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/40',
      badge: 'info',
      iconBg: 'bg-[var(--st-text)] text-white animate-pulse',
    },
    pending: {
      card: 'border-[var(--st-border)] bg-[var(--st-bg-muted)]/20 hover:bg-[var(--st-bg-muted)]/40 opacity-70',
      badge: 'ghost',
      iconBg: 'bg-[var(--st-bg-secondary)] text-[var(--st-text-tertiary)]',
    },
  };

  return (
    <ZoruTooltipProvider>
      <Card className="p-5 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-4 flex items-center gap-2">
          <ArrowRightCircle className="h-4 w-4 text-[var(--st-text)]" /> Document Conversion Lineage Track
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
                        <div className="text-[13px] font-semibold text-[var(--st-text)] truncate">
                          {node.docNumber ?? 'N/A'}
                        </div>
                        {node.valueString && (
                          <div className="text-[11px] font-medium text-[var(--st-text-secondary)] mt-0.5">
                            {node.valueString}
                          </div>
                        )}
                        {node.dateString && (
                          <div className="text-[10px] text-[var(--st-text-tertiary)] mt-1 font-mono">
                            {node.dateString}
                          </div>
                        )}
                      </div>
                    </div>
                  </ZoruTooltipTrigger>
                  
                  {/* Detailed tooltip */}
                  <ZoruTooltipContent className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)] p-3 rounded-lg shadow-lg w-[220px]">
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] font-bold">
                        {node.type} Record Details
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--st-text)]">
                        Num: {node.docNumber ?? 'Awaiting conversion'}
                      </div>
                      {node.valueString && (
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                          Amount: {node.valueString}
                        </div>
                      )}
                      <div className="text-[11px] text-[var(--st-text-tertiary)] flex items-center gap-1.5">
                        Status: <Badge variant={style.badge as any} className="text-[9px] px-1 py-0">{node.status}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--st-text-secondary)] pt-1.5 border-t border-[var(--st-border)]">
                        Click node card to preview record.
                      </div>
                    </div>
                  </ZoruTooltipContent>
                </Tooltip>

                {/* Arrow Connector */}
                {!isLast && (
                  <div className="flex items-center shrink-0 mx-1">
                    <ArrowRight className={`h-4.5 w-4.5 ${
                      node.status === 'completed' ? 'text-[var(--st-status-ok)] opacity-80' : 'text-[var(--st-border)]'
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
