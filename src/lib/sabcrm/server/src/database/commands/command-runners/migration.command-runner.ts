import chalk from 'chalk';

import {
  CommandLogger,
} from '@/lib/sabcrm/server/src/database/commands/logger';

export type MigrationCommandOptions = {
  dryRun?: boolean;
  verbose?: boolean;
};

/**
 * Abstract base class for migration commands.
 * Subclass and implement `runMigrationCommand`. Call `run()` to execute.
 *
 * PORT-NOTE: nest-commander's CommandRunner base class and @Option decorators
 * are removed. Concrete subclasses should expose a `run(params, options)`
 * function directly instead of extending nest-commander.
 */
export abstract class MigrationCommandRunner {
  protected logger: CommandLogger;

  constructor() {
    this.logger = new CommandLogger({
      verbose: false,
      constructorName: this.constructor.name,
    });
  }

  async run(
    passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void> {
    if (options.verbose) {
      this.logger = new CommandLogger({
        verbose: true,
        constructorName: this.constructor.name,
      });
    }

    try {
      await this.runMigrationCommand(passedParams, options);
      this.logger.log(chalk.blue('Command completed!'));
    } catch (error) {
      this.logger.error(chalk.red('Command failed'));
      throw error;
    }
  }

  protected abstract runMigrationCommand(
    passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void>;
}
