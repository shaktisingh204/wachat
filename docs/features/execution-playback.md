# Execution Playback

> **Module:** SabFlow &middot; **Audience:** end users &middot; **Tier:** available on all plans (with limits — see [Plan-tier limits](#plan-tier-limits))

Execution Playback is SabFlow's "DVR for your automations." Every time a flow runs — manually, on a schedule, or via a webhook — SabFlow records what happened at each step: the inputs each node received, the output it produced, how long it took, and any error it raised. Playback turns that recording into an interactive, scrubbable timeline so you can rewind through a past run, step through it node-by-node, inspect what the data looked like at any point, and replay it from any failed step.

If you've used a browser's DevTools "time-travel" panel or watched a video frame-by-frame, you already know the mental model.

---

## What playback is good for

- **Debugging an error.** A scheduled flow failed at 2:47 AM — open the run, scrub to the red node, and read the exact input that triggered the error.
- **Understanding data shape.** Curious what your CRM webhook block returned last Tuesday? Pin it open and view the JSON.
- **Auditing a customer-facing flow.** Re-watch the run that sent a particular customer their welcome email, with timestamps, durations, and the data the AI block saw.
- **Comparing two runs.** Did yesterday's run skip a branch? Diff it against today's to see what changed.

---

## How to access playback

1. Open **SabFlow &rarr; Executions** from the main navigation (`/dashboard/sabflow/executions`).
2. Each row in the executions list represents one completed (or in-progress) run, with its status (success / error / running / cancelled), trigger type, start time, duration, and node count.
3. Click any row — or use the **View** action on the right — to open that run's **Replay** view (`/dashboard/sabflow/executions/<id>`).

> **Tip:** Use the filter chips at the top of the list (All / Success / Errored / Running / Cancelled) and the search box (flow name, session id, or execution id) to find a specific run quickly.

The first time you open a replay, an interactive tour highlights the major regions of the screen. You can rerun it any time from **Help &rarr; Replay tour** in the page header.

---

## The replay view, region by region

When you open a past execution, you'll see three main regions:

```
+---------------------------------------------------------------+
| Header: status pill, flow name, started-at, duration, "Open flow" |
+----------------+----------------------------------------------+
| Timeline rail  | Node detail pane                             |
| (left)         | (right)                                      |
|                |                                              |
|  node #1   OK  |  Block: HTTP Request                          |
|  node #2   OK  |  Status: success    Duration: 432ms           |
|  node #3  ERR  |  Input  { ... }                               |
|  ...           |  Output { ... }                               |
|                |  [Re-run from here]                            |
+----------------+----------------------------------------------+
| Scrub bar &middot; Transport controls &middot; Speed selector |
+---------------------------------------------------------------+
```

### Timeline rail (left)

A vertical list of every node that ran, in execution order. Each row shows the block type, the block id, a colored status icon (green = success, red = error, amber = waiting, grey = skipped or cancelled), and how long the node took. Click a row — or use **&uarr; / &darr;** on the keyboard — to jump to that node.

### Node detail pane (right)

When a node is selected, the right pane shows everything we recorded for that step:

- **Status &amp; duration** strip with the started-at time.
- **Error banner** (only on failed nodes) — the raw error message.
- **Input** — the JSON payload the node received from upstream.
- **Output** — the JSON payload it produced (or "no data" if the node was skipped).
- **Re-run from here** — replays the flow from this block forward, using the upstream outputs from the original run as pinned inputs. Useful for testing a fix without re-triggering the whole flow.

### Scrub bar &amp; transport (bottom)

This is the "DVR" strip. Each bar represents one node, and its width is proportional to that node's duration — so a 30-second LLM call visibly dominates a 5ms IF block. Click any bar to jump to that step.

Controls (left to right):

| Control | Keyboard | What it does                                       |
| ------- | -------- | -------------------------------------------------- |
| Rewind  | —        | Jump to step 1.                                    |
| Play    | `Space`  | Auto-advance through every node at the chosen rate.|
| Forward | —        | Jump to the last step.                             |
| Step    | `&uarr;` / `&darr;`, `j` / `k` | Move one node back / forward. |
| Speed   | —        | 0.5&times;, 1&times;, 2&times;, 4&times;, 8&times; — controls how fast Play advances. |

A counter (e.g. `7 / 24`) shows where you are in the timeline.

> **Live runs:** If the execution is still running when you open it, the timeline animates in real time via a Server-Sent Events stream — new nodes appear as they finish. Playback controls remain available, but Play will pause automatically when it catches up to the live edge.

---

## Time-travel debug

Playback is a read-only recording, but you can act on it:

1. **Step to the node you care about** (using the scrub bar or arrow keys).
2. **Inspect** its input, output, and configuration.
3. Click **Re-run from here** in the node detail pane. SabFlow forks a new execution that:
   - Pins every upstream node's output to its original value from the recording, so the flow doesn't re-call any external APIs you've already paid for.
   - Re-runs the selected block and everything downstream from scratch.
4. The new execution opens in a fresh tab, with its own timeline you can scrub.

This is the fastest way to validate a fix: tweak the block's config, click **Re-run from here**, and watch the new run.

> **Note:** Some nodes (webhook triggers, manual user input) cannot be re-run because their input data is intrinsic to the original trigger event. Those nodes still show their recorded input/output, but the **Re-run from here** button is disabled with a tooltip explaining why.

---

## Diff view

When you have two executions of the same flow open (typically one good run and one failed run), you can compare them side-by-side:

1. Open the failed execution.
2. Click the **Compare with...** menu in the header.
3. Pick another execution from the list of recent runs for the same flow.

The diff view aligns the two timelines node-by-node and highlights:

- **Branches taken differently** (e.g. an `IF` block that went true in run A but false in run B).
- **Outputs that changed shape** (extra/missing fields, different types).
- **Outputs whose value drifted** (the same key, different value).
- **Nodes that appeared in only one run** (e.g. one run skipped a sub-flow because a guard condition failed).

Click any diff row to expand a JSON-level patch showing exactly what changed. This is the fastest way to answer "what was different about the run that broke?"

---

## Export

Any execution can be exported for offline review, bug reports, or audit trails. From the replay view, open the **&middot;&middot;&middot;** menu in the top-right of the header and choose **Export**.

You can export:

- **JSON** — the full execution document (every node's input, output, status, timing) plus the flow definition snapshot at the time of the run. This is the canonical, lossless format and is what to attach when filing a support ticket.
- **HAR-like trace** — a chronological, network-style trace of every external HTTP call the flow made, suitable for opening in Chrome DevTools' Network panel.
- **CSV (summary)** — one row per node with id, type, status, started-at, duration, and error message. Good for spreadsheet analysis across many runs.

Exports respect workspace permissions: a user without the **`sabflow.executions.export`** capability will see the option disabled.

---

## Pinning

Pinning is how you mark a node's output as "this is what I want downstream nodes to use" while you iterate.

- Pinning happens in the **flow editor** (not the replay view), but it's deeply tied to playback because pins typically come *from* a past execution.
- From a replay's node detail pane, click **Pin this output** to copy that node's output into the flow editor as a pinned value.
- Pinned outputs persist across test runs — the flow editor will use them instead of re-calling the node — until you unpin them.
- Pinned outputs survive a `Clear all` in the editor and are saved with the flow definition, so other workspace members see the same pinned data when they open the flow.

> **Why this matters for playback:** the **Re-run from here** action automatically pins every upstream node's recorded output, which is why it's free, fast, and won't re-charge you for paid API calls.

---

## Plan-tier limits

| Capability                          | Free        | Starter     | Pro         | Business     |
| ----------------------------------- | ----------- | ----------- | ----------- | ------------ |
| Retention of execution recordings   | 7 days      | 30 days     | 90 days     | 365 days     |
| Per-run timeline node detail        | yes         | yes         | yes         | yes          |
| Live-streaming replay (SSE)         | yes         | yes         | yes         | yes          |
| Time-travel debug (Re-run from here)| yes         | yes         | yes         | yes          |
| Diff between two runs               | -           | yes         | yes         | yes          |
| Export (JSON / HAR / CSV)           | JSON only   | JSON, CSV   | all formats | all formats  |
| Concurrent live replays open        | 1           | 3           | 10          | 25           |
| Pinned outputs per flow             | 5           | 50          | unlimited   | unlimited    |

> **Retention** is the window during which a run's full node-by-node data is kept. Beyond the limit, the summary row (status, duration, node count) is retained for analytics, but the per-node input/output detail is deleted. The replay view will still open such runs, but the timeline rail will be empty with the message *"No per-node detail recorded for this execution."*

The exact numbers above match the platform's `DEFAULT_RETENTION_DAYS` config and are subject to change as plans evolve. If you need a longer retention window or higher concurrent-replay caps for compliance reasons, contact support — most can be raised on request.

---

## Keyboard reference

| Key                | Action                          |
| ------------------ | ------------------------------- |
| `&uarr;` / `k`     | Previous node                   |
| `&darr;` / `j`     | Next node                       |
| `Space`            | Play / pause                    |
| `Home`             | Jump to first node              |
| `End`              | Jump to last node               |
| `Esc`              | Back to executions list         |
| `?`                | Open keyboard cheat-sheet popover |

---

## Frequently asked

**Does a replay re-run the flow?**
No. Opening a replay just reads from the recording — no external services are called and no credits are consumed. Only the **Re-run from here** action triggers a new execution (and it pins upstream outputs so it stays cheap).

**Why is the timeline empty?**
Either the run is older than your plan's retention window (see [Plan-tier limits](#plan-tier-limits)), or verbose execution logging was disabled when the flow ran. You can enable it per-flow in **Flow settings &rarr; Logging**.

**Can I share a replay with a teammate?**
Yes — copy the URL from the address bar. Anyone with at least **`sabflow.executions.read`** in the workspace can open it. For sharing with someone outside the workspace, use **Export &rarr; JSON** and send them the file.

**Can I delete a recording?**
Yes — workspace admins can delete an execution from the row's overflow menu in the executions list, or in bulk via **SabFlow &rarr; Settings &rarr; Executions retention**. Deletion is immediate and permanent.

**My run says "running" but it's been hours. What's wrong?**
A run that's stuck in `running` for longer than your plan's max execution duration is automatically marked `cancelled` by the retention sweeper. Open the run — the last node before the stall shows what was happening when SabFlow lost contact.

---

## Related

- **Executions list** &mdash; `dashboard/sabflow/executions`
- **Re-run from failed** &mdash; rerun policy and credit behavior, see *Engine &rarr; Retry from failed*
- **Pinned data** &mdash; see *Flow editor &rarr; Pinning outputs*
- **Workspace RBAC** &mdash; capabilities `sabflow.executions.read`, `sabflow.executions.rerun`, `sabflow.executions.export`, `sabflow.executions.delete`
