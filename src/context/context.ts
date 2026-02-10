import { globby, type Options } from 'globby';
import { resolve } from 'path';
import { type Logger, pino } from 'pino';
import type {
  ConfigurationGetOptions,
  GetFieldType,
} from '../configuration/index.js';
import {
  FunctionRegistry,
  type ImplementableFunctionArguments,
  type ImplementableFunctionDefinitionConstructor,
  type ImplementableFunctionReturnType,
  NoImplementationFoundError,
} from '../function-registry/index.js';
import { ServiceCache } from '../service-cache/index.js';
import type { BaseConfiguration } from './base-configuration.js';
import {
  listProjectPaths,
  loadWorkspaceConfiguration,
  makeProcessorConfiguration,
  type TypedWorkspaceConfiguration,
  type WorkspaceConfiguration,
} from './configuration.js';
import {
  ContextNotAProjectError,
  EnvironmentNotSetError,
  InvalidProcessorOutputError,
  InvalidSecretDefinitionError,
  SecretBackendNotFoundError,
  SecretBackendNotSpecifiedError,
} from './errors.js';
import { WorkspaceFunction } from './functions.js';
import { loadModules } from './modules.js';
import {
  type ProcessorInstruction,
  type ProcessorResult,
} from './processor.js';
import { SecretFetch } from './secrets.js';
import type { WorkspaceServiceConstructor } from './services.js';

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
   * A list of {@link ProcessorInstruction}s to run when initializing the context.
   * Setting this to `null` explicitly removes processors when cloning a context.
   */
  processors?: ProcessorInstruction[] | null;

  /**
   * The logger to use. Defaults to `pino()`.
   */
  logger?: Logger;
};

/**
 * Options for {@link WorkspaceContext.getAndRender} and related methods.
 */
export type GetAndRenderOptions = {
  /**
   * Whether to render secrets in the output. If `false`, secrets will be replaced with an empty string.
   * Defaults to `true`.
   */
  readonly renderSecrets?: boolean;
};

/**
 * A context specific to a workspace, containing its configuration and exposing available tooling for it.
 */
