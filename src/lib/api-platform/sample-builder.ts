/**
 * In-`src/` code-sample builder used by the per-endpoint docs pages.
 *
 * Lives under `src/lib/api-platform/` so the docs pages can import it
 * without crossing into `tools/` (Turbopack production builds don't
 * include `tools/` in the bundle).
 *
 * Operates on the minimal endpoint shape that ships in
 * `src/app/api/docs/_data/catalog.json` — no `EndpointSpec` / manifest
 * dependency. The shape and the language roster are kept in lock-step
 * with `tools/api-codegen/code-samples.ts`; that copy is the canonical
 * one used by the OpenAPI generator at build time, this copy is the
 * one used by the in-app docs at request time.
 */

export interface EndpointSummary {
  module: string;
  method: string;
  path: string;
  verb?: string;
  resource?: string;
  hasBody: boolean;
  idempotent: boolean;
  pathParams: Array<{ name: string; type: string; description?: string }>;
  queryParams: Array<{ name: string; type: string; required?: boolean; description?: string }>;
}

export interface CodeSample {
  lang: string;
  highlight: string;
  source: string;
}

const BASE = 'https://api.sabnode.com/api/v1';
const KEY_ENV = 'SABNODE_API_KEY';

function hasBody(spec: EndpointSummary): boolean {
  return spec.hasBody && ['POST', 'PATCH', 'PUT'].includes(spec.method);
}

function methodIdent(spec: EndpointSummary): string {
  const seg = [spec.module, spec.verb ?? 'call', spec.resource ?? spec.path.replace(/[^a-z0-9]+/gi, '_')];
  return seg
    .join('_')
    .replace(/[-_/]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function placeholderBody(): string {
  return '{}';
}

/* ── cURL ──────────────────────────────────────────────────────────────── */

export function curlSample(spec: EndpointSummary): CodeSample {
  const headers = [
    `-H "Authorization: Bearer $${KEY_ENV}"`,
    hasBody(spec) ? `-H "Content-Type: application/json"` : null,
    spec.idempotent ? `-H "Idempotency-Key: $(uuidgen)"` : null,
  ]
    .filter(Boolean)
    .join(' \\\n  ');
  const body = hasBody(spec) ? ` \\\n  -d '${placeholderBody()}'` : '';
  return {
    lang: 'cURL',
    highlight: 'bash',
    source: `curl -X ${spec.method} "${BASE}${spec.path}" \\\n  ${headers}${body}`,
  };
}

/* ── HTTP / .http file ─────────────────────────────────────────────────── */

function httpSample(spec: EndpointSummary): CodeSample {
  const lines = [`${spec.method} ${BASE}${spec.path}`, `Authorization: Bearer {{${KEY_ENV}}}`];
  if (hasBody(spec)) {
    lines.push('Content-Type: application/json', '', placeholderBody());
  }
  return { lang: 'HTTP', highlight: 'http', source: lines.join('\n') };
}

/* ── JavaScript (fetch) ────────────────────────────────────────────────── */

function jsSample(spec: EndpointSummary): CodeSample {
  const init = [
    `method: '${spec.method}'`,
    `headers: {
    Authorization: \`Bearer \${process.env.${KEY_ENV}}\`,${
      hasBody(spec)
        ? `
    'Content-Type': 'application/json',`
        : ''
    }
  }`,
  ];
  if (hasBody(spec)) init.push(`body: JSON.stringify(${placeholderBody()})`);
  return {
    lang: 'JavaScript',
    highlight: 'javascript',
    source: [
      `const res = await fetch('${BASE}${spec.path}', {`,
      `  ${init.join(',\n  ')},`,
      `});`,
      `const data = await res.json();`,
      `console.log(data);`,
    ].join('\n'),
  };
}

/* ── TypeScript SDK ────────────────────────────────────────────────────── */

function tsSdkSample(spec: EndpointSummary): CodeSample {
  const fn = methodIdent(spec);
  const args: string[] = [];
  for (const p of spec.pathParams) args.push(`${p.name}: 'xxx'`);
  for (const q of spec.queryParams) args.push(`${q.name}: 'xxx'`);
  if (hasBody(spec)) args.push('body: { /* ... */ }');
  const argLine = args.length ? `{ ${args.join(', ')} }` : '';
  return {
    lang: 'TypeScript SDK',
    highlight: 'typescript',
    source: [
      `import { SabnodeClient } from '@sabnode/sdk';`,
      ``,
      `const sn = new SabnodeClient({ apiKey: process.env.${KEY_ENV}! });`,
      `const res = await sn.${fn}(${argLine});`,
      `console.log(res.data);`,
    ].join('\n'),
  };
}

/* ── Python (requests) ─────────────────────────────────────────────────── */

function pythonRequestsSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'import os, requests',
    '',
    `r = requests.${spec.method.toLowerCase()}(`,
    `    "${BASE}${spec.path}",`,
    `    headers={"Authorization": f"Bearer {os.environ['${KEY_ENV}']}"}${hasBody(spec) ? ',' : ''}`,
  ];
  if (hasBody(spec)) lines.push('    json={},');
  lines.push(')', 'r.raise_for_status()', 'print(r.json())');
  return { lang: 'Python', highlight: 'python', source: lines.join('\n') };
}

