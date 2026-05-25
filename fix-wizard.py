import re

with open("src/app/sabsms/imports/wizard.tsx", "r") as f:
    content = f.read()

# 1. Add totalRows state
content = re.sub(
    r'(const \[submitting, setSubmitting\] = React\.useState\(false\);)',
    r'const [totalRows, setTotalRows] = React.useState<number>(0);\n  const [aiMappingLoading, setAiMappingLoading] = React.useState(false);\n  \1',
    content
)

# 2. Update fetching to use streaming and chunk logic
fetch_old = """  // Parse CSV when a SabFile is picked.
  React.useEffect(() => {
    if (!picked?.url) return;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    (async () => {
      try {
        const res = await fetch(picked.url);
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseCsv(text);
        setCsvText(text);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(inferColumnMapping(parsed.headers));
        setName(picked.name.replace(/\.csv$/i, ""));
        if (parsed.errors.length > 0) {
          setParseError(
            `Parsed with ${parsed.errors.length} warning${parsed.errors.length === 1 ? "" : "s"}.`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setParseError(
            err instanceof Error ? err.message : "Failed to read CSV file.",
          );
        }
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked]);"""

fetch_new = """  // Parse CSV when a SabFile is picked (Chunked to prevent timeout on large files).
  React.useEffect(() => {
    if (!picked?.url) return;
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    (async () => {
      try {
        const res = await fetch(picked.url);
        if (!res.body) throw new Error("No response body.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = "";
        let lineCount = 0;
        let gotPreview = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!gotPreview) {
            firstChunk += chunk;
            if (firstChunk.length > 50000 || firstChunk.split("\\n").length > 50) {
              gotPreview = true;
              const lines = firstChunk.split("\\n");
              firstChunk = lines.slice(0, 50).join("\\n");
            }
          }
          for (let i = 0; i < chunk.length; i++) {
            if (chunk[i] === '\\n') lineCount++;
          }
        }
        if (cancelled) return;

        setTotalRows(Math.max(lineCount - 1, 0));
        const parsed = parseCsv(firstChunk);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(inferColumnMapping(parsed.headers));
        setName(picked.name.replace(/\.csv$/i, ""));
        if (parsed.errors.length > 0) {
          setParseError(`Preview parsed with warnings.`);
        }
      } catch (err) {
        if (!cancelled) setParseError(err instanceof Error ? err.message : "Failed to read CSV file.");
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => cancelled = true;
  }, [picked]);

  // AI-powered mapping
  const handleAiMapping = React.useCallback(async () => {
    if (headers.length === 0 || rows.length === 0) return;
    setAiMappingLoading(true);
    try {
      const res = await fetch("/api/sabsms/imports/ai-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, sampleRows: rows.slice(0, 3) })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mapping) {
          setMapping(data.mapping);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiMappingLoading(false);
    }
  }, [headers, rows]);"""

content = content.replace(fetch_old, fetch_new)

# 3. Use totalRows for rowsCount and pass it to UploadStep and ConfirmStep
content = re.sub(r'rowsCount={rows\.length}', r'rowsCount={totalRows}', content)
content = re.sub(r'totalRows={rows\.length}', r'totalRows={totalRows}', content)

# 4. Modify MappingStep props to include aiMappingLoading and onAiMapping
content = re.sub(
    r'onLoadTemplate={loadTemplate}\n\s*/>',
    r'onLoadTemplate={loadTemplate}\n              aiMappingLoading={aiMappingLoading}\n              onAiMapping={handleAiMapping}\n            />',
    content
)

# 5. Modify MappingStep definition
mapping_step_old = """function MappingStep({
  headers,
  mapping,
  templates,
  templateName,
  onMappingChange,
  onTemplateNameChange,
  onSaveTemplate,
  onLoadTemplate,
}: {"""

mapping_step_new = """function MappingStep({
  headers,
  mapping,
  templates,
  templateName,
  onMappingChange,
  onTemplateNameChange,
  onSaveTemplate,
  onLoadTemplate,
  aiMappingLoading,
  onAiMapping,
}: {
  aiMappingLoading?: boolean;
  onAiMapping?: () => void;"""

content = content.replace(mapping_step_old, mapping_step_new)

# 6. Add AI Automap button to MappingStep UI
mapping_p_old = """      <p className="text-sm text-slate-600">
        Match each contact field to a column in your CSV. We've auto-detected
        the most likely matches — adjust as needed.
      </p>"""

mapping_p_new = """      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-600 max-w-xl">
          Match each contact field to a column in your CSV. We've auto-detected
          the most likely matches — adjust as needed.
        </p>
        <Button variant="outline" size="sm" onClick={onAiMapping} disabled={aiMappingLoading}>
          {aiMappingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          AI Automap
        </Button>
      </div>"""

content = content.replace(mapping_p_old, mapping_p_new)

# 7. handleSubmit validCount logic uses totalRows correctly. Wait, it already uses totalRows.
content = re.sub(
    r'totalRows: rows\.length,',
    r'totalRows: totalRows,',
    content
)

content = re.sub(
    r'const validCount = rows\.length - invalidCount - duplicates\.length;',
    r'const validCount = Math.max(totalRows - invalidCount - duplicates.length, 0);',
    content
)


with open("src/app/sabsms/imports/wizard.tsx", "w") as f:
    f.write(content)