export class WorkspaceContext {
  /**
   * The cache holding a reference to singleton instances of services.
   */
  private readonly serviceCache: ServiceCache<WorkspaceContext>;

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
   * @param functionRegistry The registry keeping a reference of all available implementations of
   *   {@link WorkspaceFunction}s.
   * @param processors The list of processors that have been run and applied when initializing the context.
   * @param logger The logger that can be used when performing operations within the context.
   */
  private constructor(
    readonly workingDirectory: string,
    readonly environment: string | null,
    readonly rootPath: string,
    readonly projectPath: string | null,
    private readonly configuration: WorkspaceConfiguration,
    private readonly functionRegistry: FunctionRegistry<WorkspaceContext>,
    readonly processors: ProcessorInstruction[],
    readonly logger: Logger,
  ) {
    this.serviceCache = new ServiceCache(this);
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
   * Lists the external files or directories belonging to the current project, based on the `project.externalFiles`
   * configuration.
   *
   * @param options Options to filter the results. By default, only files are returned.
   * @returns The list of external directories that are part of the project.
   */
  async getProjectExternalPaths(
    options: Pick<Options, 'onlyDirectories' | 'onlyFiles'> = {},
  ): Promise<string[]> {
    const externalFiles = this.get('project.externalFiles');
    if (!externalFiles || externalFiles.length === 0) {
      return [];
    }

    const externalPaths = await globby(externalFiles, {
      gitignore: true,
      cwd: this.rootPath,
      followSymbolicLinks: false,
      absolute: true,
      ...options,
    });

    this.logger.debug(
      `📂 Found external paths for the project in the configuration: ${externalPaths
        .map((p) => `'${p}'`)
        .join(', ')}.`,
    );

    return externalPaths;
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
   * Looks for Causa configuration files from the workspace root directory, and returns the list of directory paths that
   * contain a project
   *
   * @returns The list of paths.
   */
  async listProjectPaths(): Promise<string[]> {
    return await listProjectPaths(this.rootPath);
  }

  /**
   * Returns the entire configuration for the current context.
   *
   * @param options Optional options for the get operation.
   * @returns The configuration.
   */
  get(options?: ConfigurationGetOptions): BaseConfiguration;

  /**
   * Returns the value at a given path in the configuration.
   *
   * @param path The path to the value in the configuration object.
   * @param options Optional options for the get operation.
   * @returns The value, or `undefined` if the path does not exist.
   */
  get<TPath extends string>(
    path: TPath,
    options?: ConfigurationGetOptions,
  ): GetFieldType<BaseConfiguration, TPath>;

  get(
    pathOrOptions?: string | ConfigurationGetOptions,
    options?: ConfigurationGetOptions,
  ): any {
    return this.configuration.get(pathOrOptions as any, options);
  }

  /**
   * Returns the value at a given path in the configuration, or throws an error if the path does not exist.
   *
   * @param path The path to the value in the configuration object.
   * @param options Optional options for the get operation.
   * @returns The value in the configuration.
   */
  getOrThrow<TPath extends string>(
    path: TPath,
    options?: ConfigurationGetOptions,
  ): Exclude<GetFieldType<BaseConfiguration, TPath>, undefined> {
    return this.configuration.getOrThrow(path, options);
  }

  /**
   * Returns the entire configuration for the current context, after rendering all templates.
   *
   * @param options Options for rendering.
   * @returns The rendered configuration.
   */
  getAndRender(options?: GetAndRenderOptions): Promise<BaseConfiguration>;

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates.
   *
   * @param path The path to the value in the configuration object.
   * @param options Options for rendering.
   * @returns The value after rendering.
   */
  getAndRender<TPath extends string>(
    path: TPath,
    options?: GetAndRenderOptions,
  ): Promise<GetFieldType<BaseConfiguration, TPath>>;

  async getAndRender(
    pathOrOptions?: string | GetAndRenderOptions,
    options?: GetAndRenderOptions,
  ): Promise<any> {
    const path = typeof pathOrOptions === 'string' ? pathOrOptions : undefined;
    options ??= typeof pathOrOptions === 'object' ? pathOrOptions : {};
    const { renderSecrets = true } = options;

    return await this.configuration.getAndRender(
      { secret: async (id: string) => (renderSecrets ? this.secret(id) : '') },
      path as any,
    );
  }

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates. If the value does not exist in the configuration, this throws an error instead of returning `undefined`.
   *
   * @param path The path to the value in the configuration object.
   * @param options Options for rendering.
   * @returns The value after rendering.
   */
  async getAndRenderOrThrow<TPath extends string>(
    path: TPath,
    options: GetAndRenderOptions = {},
  ): Promise<Exclude<GetFieldType<BaseConfiguration, TPath>, undefined>> {
    const { renderSecrets = true } = options;

    return await this.configuration.getAndRenderOrThrow(
      { secret: async (id: string) => (renderSecrets ? this.secret(id) : '') },
      path,
    );
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
   * Looks up a function definition and calls the corresponding implementation, using this context.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param args Arguments to pass to the function.
   * @returns The result of the function call.
   */
  call<D extends WorkspaceFunction<any>>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): ImplementableFunctionReturnType<D> {
    return this.functionRegistry.call(definition, args, this);
  }

  /**
   * Looks up a function definition and calls all corresponding implementations that support this context, returning
   * the results as an array.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param args Arguments to pass to the function.
   * @returns The results of the function calls.
   */
  callAll<D extends WorkspaceFunction<any>>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): ImplementableFunctionReturnType<D>[] {
    return this.functionRegistry.callAll(definition, args, this);
  }

  /**
   * Looks up a function definition using its name (i.e. the name of the class / constructor), validates the passed
   * arguments, and calls the function implementation.
   * Unlike {@link WorkspaceContext.call}, arguments are fully validated using
   * {@link FunctionRegistry.validateArguments}, because calling a function by its name is more likely to occur in a
   * scenario where the function is not known at build time, and the arguments haven't even been statically checked.
   * The result is a promise even if the function is synchronous because validation of the arguments is asynchronous.
   *
   * @param definitionName The name of the {@link ImplementableFunctionDefinitionConstructor} to find.
   * @param args Arguments to pass to the function.
   * @returns The result of the function call.
   */
  async callByName<R = any>(
    definitionName: string,
    args: Record<string, any>,
  ): Promise<R> {
    const definition = await this.validateFunctionArguments(
      definitionName,
      args,
    );
    return this.call(definition, args);
  }

  /**
   * Validates a {@link WorkspaceFunction} arguments by calling {@link FunctionRegistry.validateArguments}.
   *
   * @param definition The constructor of the abstract class defining the function, or its name.
   * @param args The arguments to validate.
   * @returns The function definition.
   */
  async validateFunctionArguments<D extends WorkspaceFunction<any>>(
    definition: string | ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): Promise<ImplementableFunctionDefinitionConstructor<D>> {
    return await this.functionRegistry.validateArguments(definition, args);
  }

  /**
   * Returns the list of all known function definitions (for which at least one implementation exists).
   *
   * @returns The list of function definitions.
   */
  getFunctionDefinitions(): ImplementableFunctionDefinitionConstructor<
    WorkspaceFunction<any>
  >[] {
    return this.functionRegistry.getDefinitions();
  }

  /**
   * Finds the implementation of a given workspace function that supports this context.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param args Arguments to pass to the function.
   * @returns The implementation supporting execution in the current context.
   */
  getFunctionImplementation<D extends WorkspaceFunction<any>>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): D {
    return this.functionRegistry.getImplementation(definition, args, this);
  }

