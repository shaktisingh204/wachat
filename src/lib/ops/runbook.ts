/**
 * Runbook registry + replay logger.
 *
 * A runbook is a structured sequence of steps that an on-call engineer can
 * execute (or replay) when responding to an alert. Each step has a name,
 * description, optional command snippet, and an `automated` flag indicating
 * whether the step can be safely run by automation.
 *
 * The replay logger captures the actual outcome of each step so the on-call
 * can prove (during postmortem) what was done, when, and what came back.
 */

export interface RunbookStep {
    id: string;
    title: string;
    description?: string;
    /** Shell / SQL / API snippet — free-form. */
    command?: string;
    /** When true the step is safe to run as automation. */
    automated?: boolean;
    /** Estimated duration in seconds, used to render runbooks nicely. */
    estimatedSec?: number;
}

export interface Runbook {
    id: string;
    title: string;
    description?: string;
    /** Tags for discovery — e.g. ["database", "queue", "high-priority"]. */
    tags?: string[];
    owner?: string;
    steps: RunbookStep[];
}

/** Single replay record — created when a step is executed (manually or automatically). */
export interface RunbookReplayEntry {
    runbookId: string;
    stepId: string;
    startedAt: number;
    finishedAt: number;
    actor?: string;
    success: boolean;
    output?: string;
    error?: string;
}

/** In-memory runbook registry. Swap for a persistent store as needed. */
export class RunbookRegistry {
    private readonly runbooks = new Map<string, Runbook>();

    register(runbook: Runbook): void {
        if (this.runbooks.has(runbook.id)) {
            throw new Error(`runbook ${runbook.id} already registered`);
        }
        // Validate step ids are unique within the runbook.
        const seen = new Set<string>();
        for (const step of runbook.steps) {
            if (seen.has(step.id)) {
                throw new Error(`runbook ${runbook.id} has duplicate step id: ${step.id}`);
            }
            seen.add(step.id);
        }
        this.runbooks.set(runbook.id, runbook);
    }

    get(id: string): Runbook | undefined {
        return this.runbooks.get(id);
    }

    list(tag?: string): Runbook[] {
        const all = [...this.runbooks.values()];
        return tag ? all.filter((r) => r.tags?.includes(tag)) : all;
    }

    /** Replace an existing runbook (or insert if missing). */
    upsert(runbook: Runbook): void {
        this.runbooks.delete(runbook.id);
        this.register(runbook);
    }

    /** Remove a runbook by id; returns whether anything was removed. */
    remove(id: string): boolean {
        return this.runbooks.delete(id);
    }
}

/** Append-only replay log. */
export class RunbookReplayLog {
    private readonly entries: RunbookReplayEntry[] = [];

    record(entry: RunbookReplayEntry): void {
        this.entries.push(entry);
    }

    /** Read all entries (defensive copy). */
    all(): RunbookReplayEntry[] {
        return [...this.entries];
    }

    /** Read the entries for a specific runbook. */
    forRunbook(runbookId: string): RunbookReplayEntry[] {
        return this.entries.filter((e) => e.runbookId === runbookId);
    }

    clear(): void {
        this.entries.length = 0;
    }
}

/** Default singleton instances — handy in long-running workers. */
export const defaultRunbookRegistry = new RunbookRegistry();
export const defaultRunbookReplayLog = new RunbookReplayLog();
