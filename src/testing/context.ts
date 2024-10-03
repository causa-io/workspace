import { resolve } from 'path';
import { type Logger, pino } from 'pino';
import {
  ConfigurationReader,
  ConfigurationReaderSourceType,
} from '../configuration/index.js';
import {
  type BaseConfiguration,
  type ProcessorInstruction,
  WorkspaceContext,
  WorkspaceFunction,
} from '../context/index.js';
import {
  FunctionRegistry,
  type ImplementableFunctionImplementationConstructor,
} from '../function-registry/index.js';

/**
 * A {@link WorkspaceContext}, along with its private components, useful for tests.
 */
export type TestWorkspaceContext = {
  /**
   * The {@link WorkspaceContext}.
   */
  context: WorkspaceContext;

  /**
   * The {@link ConfigurationReader} used by the context.
   */
  configuration: ConfigurationReader<BaseConfiguration>;

  /**
   * The {@link FunctionRegistry} used by the context.
   */
  functionRegistry: FunctionRegistry<WorkspaceContext>;
};

/**
 * Creates a {@link WorkspaceContext} without loading the configuration nor the modules.
 * A configuration object (or a {@link ConfigurationReader}) can be passed instead, and functions can be registered
 * either using the `functions` options, or the returned {@link FunctionRegistry}.
 *
 * @param options Options when creating the {@link WorkspaceContext}.
 * @returns The {@link WorkspaceContext}.
 */
export function createContext(
  options: {
    /**
     * The working directory for the context. Defaults to the process current directory.
     * This is **not** used to load the configuration.
     */
    workingDirectory?: string;

    /**
     * The environment for the context.
     * This is **not** used to update the configuration.
     */
    environment?: string | null;

    /**
     * The root path for the context. Defaults to the `workingDirectory`.
     * This is **not** inferred from the configuration.
     */
    rootPath?: string;

    /**
     * The project path for the context. Defaults to the `workingDirectory`.
     * This is **not** inferred from the configuration.
     */
    projectPath?: string | null;

    /**
     * The configuration for the context. Defaults to a configuration where only `workspace.name` is set to `test`.
     * If a plain object is passed, it is loaded as a (fake) configuration file.
     */
    configuration?:
      | ConfigurationReader<BaseConfiguration>
      | (Partial<BaseConfiguration> & Record<string, any>);

    /**
     * The logger for the context.
     */
    logger?: Logger;

    /**
     * A list of function implementations that will be registered.
     */
    functions?: ImplementableFunctionImplementationConstructor<
      WorkspaceFunction<any>
    >[];
  } = {},
): TestWorkspaceContext {
  const workingDirectory = resolve(options.workingDirectory ?? process.cwd());
  const environment =
    options.environment !== undefined ? options.environment : null;
  const rootPath = resolve(options.rootPath ?? workingDirectory);
  const projectPath =
    options.projectPath !== undefined ? options.projectPath : workingDirectory;

  const configuration =
    options.configuration instanceof ConfigurationReader
      ? options.configuration
      : new ConfigurationReader<BaseConfiguration>([
          {
            configuration: options.configuration ?? {
              workspace: { name: 'test' },
            },
            source: 'causa.yaml',
            sourceType: ConfigurationReaderSourceType.File,
          },
        ]);

  const functionRegistry = new FunctionRegistry(WorkspaceFunction);
  functionRegistry.registerImplementations(...(options.functions ?? []));

  const processors: ProcessorInstruction[] = [];

  const logger = options.logger ?? pino();

  const context = new (WorkspaceContext as any)(
    workingDirectory,
    environment,
    rootPath,
    projectPath,
    configuration,
    functionRegistry,
    processors,
    logger,
  );

  return { context, configuration, functionRegistry };
}