/* ── Python (httpx async) ──────────────────────────────────────────────── */

function pythonHttpxSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'import os, httpx, asyncio',
    '',
    'async def main():',
    '    async with httpx.AsyncClient() as client:',
    `        r = await client.${spec.method.toLowerCase()}(`,
    `            "${BASE}${spec.path}",`,
    `            headers={"Authorization": f"Bearer {os.environ['${KEY_ENV}']}"}${hasBody(spec) ? ',' : ''}`,
  ];
  if (hasBody(spec)) lines.push('            json={},');
  lines.push(
    '        )',
    '        r.raise_for_status()',
    '        print(r.json())',
    '',
    'asyncio.run(main())',
  );
  return { lang: 'Python (async)', highlight: 'python', source: lines.join('\n') };
}

/* ── Go ────────────────────────────────────────────────────────────────── */

function goSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'package main',
    '',
    'import (',
    '    "bytes"',
    '    "fmt"',
    '    "io"',
    '    "net/http"',
    '    "os"',
    ')',
    '',
    'func main() {',
  ];
  if (hasBody(spec)) {
    lines.push('    body := bytes.NewBufferString(`{}`)');
    lines.push(`    req, _ := http.NewRequest("${spec.method}", "${BASE}${spec.path}", body)`);
    lines.push('    req.Header.Set("Content-Type", "application/json")');
  } else {
    lines.push(`    req, _ := http.NewRequest("${spec.method}", "${BASE}${spec.path}", nil)`);
  }
  lines.push(
    `    req.Header.Set("Authorization", "Bearer " + os.Getenv("${KEY_ENV}"))`,
    '    resp, err := http.DefaultClient.Do(req)',
    '    if err != nil { panic(err) }',
    '    defer resp.Body.Close()',
    '    out, _ := io.ReadAll(resp.Body)',
    '    fmt.Println(string(out))',
    '}',
  );
  return { lang: 'Go', highlight: 'go', source: lines.join('\n') };
}

/* ── Ruby ──────────────────────────────────────────────────────────────── */

function rubySample(spec: EndpointSummary): CodeSample {
  const verb = {
    GET: 'Net::HTTP::Get',
    POST: 'Net::HTTP::Post',
    PATCH: 'Net::HTTP::Patch',
    PUT: 'Net::HTTP::Put',
    DELETE: 'Net::HTTP::Delete',
  }[spec.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'];
  const lines = [
    "require 'net/http'",
    "require 'json'",
    "require 'uri'",
    '',
    `uri = URI('${BASE}${spec.path}')`,
    `req = ${verb}.new(uri)`,
    `req['Authorization'] = "Bearer #{ENV['${KEY_ENV}']}"`,
  ];
  if (hasBody(spec)) {
    lines.push(`req['Content-Type'] = 'application/json'`);
    lines.push('req.body = {}.to_json');
  }
  lines.push(
    'res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }',
    'puts res.body',
  );
  return { lang: 'Ruby', highlight: 'ruby', source: lines.join('\n') };
}

/* ── PHP ───────────────────────────────────────────────────────────────── */

function phpSample(spec: EndpointSummary): CodeSample {
  const headers = [
    `    'Authorization: Bearer ' . getenv('${KEY_ENV}'),`,
    hasBody(spec) ? `    'Content-Type: application/json',` : null,
  ].filter(Boolean);
  const lines = [
    '<?php',
    `$ch = curl_init('${BASE}${spec.path}');`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${spec.method}');`,
    'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
    ...(headers as string[]),
    ']);',
  ];
  if (hasBody(spec)) lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));');
  lines.push('$response = curl_exec($ch);', 'curl_close($ch);', 'echo $response;');
  return { lang: 'PHP', highlight: 'php', source: lines.join('\n') };
}

/* ── Java ──────────────────────────────────────────────────────────────── */

function javaSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Example {',
    '    public static void main(String[] args) throws Exception {',
    '        var client = HttpClient.newHttpClient();',
    '        var req = HttpRequest.newBuilder()',
    `            .uri(URI.create("${BASE}${spec.path}"))`,
    `            .header("Authorization", "Bearer " + System.getenv("${KEY_ENV}"))`,
  ];
  if (hasBody(spec)) {
    lines.push('            .header("Content-Type", "application/json")');
    lines.push(`            .method("${spec.method}", HttpRequest.BodyPublishers.ofString("{}"))`);
  } else {
    lines.push(`            .method("${spec.method}", HttpRequest.BodyPublishers.noBody())`);
  }
  lines.push(
    '            .build();',
    '        var resp = client.send(req, HttpResponse.BodyHandlers.ofString());',
    '        System.out.println(resp.body());',
    '    }',
    '}',
  );
  return { lang: 'Java', highlight: 'java', source: lines.join('\n') };
}

/* ── C# ────────────────────────────────────────────────────────────────── */

function csharpSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'using System.Net.Http;',
    'using System.Net.Http.Headers;',
    'using System.Text;',
    'using System.Threading.Tasks;',
    '',
    'var http = new HttpClient();',
    `var req = new HttpRequestMessage(HttpMethod.${
      { GET: 'Get', POST: 'Post', PATCH: 'Patch', PUT: 'Put', DELETE: 'Delete' }[
        spec.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
      ]
    }, "${BASE}${spec.path}");`,
    `req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("${KEY_ENV}"));`,
  ];
  if (hasBody(spec)) {
    lines.push('req.Content = new StringContent("{}", Encoding.UTF8, "application/json");');
  }
  lines.push(
    'var resp = await http.SendAsync(req);',
    'Console.WriteLine(await resp.Content.ReadAsStringAsync());',
  );
  return { lang: 'C#', highlight: 'csharp', source: lines.join('\n') };
}

/* ── Rust ──────────────────────────────────────────────────────────────── */

function rustSample(spec: EndpointSummary): CodeSample {
  const lines = [
    '// Cargo.toml: reqwest = { version = "0.12", features = ["json"] }, tokio = { version = "1", features = ["macros", "rt-multi-thread"] }',
    'use std::env;',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::Client::new();',
    `    let req = client.${spec.method.toLowerCase()}("${BASE}${spec.path}")`,
    `        .bearer_auth(env::var("${KEY_ENV}")?)`,
  ];
  if (hasBody(spec)) lines.push('        .json(&serde_json::json!({}))');
  lines.push(
    '        .send().await?;',
    '    println!("{}", req.text().await?);',
    '    Ok(())',
    '}',
  );
  return { lang: 'Rust', highlight: 'rust', source: lines.join('\n') };
}

/* ── Elixir ────────────────────────────────────────────────────────────── */

function elixirSample(spec: EndpointSummary): CodeSample {
  const headers = [`{"Authorization", "Bearer #{System.get_env(\"${KEY_ENV}\")}"}`];
  if (hasBody(spec)) headers.push(`{"Content-Type", "application/json"}`);
  const lines = ['headers = [', '  ' + headers.join(',\n  '), ']', ''];
  if (hasBody(spec)) {
    lines.push('body = Jason.encode!(%{})');
    lines.push(
      `{:ok, resp} = HTTPoison.request(:${spec.method.toLowerCase()}, "${BASE}${spec.path}", body, headers)`,
    );
  } else {
    lines.push(`{:ok, resp} = HTTPoison.${spec.method.toLowerCase()}("${BASE}${spec.path}", headers)`);
  }
  lines.push('IO.puts(resp.body)');
  return { lang: 'Elixir', highlight: 'elixir', source: lines.join('\n') };
}

/* ── Swift ─────────────────────────────────────────────────────────────── */

function swiftSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'import Foundation',
    '',
    `var req = URLRequest(url: URL(string: "${BASE}${spec.path}")!)`,
    `req.httpMethod = "${spec.method}"`,
    `req.addValue("Bearer \\(ProcessInfo.processInfo.environment["${KEY_ENV}"] ?? "")", forHTTPHeaderField: "Authorization")`,
  ];
  if (hasBody(spec)) {
    lines.push('req.addValue("application/json", forHTTPHeaderField: "Content-Type")');
    lines.push('req.httpBody = "{}".data(using: .utf8)');
  }
  lines.push(
    'let (data, _) = try await URLSession.shared.data(for: req)',
    'print(String(data: data, encoding: .utf8) ?? "")',
  );
  return { lang: 'Swift', highlight: 'swift', source: lines.join('\n') };
}

/* ── Kotlin ────────────────────────────────────────────────────────────── */

function kotlinSample(spec: EndpointSummary): CodeSample {
  const lines = [
    'import okhttp3.*',
    '',
    'val client = OkHttpClient()',
    'val builder = Request.Builder()',
    `    .url("${BASE}${spec.path}")`,
    `    .addHeader("Authorization", "Bearer \${System.getenv("${KEY_ENV}")}")`,
  ];
  if (hasBody(spec)) {
    lines.push('val body = "{}".toRequestBody("application/json".toMediaType())');
    lines.push(`builder.method("${spec.method}", body)`);
  } else if (spec.method !== 'GET') {
    lines.push(`builder.method("${spec.method}", null)`);
  }
  lines.push(
    'client.newCall(builder.build()).execute().use { resp -> println(resp.body?.string()) }',
  );
  return { lang: 'Kotlin', highlight: 'kotlin', source: lines.join('\n') };
}

/* ── Public roster ─────────────────────────────────────────────────────── */

const BUILDERS: ReadonlyArray<(spec: EndpointSummary) => CodeSample> = [
  curlSample,
  httpSample,
  jsSample,
  tsSdkSample,
  pythonRequestsSample,
  pythonHttpxSample,
  goSample,
  rubySample,
  phpSample,
  javaSample,
  csharpSample,
  rustSample,
  elixirSample,
  swiftSample,
  kotlinSample,
];

export function buildSamples(spec: EndpointSummary): CodeSample[] {
  return BUILDERS.map((fn) => fn(spec));
}
