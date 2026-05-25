import re

with open("src/app/sabsms/imports/imports-table.tsx", "r") as f:
    content = f.read()

# Add SSE logic to ImportsTable
effect_code = """
  React.useEffect(() => {
    setImports(initialImports);
  }, [initialImports]);

  React.useEffect(() => {
    const activeImports = imports.filter(i => i.status === "queued" || i.status === "running");
    if (activeImports.length === 0) return;

    const eventSources: EventSource[] = [];

    for (const record of activeImports) {
      if (record.status === "queued") {
        // Trigger processing
        const es = new EventSource(`/api/sabsms/imports/process?id=${record.id}`);
        
        es.onmessage = (e) => {
          // generic message? we are listening to specific events
        };
        
        es.addEventListener("progress", (e) => {
          const data = JSON.parse(e.data);
          setImports(prev => prev.map(imp => {
            if (imp.id === record.id) {
              return { ...imp, status: "running", counts: { ...imp.counts, imported: data.processed } };
            }
            return imp;
          }));
        });

        es.addEventListener("status", (e) => {
          const data = JSON.parse(e.data);
          setImports(prev => prev.map(imp => {
            if (imp.id === record.id) {
              return { ...imp, status: data.status };
            }
            return imp;
          }));
        });
        
        es.addEventListener("completed", (e) => {
          const data = JSON.parse(e.data);
          setImports(prev => prev.map(imp => {
            if (imp.id === record.id) {
              return { ...imp, status: "completed", counts: { ...imp.counts, imported: data.processed } };
            }
            return imp;
          }));
          es.close();
          handleRefresh();
        });

        es.addEventListener("error", (e) => {
          console.error("SSE error", e);
          es.close();
        });
        
        eventSources.push(es);
      }
    }

    return () => {
      for (const es of eventSources) es.close();
    };
  }, [imports.map(i => i.status).join(",")]); // Only re-run when statuses change
"""

content = re.sub(
    r'React\.useEffect\(\(\) => \{\n\s*setImports\(initialImports\);\n\s*\}, \[initialImports\]\);',
    effect_code,
    content
)

with open("src/app/sabsms/imports/imports-table.tsx", "w") as f:
    f.write(content)

