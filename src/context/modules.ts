import { ClassConstructor } from 'class-transformer';
import { resolve } from 'path';
import { Logger } from 'pino';
import { FunctionRegistry } from '../function-registry/index.js';
import { WorkspaceConfiguration } from './configuration.js';
import { WorkspaceContext } from './context.js';
import { ModuleNotFoundError } from './errors.js';
import { WorkspaceFunction } from './functions.js';

/**
 * The context passed to the {@link ModuleRegistrationFunction}, allowing the module to register various components in
 * the workspace.
 */
export type ModuleRegistrationContext = {
  /**
   * Registers one or several implementations of workspace functions.
   *
   * @param implementations The constructors for the workspace function classes to register.
   */
  registerFunctionImplementations(
    ...implementations: ClassConstructor<WorkspaceFunction<any>>[]
  ): void;
};

/**
 * A function that registers a module's capabilities to the given workspace context.
 * This function should be the default export for the module.
 */
export type ModuleRegistrationFunction = (
  context: ModuleRegistrationContext,
) => Promise<void>;

/**
 * Loads a module in the context, making new functions, secret backends, etc available.
 *
 * @param moduleName The name of the JavaScript module, as it would be loaded from JavaScript code.
 * @param moduleVersion The expected version for the module, as a `semver` string.
 * @param basePath The base path used to resolve relative module paths.
 * @param functionRegistry The {@link FunctionRegistry} to which functions should be registered.
 * @param logger The logger to use.
 */
async function loadModule(
  moduleName: string,
  moduleVersion: string,
  basePath: string,
  functionRegistry: FunctionRegistry<WorkspaceContext>,
  logger: Logger,
): Promise<void> {
  try {
    const isPath = /^[\.]{0,2}\/.*$/.test(moduleName);
    const importName = isPath ? resolve(basePath, moduleName) : moduleName;

    logger.debug(`🔨 Loading module '${importName}'.`);
    const registerModule = (await import(importName))
      .default as ModuleRegistrationFunction;

    logger.debug(`🔨 Registering module '${importName}'.`);
    await registerModule({
      registerFunctionImplementations: (...implementations) =>
        functionRegistry.registerImplementations(...implementations),
    });
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new ModuleNotFoundError(moduleName);
    }

    throw error;
  }
}

/**
 * Loads the core module, as well as all the modules listed in the workspace configuration.
 *
 * @param rootPath The root of the workspace, from which relative module paths will be resolved.
 * @param configuration The {@link WorkspaceConfiguration} from which the list modules be read.
 * @param functionRegistry The {@link FunctionRegistry} to which functions should be registered.
 * @param logger The logger to use.
 */
export async function loadModules(
  rootPath: string,
  configuration: WorkspaceConfiguration,
  functionRegistry: FunctionRegistry<WorkspaceContext>,
  logger: Logger,
): Promise<void> {
  const modulesAndVersions = Object.entries(
    configuration.get('causa.modules') ?? {},
  );
  if (modulesAndVersions.length > 0) {
    logger.debug(
      `🔨 Found the following modules to load in the configuration: ${modulesAndVersions
        .map((m) => `'${m[0]}'`)
        .join(', ')}.`,
    );
  }

  await Promise.all(
    modulesAndVersions.map(([moduleName, moduleVersion]) =>
      loadModule(moduleName, moduleVersion, rootPath, functionRegistry, logger),
    ),
  );
}
