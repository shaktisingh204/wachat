// Lightweight logger for command runners — no NestJS dependency.

interface CommandLoggerOptions {
  verbose?: boolean;
  constructorName: string;
}

export const isCommandLogger = (
  logger: CommandLogger | Console,
): logger is CommandLogger => {
  return typeof (logger as CommandLogger).setVerbose === 'function';
};

export class CommandLogger {
  private readonly context: string;
  private verboseFlag: boolean;

  constructor(options: CommandLoggerOptions) {
    this.context = options.constructorName;
    this.verboseFlag = options.verbose ?? false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(message: string, ...optionalParams: any[]): void {
    console.log(`[${this.context}] ${message}`, ...optionalParams);
  }

  error(message: string, stack?: string, context?: string): void {
    console.error(
      `[${context ?? this.context}] ${message}`,
      ...(stack ? [stack] : []),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, ...optionalParams: any[]): void {
    console.warn(`[${this.context}] ${message}`, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, ...optionalParams: any[]): void {
    console.debug(`[${this.context}] ${message}`, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verbose(message: string, ...optionalParams: any[]): void {
    if (this.verboseFlag) {
      console.log(`[${this.context}] ${message}`, ...optionalParams);
    }
  }

  setVerbose(flag: boolean): void {
    this.verboseFlag = flag;
  }
}
