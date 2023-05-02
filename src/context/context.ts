import { resolve } from 'path';
import { Logger, pino } from 'pino';
import { GetFieldType } from '../configuration/index.js';
import { BaseConfiguration } from './base-configuration.js';
import {
  TypedWorkspaceConfiguration,
  WorkspaceConfiguration,
  loadWorkspaceConfiguration,
} from './configuration.js';
import {
  ContextNotAProjectError,
  EnvironmentNotSetError,
} from './errors.js';
/**
 * Options when initializing or cloning a {@link WorkspaceContext}.
 */
export type WorkspaceContextOptions = {
  /**
   * The path to the working directory for the context.
   * This is the directory from which configurations will be looked for, then going up in the hierarchy.
   * Defaults to the current working directory (`process.cwd()`).
   */
  workingDirectory?: string;

  /**
   * The environment that should be set up in the context.
   */
  environment?: string | null;

  /**
   * The logger to use. Defaults to `pino()`.
   */
  logger?: Logger;
};

/**
 * A context specific to a workspace, containing its configuration and exposing available tooling for it.
 */
export class WorkspaceContext {
  /**
   * Creates a new {@link WorkspaceContext}.
   *
   * @param workingDirectory The reference directory for the functions to run, also used as the starting point of
   *   configuration loading.
   * @param environment The environment that was loaded for this context. May be `null` is none was specified.
   * @param rootPath The root directory of the entire workspace.
   * @param projectPath The root directory of the current project, usually the working directory or one of its parents.
   *   May be `null` if the working directory is outside of a project (but still part of a workspace).
   * @param configuration The {@link ConfigurationReader} exposing the configuration loaded from possibly several
   *   sources.
   * @param logger The logger that can be used when performing operations within the context.
   */
  private constructor(
    readonly workingDirectory: string,
    readonly environment: string | null,
    readonly rootPath: string,
    readonly projectPath: string | null,
    private readonly configuration: WorkspaceConfiguration,
    readonly logger: Logger,
  ) {
  }

  /**
   * Returns the {@link WorkspaceContext.projectPath} if it is not null, otherwise throws an error.
   *
   * @returns The disk path to the root of the current project for this context.
   */
  getProjectPathOrThrow(): string {
    const projectPath = this.projectPath;
    if (projectPath == null) {
      throw new ContextNotAProjectError(this.workingDirectory);
    }

    return projectPath;
  }

  /**
   * Returns the {@link WorkspaceContext.environment} if it is not null, otherwise throws an error.
   *
   * @returns The ID of the environment.
   */
  getEnvironmentOrThrow(): string {
    const environment = this.environment;
    if (environment == null) {
      throw new EnvironmentNotSetError();
    }

    return environment;
  }

  /**
   * Returns the value at a given path in the configuration.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value, or `undefined` if the path does not exist.
   */
  get<TPath extends string>(
    path: TPath,
  ): GetFieldType<BaseConfiguration, TPath> {
    return this.configuration.get(path);
  }

  /**
   * Returns the value at a given path in the configuration, or throws an error if the path does not exist.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value in the configuration.
   */
  getOrThrow<TPath extends string>(
    path: TPath,
  ): Exclude<GetFieldType<BaseConfiguration, TPath>, undefined> {
    return this.configuration.getOrThrow(path);
  }

  /**
   * Returns an object that can be used to get configuration values with project-specific types.
   * This is simply syntactic sugar for TypeScript, and does not actually enforce the configuration types.
   *
   * @returns The {@link TypedWorkspaceConfiguration}.
   */
  asConfiguration<C extends object>(): TypedWorkspaceConfiguration<C> {
    return this as any;
  }

  /**
   * Returns a new context configured identically to this one, unless specified by `options`.
   *
   * @param options Parameters to override when initializing the context.
   *   Options that are not specified will default to the values of the current context.
   * @returns The cloned {@link WorkspaceContext}.
   */
  async clone(
    options: WorkspaceContextOptions = {},
  ): Promise<WorkspaceContext> {
    return await WorkspaceContext.init({
      workingDirectory: this.workingDirectory,
      environment: this.environment,
      logger: this.logger,
      ...options,
    });
  }

  /**
   * Initializes a {@link WorkspaceContext}, loading the configuration starting from
   * {@link WorkspaceContextOptions.workingDirectory}.
   * Modules will be loaded according to the configuration found in the workspace.
   *
   * @param options Options when creating the {@link WorkspaceContext}.
   * @returns The created {@link WorkspaceContext}.
   */
  static async init(
    options: WorkspaceContextOptions = {},
  ): Promise<WorkspaceContext> {
    const workingDirectory = resolve(options.workingDirectory ?? process.cwd());
    const logger = options.logger ?? pino();
    const environment = options.environment ?? null;

    const { configuration, rootPath, projectPath } =
      await loadWorkspaceConfiguration(workingDirectory, environment, logger);

    let context = new WorkspaceContext(
      workingDirectory,
      environment,
      rootPath,
      projectPath,
      configuration,
      logger,
    );

    logger.debug(`🎉 Successfully initialized context.`);

    return context;
  }
}
