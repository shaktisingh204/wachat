export function CurlSample({ formId, values }: { formId: string; values: Record<string, string> }) {
  return (
    <div className="mt-2 rounded-lg bg-secondary/40 border border-border p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">// Curl representation</p>
      <pre className="text-[10.5px] font-mono text-foreground whitespace-pre-wrap leading-tight bg-secondary/80 p-2.5 rounded border border-border/50">
        {`curl -X POST https://api.sabnode.com/v1/leads/${formId.slice(0, 6)}/submit \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(values, null, 2).replace(/\n/g, '\n  ')}'`}
      </pre>
    </div>
  );
}