  /**
   * Finds the implementations of a given workspace function that supports this context.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param args Arguments to pass to the function.
   * @returns The implementations supporting execution in the current context.
   */
  getFunctionImplementations<D extends WorkspaceFunction<any>>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): D[] {
    return this.functionRegistry.getImplementations(definition, args, this);
  }

  /**
   * Fetches the given secret.
   *
   * @param secretId The ID of the secret.
   * @returns The fetched secret.
   */
  async secret(secretId: string): Promise<string> {
    this.logger.debug(`🔐 Accessing secret with ID '${secretId}'.`);
    const secret = this.getOrThrow(`secrets.${secretId}`);
    if (!secret || typeof secret !== 'object') {
      throw new InvalidSecretDefinitionError(`Expected an object.`, secretId);
    }

    const { backend, ...configuration } = {
      backend: this.get('causa.secrets.defaultBackend'),
      ...secret,
    };
    if (!backend) {
      throw new SecretBackendNotSpecifiedError(secretId);
    }

    try {
      return await this.call(SecretFetch, { backend, configuration });
    } catch (error) {
      if (error instanceof NoImplementationFoundError) {
        throw new SecretBackendNotFoundError(backend);
      }

      if (error instanceof InvalidSecretDefinitionError) {
        throw new InvalidSecretDefinitionError(error.message, secretId);
      }

      throw error;
    }
  }

  /**
   * Returns the singleton instance for the given service.
   *
   * @param constructor The constructor for the service.
   * @returns The singleton instance for the service.
   */
  service<T extends object>(constructor: WorkspaceServiceConstructor<T>) {
    return this.serviceCache.get(constructor);
  }

  /**
   * Returns a new context configured identically to this one, unless specified by `options`.
   *
   * @param options Parameters to override when initializing the context.
   *   Options that are not specified will default to the values of the current context.
   *   Processors are appended to the existing list of processors.
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
      processors:
        options.processors === null
          ? []
          : [...this.processors, ...(options.processors ?? [])],
    });
  }

  /**
   * Updates the context by running a processor and merging the returned configuration in the current one.
   * A processor is simply a {@link WorkspaceFunction} referenced by the name of its definition. It is called with the
   * passed arguments, which are first validated. The processor is expected to return a partial configuration, which
   * will be merged with the current one.
   * Although this method returns a copy of the {@link WorkspaceContext}, the original context **should no longer be
   * referenced**. To keep a copy of the context, use {@link WorkspaceContext.clone} instead.
   *
   * @param processor The {@link ProcessorInstruction} to run and apply.
   * @returns The {@link WorkspaceContext} with an updated configuration.
   */
  private async withProcessor(
    processor: ProcessorInstruction,
  ): Promise<WorkspaceContext> {
    const { name, args } = processor;
    this.logger.debug(`🔨 Running processor '${name}'.`);

    const output: ProcessorResult = await this.callByName(name, args ?? {});
    if (!(output.configuration instanceof Object)) {
      throw new InvalidProcessorOutputError(name);
    }

    const processorConfiguration = makeProcessorConfiguration(
      name,
      output.configuration,
    );

    return new WorkspaceContext(
      this.workingDirectory,
      this.environment,
      this.rootPath,
      this.projectPath,
      this.configuration.mergedWith(processorConfiguration),
      this.functionRegistry,
      [...this.processors, processor],
      this.logger,
    );
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

    const functionRegistry = new FunctionRegistry(WorkspaceFunction);

    await loadModules(configuration, functionRegistry, logger);

    let context = new WorkspaceContext(
      workingDirectory,
      environment,
      rootPath,
      projectPath,
      configuration,
      functionRegistry,
      [],
      logger,
    );

    for (const processor of options.processors ?? []) {
      context = await context.withProcessor(processor);
    }

    logger.debug(`🎉 Successfully initialized context.`);

    return context;
  }
}
