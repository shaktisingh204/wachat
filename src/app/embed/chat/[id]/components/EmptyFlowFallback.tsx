'use client';

export function EmptyFlowFallback() {
  return (
    <div
      style={{
        padding: 24,
        fontSize: 13,
        color: '#475569',
        textAlign: 'center',
      }}
    >
      No flow connected to this widget yet.
    </div>
  );
}
