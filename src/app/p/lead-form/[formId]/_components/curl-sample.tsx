export function CurlSample({ formId, values }: { formId: string; values: Record<string, string> }) {
  return (
    <div className="mt-2 rounded-lg bg-zoru-surface-2/40 border border-zoru-line p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-zoru-ink-muted mb-1.5">// Curl representation</p>
      <pre className="text-[10.5px] font-mono text-zoru-ink whitespace-pre-wrap leading-tight bg-zoru-surface-2/80 p-2.5 rounded border border-zoru-line/50">
        {`curl -X POST https://api.sabnode.com/v1/leads/${formId.slice(0, 6)}/submit \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(values, null, 2).replace(/\n/g, '\n  ')}'`}
      </pre>
    </div>
  );
}
