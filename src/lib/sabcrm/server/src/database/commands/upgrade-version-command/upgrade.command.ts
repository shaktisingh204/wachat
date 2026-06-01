import "server-only";

// PORT-NOTE: NestJS @Command (nest-commander) → plain TypeScript class.
// The @Command / @CommandRunner / @Option decorators are dropped.
// Business logic (sequencing, dry-run, workspace filtering) is preserved faithfully.

export type RawUpgradeCommandOptions = {
  workspaceId?: Set<string>;
  startFromWorkspaceId?: string;
  workspaceCountLimit?: number;
  dryRun?: boolean;
  verbose?: boolean;
};

export type ParsedUpgradeCommandOptions = {
  workspaceIds?: string[];
  startFromWorkspaceId?: string;
  workspaceCountLimit?: number;
  dryRun?: boolean;
  verbose?: boolean;
};

export type UpgradeStep = {
  kind: string;
  name: string;
  version: string;
};

export interface UpgradeSequenceReaderService {
  getUpgradeSequence(): UpgradeStep[];
}

export interface UpgradeSequenceRunnerService {
  run(args: {
    sequence: UpgradeStep[];
    options: ParsedUpgradeCommandOptions;
  }): Promise<{ totalSuccesses: number; totalFailures: number }>;
}

export interface CommandLogger {
  log(msg: string): void;
  verbose(msg: string): void;
  error(msg: string): void;
}

function formatUpgradeLog(args: {
  humanMessage: string;
  event: string;
  logFields?: Record<string, unknown>;
}): string {
  return `[${args.event}] ${args.humanMessage}${args.logFields ? ` ${JSON.stringify(args.logFields)}` : ""}`;
}

function isDefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined;
}

// ── Command ───────────────────────────────────────────────────────────────────

export class UpgradeCommand {
  protected logger: CommandLogger;

  constructor(
    protected readonly upgradeSequenceReaderService: UpgradeSequenceReaderService,
    protected readonly upgradeSequenceRunnerService: UpgradeSequenceRunnerService,
    logger?: CommandLogger,
  ) {
    this.logger = logger ?? {
      log: (msg) => console.log(msg),
      verbose: (msg) => console.debug(msg),
      error: (msg) => console.error(msg),
    };
  }

  // Parses a workspace ID string into a Set accumulator
  parseWorkspaceId(val: string, previous?: Set<string>): Set<string> {
    const accumulator = previous ?? new Set<string>();
    accumulator.add(val);
    return accumulator;
  }

  parseStartFromWorkspaceId(val: string): string {
    return val;
  }

  parseWorkspaceCountLimit(val: string): number {
    const limit = parseInt(val);
    if (isNaN(limit)) {
      throw new Error("Workspace count limit must be a number");
    }
    if (limit <= 0) {
      throw new Error("Workspace count limit must be greater than 0");
    }
    return limit;
  }

  async run(
    _passedParams: string[],
    options: RawUpgradeCommandOptions,
  ): Promise<void> {
    if (options.verbose) {
      const verboseLogger: CommandLogger = {
        log: (msg) => console.log(msg),
        verbose: (msg) => console.debug(msg),
        error: (msg) => console.error(msg),
      };
      this.logger = verboseLogger;
    }

    if (
      isDefined(options.workspaceId) &&
      isDefined(options.startFromWorkspaceId)
    ) {
      throw new Error(
        "Cannot use --start-from-workspace-id together with -w/--workspace-id",
      );
    }

    try {
      const sequence = this.upgradeSequenceReaderService.getUpgradeSequence();

      this.logger.log(
        formatUpgradeLog({
          humanMessage: `Initialized upgrade sequence: ${sequence.length} step(s)`,
          event: "sequence.initialized",
          logFields: {
            stepCount: sequence.length,
            dryRun: options.dryRun ?? false,
          },
        }),
      );

      for (const [index, step] of sequence.entries()) {
        this.logger.verbose(
          formatUpgradeLog({
            humanMessage: `  [${index}] ${step.kind} — ${step.name} (${step.version})`,
            event: "sequence.step",
            logFields: { index, kind: step.kind, name: step.name, version: step.version },
          }),
        );
      }

      const { totalSuccesses, totalFailures } =
        await this.upgradeSequenceRunnerService.run({
          sequence,
          options: {
            ...options,
            workspaceIds: isDefined(options.workspaceId)
              ? Array.from(options.workspaceId)
              : undefined,
          },
        });

      this.logger.log(
        formatUpgradeLog({
          humanMessage: `Upgrade summary: ${totalSuccesses} workspace(s) succeeded, ${totalFailures} workspace(s) failed`,
          event: "summary",
          logFields: {
            totalSuccesses,
            totalFailures,
            dryRun: options.dryRun ?? false,
          },
        }),
      );

      if (totalFailures > 0) {
        throw new Error(
          `Upgrade completed with ${totalFailures} workspace failure(s)`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        formatUpgradeLog({
          humanMessage: `Upgrade failed: ${errorMessage}`,
          event: "aborted",
        }),
      );
      throw error;
    }
  }
}
